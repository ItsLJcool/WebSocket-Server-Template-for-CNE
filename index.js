const { Unserializer } = require('./utils/HaxeSerialization');
const { v4: uuidv4 } = require('uuid');

const { Room } = require('./endpoints/Rooms');

const WebSocket = require('ws');



const Debugger = true;

const fs = require('fs');
const path = require('path');


// Create a WebSocket server
const wss = new WebSocket.Server({ port: 5000 });
global.webSocketServer = wss;

console.log("WebSocket server is running on ws://localhost:5000");

const endpoints = path.join(__dirname, 'endpoints');
const endpointFiles = fs.readdirSync(endpoints).filter(file => file.endsWith('.js'));
wss.on("connection", function (ws) {
    ws.clientId = uuidv4();
    
    if (Debugger) debug_connection(ws, ...arguments);

    for (const file of endpointFiles) {
        const filePath = path.join(endpoints, file);
        const endpoint = require(filePath);
    
        const fieldsToCheck = ['message', 'close', 'error'];
        for (const field of fieldsToCheck) {
            if (!(field in endpoint)) continue;
            ws.on(field, function() {
                if (Debugger) debug_message(ws, ...arguments);
                try {
                    endpoint[field](ws, ...arguments);
                } catch (e) {
                    console.error(e);
                }
            });
        }
        
        if ('connection' in endpoint) {
            try {
                endpoint.connection(ws, ...arguments);
            } catch (e) {
                console.error(e);
            }
        }
    }

    if (Debugger) ws.on('close', () => { debug_close(...arguments); });
    
    ws.on('error', console.error);
});

function debug_message(ws, data) { console.log("Received from %s: %s", ws.clientId, data.toString()); }
function debug_connection(ws) { console.log("Client connected: %s", ws.clientId); }
function debug_close(ws) { console.log("Client disconnected: %s", ws.clientId); }

function shutdownServer() {
    console.log('Shutting down server...');
    wss.clients.forEach((client) => {
        client.close();
    });

    wss.close(() => {
        console.log('WebSocket server closed');
        process.exit(0); // Exit the process
    });
}

// thanks ChatGPT
// Listen for termination signals (e.g., Ctrl+C)
process.on('SIGINT', shutdownServer);
process.on('SIGTERM', shutdownServer);