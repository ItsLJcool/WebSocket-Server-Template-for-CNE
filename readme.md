# WebSocket Server Template for Codename Engine
Welcome to this shitty repo !!!

Basically this is a Custom Server built from nothing in JavaScript using Node.js

## It's also unfinished, so stuff like sending data to the client hasn't been implemented yet.



## I will accept PR's and read issues and suggestions.
Since The `WebSocketUtil`'s PR hasn't been merged yet on **Codename Engine**, I welcome suggestions on how to improve this template.

## Basic Usage
Anything in the `endpoints` the WebSocket will send data to.

User's connected to the server will be given a UUID.

Here is an example of what you would put in a file.
```js
module.exports = {
    connection: (ws) => {
        console.log("Client %s connected!", ws.clientId);
    },
    message: (ws, data) => {
        console.log("Client %s sent data:\n%s", ws.clientId, data.toString());
    },
    close: (ws) => {
        console.log("Client %s disconnected!", ws.clientId);
    },

    error: (ws, error) => {
        console.error(error);
    },
}
```
Things like `connection`, `message`, `close`, and `error` will always have a parameter, the WebSocket object. This is because it contains the `clientId` of the user, and so you can send data back to the client.

For `message`, if the client is using `WebSocketUtil` and the data is a `WebSocketPacket`, you can use the `PacketParser` to parse the packet.
```js
const { PacketParser } = require('../utils/WebSockerPacket Parser');
module.exports = {
    message: (ws, data) => {
        var packet = new PacketParser(data);

        if (packet.name != "ping") return;

        ws.send("Pong!");
    },
}

```
The `PacketParser` will parse with no event name or parameters. So you can send a valid `WebSocketPacket` with no parameters in Codename Engine and the Parser will handle it.
If the packet has no Event name the `packet.name` will be `null`.

Haven't tested absolute zero packet data but worst case scenario it would be null.

Your endpoint files have try catches in them so if they do cause errors, the Server will still continue running.

I'm going to make a manager to fix this issue so all instances will be cleared before the server shuts down.

<details>
    <summary><h1>Default Template Endpoints</h1></summary>
Document enpoints that will exist by default for the user to use.

### `Rooms.js`
```js
/**
* @param {String} name The name of the room
* @param {Object} extras Any associated metadata to the room on creation
* @param {Boolean} addToRooms If you want to immediately add the room to the Rooms Map
* @param {Boolean} neverExpire If this room should never expire
* @returns {Room}
* @author ItsLJcool
*/
```
This endpoint is used to create rooms for your users to join.
You can access the `Rooms` class by using `require('./endpoints/Rooms')`.

Here is an example of how to use it.
```js
const { Room } = require('./endpoints/Rooms');

console.log("There are %s rooms.", Room.rooms.size);

var room = new Room("My Room");

console.log("There are %s users in the room.", room.users.length);

// Don't do this. all users should be UUID's. Idk how to check for UUID's specifically rn
room.addUser("Client ID Example"); 

console.log("There are %s users in the room.", room.users.length);

console.log("There are %s rooms.", Room.rooms.size);
```

The `rooms` is a `Map`. The names are the keys and the values are the `Room` objects.
to get all the romes, use `Room.getAllRooms()`.

Rooms will automatically **timeout without** being pinged.
<br>If a Client tries to make too many rooms they have a cooldown.

You can of disable rooms from expiring by setting `neverExpire` to `true` when creating a room.
```js
var room = new Room("My Room", {}, false, true);
```
You can change the default `userCreationTimeOut`, `roomTimeoutTime` and `pingTimeOut` in the class currently.
<br>Probably should make it a congfig file. Remind me please.

### Sending Data to clients
It wouldn't be a room system if you couldn't send data to clients!<br>
All you need to do is have the packet you want to send to the user(s) and the client UUID(s) you want to send it to.
#### `sendPacketToAll(data, disregards = [])`
#### `sendPacketToUser(data, clientId)`
These functions will send the packet to all users in the room or a specific user in the room.<br>
`disregards` basically allow you to disregard clients to send packets too.<br>
Here is an example of how to use it.
```js
const { Room } = require('./endpoints/Rooms');

var room = new Room("My Room");

// Send to everyone in a room a warm welcome message
Room.sendGlobalPacket("Hello World!");

room.sendPacketToUser("Your a special one!", "Client UUID");
```
</details>

# How to compile
Currently, you need to install `Node.js v10.5.0`<br>
To check your version or if you have Node.js installed, run `npm -v` in your powershell.

Once you have download the template, run these in your powershell:
```bat
npm install fs
npm install path
npm install ws
npm install uuid
npm install haxe-serializer
```
then just run `node .` in the directory of `index.js` and your server should start!

This is just windows tutorial but its pretty much the same for linux and mac but using `sh` instaed of `bat` syntax.

## Server Settings
You can edit the `ServerSettings.js` file in `utils` to change default settings for the server.

The `server-config.json` is more of a save file for the settings, you want to edit the `ServerSettings.js` file for making new settings.<br>
Then you edit the`server-config.json` file to change the settings.

The `ServerSettings.js` just initalizes the `server-config.json` file and sets default values for the settings. `server-config.json` acutally holds the save data.

## Other information
Check out the [**ws documentation**](https://github.com/websockets/ws) for more information on how to use WebSockets.