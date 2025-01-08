const { PacketParser, Packet } = require('../utils/WebSockerPacket Parser');
const WebSocket = require('ws');

/**
 * @class Room
 * @author ItsLJcool
 * @description A class that holds data for rooms. Clients can connect, create, join, or leave rooms.
 */
class Room {

    // Time in seconds to wait for a room to be empty before it is removed.
    static roomTimeoutTime = 10;
    static pingTimeOut = 60;

    static userCreationTimeOut = 20;
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
        this.__meta__ = extras;
        if (addToRooms) this.addToRooms();

        this.pingTimeOut = Room.pingTimeOut || 0;

        if (this.pingTimeOut > 0 && !neverExpire) this.ping();

        return this;
    }
    
    ping() {
        if (this.neverExpire) return;
        if (this.pingInterval != null) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            this.sendPacketToAll(new Packet("room.event", {room: this.name, event: "timout"}).toString());
            this.removeFromRooms();
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

        this.host = clientId;

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
            if (Room.usersCreatedRooms.has(ws.clientId)) return ws.send(new Packet("room.cooldown").toString());
            var metadata = packet.data.roomData || {};
    
            var room = new Room(packet.data.name || 'Room #'+(Room.rooms.size+1), metadata);
            room.addUser(ws.clientId, {discord: packet.__discord || {}});
    
            const _cooldown = setTimeout(() => {
                Room.usersCreatedRooms.delete(ws.clientId);
            }, Room.userCreationTimeOut * 1000);
            Room.usersCreatedRooms.set(ws.clientId, _cooldown);
            
            ws.send(new Packet("room.join", {room: room.name, event: "join"}).toString());
            break;
        case "room.join":
            var room = Room.getRoom(packet.data.name);
            if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());
    
            room.sendPacketToAll(new Packet("room.event", {room: room.name, event: "join", user: ws.clientId}).toString());
            ws.send(new Packet("room.event", {room: room.name, event: "join"}).toString());

            room.addUser(ws.clientId, {discord: packet.__discord || {}});
            
            console.log("User %s has joined room %s", ws.clientId, room.name);
            break;
        case "room.leave":
            var room = Room.getRoom(packet.data.name);
            if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());
    
            room.removeUser(ws.clientId);
            if (room.users.length == 0) room.removeFromRooms();

            room.sendPacketToAll(new Packet("room.event", {room: room.name, event: "leave", user: ws.clientId}).toString());
            ws.send(new Packet("room.event", {room: room.name, event: "leave"}).toString());

            console.log("User %s has left room %s", ws.clientId, room.name);
            break;
        case "room.ping":
            var room = Room.getRoom(packet.data.name);
            if (!room || room.host != ws.clientId) {
                var error = (room.host != ws.clientId) ? "You are not the host of this room" : "Room does not exist";
                return ws.send(new Packet("room.error", {error: error}).toString());
            }
            room.ping();
            room.sendPacketToAll(new Packet("room.event", {room: room.name, event: "ping", user: ws.clientId}).toString());
            break;
    }

    // TODO: Send data back to client
    console.log("\nRooms: %s", Room.rooms);
}

module.exports = {
    Room,
    connection: function (ws) {
        //a
    },

    message: onMessage,
    close: onClientDisconnected,
}