const { PacketParser } = require('../utils/WebSockerPacket Parser');

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
            this.removeFromRooms();
        }, this.pingTimeOut * 1000);
    }

    addUser(clientID, extra) {
        if (this.users.find(user => user.clientID == clientID)) return;

        // Chekcing if user is already in room, if so we don't add them to the new room.
        var isUserInRoom = false;
        Room.rooms.forEach(room => {
            for (const user of room.users) {
                if (user.clientID != clientID) continue;

                isUserInRoom = true;
                break;
            }
        });
        if (isUserInRoom) return;
        
        var data = {
            clientID: clientID,
            __meta__: extra || {},
        };

        this.users.push(data);
    }

    removeUser(clientID) {
        this.users = this.users.filter(user => user.clientID != clientID); // supermaven is peak with this code it generated
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
}

function onClientDisconnected() {
    Room.rooms.forEach(room => { room.removeUser(ws.clientId); });
}

function onMessage(ws, data) {
    var packet = new PacketParser(ws, data);

    switch (packet.name) {
        case "room.joinOrCreate":
            if (Room.usersCreatedRooms.has(ws.clientId)) {
                // TODO: Send data back to client
                console.log("User %s is on cooldown", ws.clientId);
                return;
            }
            var metadata = packet.data.roomData || {};
    
            new Room(packet.data.name || 'Room #'+(Room.rooms.size+1), metadata).addUser(ws.clientId, {discord: packet.__discord || {}});
    
            const _cooldown = setTimeout(() => {
                Room.usersCreatedRooms.delete(ws.clientId);
            }, Room.userCreationTimeOut * 1000);
            Room.usersCreatedRooms.set(ws.clientId, _cooldown);
            break;
        case "room.join":
            var room = Room.getRoom(packet.data.name);
            if (!room) {
                // TODO: Send data back to client
                console.log("Room %s does not exist", packet.data.name);
                return;
            }
    
            room.addUser(ws.clientId, {discord: packet.__discord || {}});
            
            // TODO: Send data back to client
            console.log("User %s has joined room %s", ws.clientId, room.name);
            break;
        case "room.leave":
            var room = Room.getRoom(packet.data.name);
            if (!room) return;
    
            room.removeUser(ws.clientId);
            if (room.users.length == 0) room.removeFromRooms();

            // TODO: Send data back to client
            console.log("User %s has left room %s", ws.clientId, room.name);
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