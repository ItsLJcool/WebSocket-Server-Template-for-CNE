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
     * @returns {Room}
     * @author ItsLJcool
     * @example
     * const room = new Room('My Room');
     */
    constructor(name, extras = {}, addToRooms = true, neverExpire = false) {
        this.name = name;
        if (Room.rooms.has(name)) return Room.rooms.get(name);

        this.users = [];
        this.__meta__ = extras || {};
        if (addToRooms) this.addToRooms();
        
        this.pingTimeOut = Room.pingTimeOut || 0;
        if (this.pingTimeOut <= 0) this.neverExpire = true;

        if (!neverExpire) this.ping();

        return this;
    }
    
    ping() {
        if (this.neverExpire) return;
        if (this.pingInterval != null) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            this.sendPacketToAll(new Packet("room.timeout", { room: this.name }).toString());
            this.removeFromRooms();
            clearInterval(this.pingInterval);
        }, this.pingTimeOut * 1000);
    }

    addUser(clientId, extra) {
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
        
        var data = {
            clientId: clientId,
            __meta__: extra || {},
        };

        if (this.users.length == 0) this.host = clientId;

        this.users.push(data);
    }

    removeUser(clientId) {
        this.users = this.users.filter(user => user.clientId != clientId); // supermaven is peak with this code it generated
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
    
    /**
     * 
     * @param {*} data The packet data to send to all users in all rooms
     * @param {*} disregards Put any client UUID's to disregard from sending the packet to the client(s)
     */
    static sendGlobalPacket(data, disregards = []) {
        Room.rooms.forEach(room => { room.sendPacketToAll(data, disregards); });
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

function onClientDisconnected(ws) {
    Room.rooms.forEach(room => { room.removeUser(ws.clientId); });
}

function onMessage(ws, data) {
    var packet = new PacketParser(ws, data);

    switch (packet.name) {
        case "room.joinOrCreate":
            // if (Room.usersCreatedRooms.has(ws.clientId)) return ws.send(new Packet("room.cooldown").toString());
            var metadata = packet.data.roomData || {};
    
            var roomName = packet.data.name || 'Room #'+(Room.rooms.size+1);
            if (packet.data.__discord != null) roomName = packet.data.__discord.globalName + "'s Room";
            var room = new Room(roomName, metadata);
            room.addUser(ws.clientId);
            var host = (room.host == ws.clientId);
    
            const _cooldown = setTimeout(() => {
                Room.usersCreatedRooms.delete(ws.clientId);
            }, Room.userCreationTimeOut * 1000);
            Room.usersCreatedRooms.set(ws.clientId, _cooldown);
            
            var data = {room: room.name, users: room.users};
            if (host) data.pingTimeout = room.pingTimeOut;

            ws.send(new Packet("room.create", data).toString());
            break;
        case "room.join":
            var room = Room.getRoom(packet.data.name);
            if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());
    
            room.sendPacketToAll(new Packet("room.join", {room: room.name, user: ws.clientId}).toString());
            ws.send(new Packet("room.join", {room: room.name}).toString());

            room.addUser(ws.clientId);
            
            console.log("User %s has joined room %s", ws.clientId, room.name);
            break;
        case "room.leave":
            var room = Room.getRoom(packet.data.name);
            if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());
    
            room.removeUser(ws.clientId);
            if (room.host == ws.clientId) room.host = room.users[0].clientId;
            if (room.users.length == 0) room.removeFromRooms();

            room.sendPacketToAll(new Packet("room.leave", {room: room.name, host: room.host, user: ws.clientId}).toString());
            ws.send(new Packet("room.leave", {room: room.name}).toString());

            console.log("User %s has left room %s", ws.clientId, room.name);
            break;
        case "room.ping":
            var room = Room.getRoom(packet.data.room);
            if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());
            if (room.host != ws.clientId) return ws.send(new Packet("room.error", {error: "You are not the host of this room"}).toString());
            room.ping();
            room.sendPacketToAll(new Packet("room.ping", {room: room.name, pingTimeOut: room.pingTimeOut, user: ws.clientId}).toString());
            break;
        case "room.getRooms":
            var rooms = [];
            Room.rooms.forEach(room => {
                var data = {
                    name: room.name,
                    users: room.users,
                    host: room.host,
                    pingTimeout: room.pingTimeOut,
                };
                rooms.push(data);
            });
            ws.send(new Packet("room.getRooms", {rooms: rooms}).toString());
            break;
    }
}

module.exports = {
    Room,
    connection: function (ws) {
        //a
    },

    message: onMessage,
    close: onClientDisconnected,
}