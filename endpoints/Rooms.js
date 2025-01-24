const { PacketParser, Packet } = require('../utils/WebSockerPacket Parser');
const WebSocket = require('ws');

const { ServerSettings } = require('../utils/ServerSettings');

const { Room } = require('../class_endpoints/RoomData');

function onClientDisconnected(ws) {
    console.log("Attempt Client disconnection - %s", ws.clientId);
    Room.rooms.forEach(room => { room.removeUser(ws.clientId); });
}

// Client to Server Functions for creating or interacting with rooms

function joinOrCreate(ws, packet) {
    if (packet.name != "room.joinOrCreate") return;
    if (Room.usersCreatedRooms.has(ws.clientId)) return ws.send(new Packet("room.cooldown").toString());
    var metadata = packet.data.roomData || {};
    
    var roomName = packet.data.room || 'Room #'+(Room.rooms.size+1);
    if (packet.data.__discord != null && (packet.data.room == null)) roomName = packet.data.__discord.globalName + "'s Room";
    
    var joiningRoom = Room.rooms.has(roomName);

    var room = new Room(roomName, metadata);
    var isRoomFull = (room.users.length >= room.maxUsers && room.maxUsers != -1);
    if (isRoomFull) return ws.send(new Packet("room.error", {error: "This room is full"}).toString());
    if (room.private) return ws.send(new Packet("room.error", {error: "This room is private"}).toString());
    if (!joiningRoom) {
        room.private = packet.data.private || false;
        room.maxUsers = packet.data.userLimit || -1;
    }
    room.addUser(ws);

    if (joiningRoom) return;

    const _cooldown = setTimeout(() => {
        Room.usersCreatedRooms.delete(ws.clientId);
    }, Room.userCreationTimeOut * 1000);
    Room.usersCreatedRooms.set(ws.clientId, _cooldown);

    ws.send(new Packet("room.create", {room: room.toJSON()}).toString());
}

function join(ws, packet) {
    if (packet.name != "room.join") return;
    var room = Room.getRoom(packet.data.room);
    if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());
    if (room.private) return ws.send(new Packet("room.error", {error: "This room is private"}).toString());
    room.addUser(ws);
}

function leave(ws, packet) {
    if (packet.name != "room.leave") return;
    var room = Room.getRoom(packet.data.room);
    if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());

    room.removeUser(ws.clientId);
}

function ping(ws, packet) {
    if (packet.name != "room.ping") return;
    var room = Room.getRoom(packet.data.room);
    if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());
    for (const user of room.users) {
        if (user.clientId != ws.clientId) continue;
        if (!user.isHost) return ws.send(new Packet("room.error", {error: "You are the host of this room"}).toString());
        room.ping();
        room.sendPacketToAll(new Packet("room.ping", {}).toString());
        return;
    }
    return ws.send(new Packet("room.error", {error: "Unkown error"}).toString());
}

function getRooms(ws, packet) {
    if (packet.name != "room.get.rooms") return;
    var rooms = [];
    var showPrivate = packet.data.showPrivate || false;
    Room.rooms.forEach(room => {
        if (!showPrivate && room.private) return;
        rooms.push(room.toJSON());
    });
    ws.send(new Packet("room.return.rooms", {rooms: rooms}).toString());
}

function checkRoom(ws, packet) {
    if (packet.name != "room.validate") return;
    var roomExists = Room.rooms.has(packet.data.room);
    ws.send(new Packet("room.return.validation", {valid: !roomExists, roomName: packet.data.room}).toString());
}

function clientInRoom(ws, packet) {
    if (packet.name != "room.get.connected") return;
    var room = Room.getRoom(packet.data.room);
    if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());

    ws.send(new Packet("room.return.room", {room: room.toJSON()}).toString());
}

function update_clientMetaData(ws, packet) {
    if (packet.name != "room.update.client.meta") return;
    var room = Room.getRoom(packet.data.room);
    if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());

    var client = room.users.filter(user => user.clientId == ws.clientId);
    if (client.length == 0) return ws.send(new Packet("room.error", {error: "User is not in room"}).toString());

    for (const key in packet.data.meta) {
        if (!packet.data.meta.hasOwnProperty(key)) continue;
        client[0].addMetaData(key, packet.data.meta[key]);
    }
    ws.send(new Packet("room.update.client.meta", {room: client[0].__meta__}).toString());
    ws.send(new Packet("room.return.room", {room: room.toJSON()}).toString());
}

// Send messages to users in a room
function sendMessage(ws, packet) {
    if (!packet.name.startsWith("room.send.")) return;
    let sendTye = packet.name.split(".");
    sendTye = sendTye[sendTye.length - 1];

    var room = Room.getRoom(packet.data.room);
    if (!room) return ws.send(new Packet("room.error", {error: "Room does not exist"}).toString());
    if (!room.hasUser(ws.clientId)) return ws.send(new Packet("room.error", {error: "User is not in room"}).toString());
    
    var includeUser = packet.data.includeSelf || false;
    var disregardSelf = (!includeUser) ? [ws.clientId] : [];
    var packetToSend = new Packet("room.roomMessage", packet.data.data);

    switch (sendTye) {
        case "users":
            room.sendPacketToAll(packetToSend.toString(), disregardSelf);
            break;
        case "specific":
            room.sendPacketToUser(packetToSend.toString(), packet.data.user);
            break;
        case "broadcast":
            room.sendGlobalPacket(packetToSend.toString(), disregardSelf);
            break;
    }
}

function onMessage(ws, data) {
    if (ws.account == null || ws.account.loggedIn == false) return ws.send(new Packet("room.error", {error: "You are not logged in!"}).toString());
    var packet = new PacketParser(data);

    joinOrCreate(ws, packet);
    join(ws, packet);
    leave(ws, packet);
    ping(ws, packet);
    getRooms(ws, packet);
    checkRoom(ws, packet);
    clientInRoom(ws, packet);
    update_clientMetaData(ws, packet);

    sendMessage(ws, packet);
}

module.exports = {
    Room,
    message: onMessage,
    close: onClientDisconnected,
}