const { PacketParser, Packet } = require('../utils/WebSockerPacket Parser');
const WebSocket = require('ws');

const { ServerSettings } = require('../utils/ServerSettings');

/**
 * @author ItsLJcool
 * @description A class that holds data for rooms. Clients can connect, create, join, or leave rooms.
 */
class Room {

    // Time in seconds to wait for a room to be empty before it is removed.
    static roomTimeoutTime = ServerSettings.roomTimeoutTime;
    static pingTimeOut = ServerSettings.roomPingTimeOut;

    static userCreationTimeOut = ServerSettings.userCreationTimeOut;
    static usersCreatedRooms = new Map();

    static rooms = new Map();

    static getRoom(name) {
        return Room.rooms.get(name);
    }

    /**
     * @param {String} name The name of the room
     * @param {Object} extras Any associated metadata to the room on creation
     * @param {Boolean} addToRooms If you want to immediately add the room to the Rooms Map
     * @param {Boolean} neverExpire If this room should never expire
     * @param {Int} userLimit The maximum number of users allowed in the room
     * @returns {Room}
     * @author ItsLJcool
     * @example
     * const room = new Room('My Room');
     */
    constructor(name, extras = {}, addToRooms = true, neverExpire = false, userLimit = -1) {
        const _maxLength = 50;
        if (name.length > _maxLength) name = name.substring(0, _maxLength);
        this.name = name;
        if (Room.rooms.has(name)) return Room.rooms.get(name);

        this.users = [];
        this.maxUsers = userLimit;
        this.__meta__ = extras || {};
        if (addToRooms) this.addToRooms();
        
        this.pingTimeOut = Room.pingTimeOut || 0;
        if (this.pingTimeOut <= 0) this.neverExpire = true;

        if (!neverExpire) this.ping();

        this.private = false;

        return this;
    }
    
    ping() {
        if (this.neverExpire) return;
        if (this.pingInterval != null) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            this.sendPacketToAll(new Packet("room.timeout", { room: this.toJSON() }).toString());
            this.removeFromRooms();
            clearInterval(this.pingInterval);
        }, this.pingTimeOut * 1000);
    }

    addUser(ws, extra = {}) {
        if (this.private) return;
        if (this.users.length >= this.maxUsers && this.maxUsers != -1) return;
        if (this.users.find(user => user.clientId == clientId)) return;
        
        // Chekcing if user is already in room, if so we don't add them to the new room.
        var isUserInRoom = false;
        Room.rooms.forEach(room => {
            for (const user of room.users) {
                if (user.clientId != clientId) continue;

                isUserInRoom = true;
                break;
            }
        });
        if (isUserInRoom) return;
        
        var userClient = new RoomClient(ws.clientId, ws.account, extra);

        if (this.users.length == 0) userClient.isHost = true;

        this.users.push(userClient);
    }

    removeUser(clientId) {
        var user = this.users.find(user => user.clientId == clientId);
        this.users.remove(user);
        if (this.users.length == 0) return;
        if (user.isHost) this.users[0].isHost = true;
    }

    hasUser(clientId) {
        return this.users.find(user => user.clientId == clientId);
    }

    addToRooms() {
        Room.rooms.set(this.name, this);
        if (this.neverExpire) return;

        this.roomTimeout = setInterval(() => {
            if (this.users.length > 0) return;
            Room.rooms.delete(this.name);
            clearInterval(this.roomTimeout);
        }, Room.roomTimeoutTime * 1000);
    }

    removeFromRooms() {
        if (!Room.rooms.has(this.name)) return;
        Room.rooms.delete(this.name);

        if (this.neverExpire) return;
        clearInterval(this.roomTimeout);
        this.sendPacketToAll(new Packet("room.close", { room: this.toJSON() }).toString());
    }

    /**
     * @param {*} data The packet data to send to all users in the room
     * @param {*} disregards Put any client UUID's to disregard from sending the packet to the client(s)
     */
    sendPacketToAll(data, disregards = []) {
        var clientsWs = this.__getUsersWebSockets();
        clientsWs = clientsWs.filter(client => !disregards.includes(client.clientId));
        if (clientsWs.length == 0) return;
        for (const client in clientsWs) clientsWs[client].send(data);
    }

    /**
     * @param {*} data The packet data to send to a specific user in the room
     * @param {*} clientId The client UUID of the user to send the packet to
     */
    sendPacketToUser(data, clientId) {
        var clientsWs = this.__getUsersWebSockets();
        clientsWs = clientsWs.filter(client => client.clientId != clientId);
        if (clientsWs.length == 0) return;
        for (const client in clientsWs) clientsWs[client].send(data);
    }

    getHostUser() {
        return this.users.filter(user => user.isHost)[0];
    }
    
    /**
     * 
     * @param {*} data The packet data to send to all users in all rooms
     * @param {*} disregards Put any client UUID's to disregard from sending the packet to the client(s)
     */
    static sendGlobalPacket(data, disregards = []) {
        Room.rooms.forEach(room => { room.sendPacketToAll(data, disregards); });
    }

    toJSON() {
        return {
            name: this.name,
            users: this.users,
            pingTimeout: this.pingTimeOut,
            private: this.private,
            __meta__: this.__meta__,
        };
    }

    toString() {
        if (this.users.length == 0) return this.name + " - Users: 0 - Host: None (private: " + this.private + " | neverExpire: " + this.neverExpire + ")";
        return this.name + " - Users: " + this.users.length + " - Host: " + getHostUser().username + " (private: " + this.private + " | neverExpire: " + this.neverExpire + ")";
    }

    __getUsersWebSockets() {
        var clientWs = [];
        webSocketServer.clients.forEach((ws) => {
            for (const id in this.users) {
                const user = this.users[id];
                if (user.clientId != ws.clientId) continue;
                if (ws.readyState !== WebSocket.OPEN) continue;
                clientWs.push(ws);
            }
        });
        return clientWs;
    }
}

/**
 * @author ItsLJcool
 * @description A class that holds data for a client connected to a room.
 */
class RoomClient {

    /**
     * @param {String} clientId UUID of the client from the WebSocket
     * @param {*} account The account data of the client
     * @param {*} extra Any extra MetaData to add to the client
     */
    constructor(clientId, account = {}, extra = {}) {
        this.clientId = clientId;
        this.__account = account || {};
        this.__meta__ = extra || {};
        this.isHost = false;

        this.username = this.__account.username;
        this.globalName = this.__account.globalName;
    }

    addMetaData(key, value) {
        this.__meta__[key] = value;
    }

    toJSON() {
        return {
            clientId: this.clientId,
            username: this.username,
            globalName: this.globalName,
            __meta__: this.__meta__,
        };
    }

    toString() { return "Name: " + this.username + " (aka " + this.globalName + ") - Client ID: " + this.clientId; }
}

module.exports = { Room, RoomClient }