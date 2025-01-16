const { v4: uuidv4 } = require('uuid');
const { PacketParser, Packet } = require('../utils/WebSockerPacket Parser');
const WebSocket = require('ws');

const { ServerSettings } = require('../utils/ServerSettings');

function login(ws, packet) {
    if (packet.name != "client.login") return;

    if (ws.account.loggedIn || false) return ws.send(new Packet("client.error", {error: "Already logged in"}).toString());

    console.log("Client attempting to login. Data: %s", packet.data.__discord);
    switch (packet.data.method) {
        case "discord":
            var discord = packet.data.__discord || null;
            if (discord == null) return ws.send(new Packet("client.error", {error: "Discord metadata not found."}).toString());
            ws.account.username = discord.username;
            ws.account.globalName = discord.globalName;
            ws.account.__meta = { nitroType: discord.premiumType, };

            break;
        case "email":
            return ws.send(new Packet("client.error", {error: "Not implemented"}).toString());
        default:
            return ws.send(new Packet("client.error", {error: "Invalid login method"}).toString());
    }

    ws.account.loggedIn = true;
    ws.send(new Packet("client.login", {success: true, clientId: ws.clientId}).toString());
}

function getUserAccount(ws, packet) {
    if (packet.name != "client.getSelf") return;
    return new Packet("client.returnSelf", {account: ws.account, clientId: ws.clientId}).toString();
}

module.exports = {
    connection: function (ws) {
        ws.clientId = uuidv4();
        ws.account = { loggedIn: false, };
    },
    message: (ws, data) => {
        var packet = new PacketParser(data);
        login(ws, packet);
        getUserAccount(ws, packet);
    },
    close: () => {},
}