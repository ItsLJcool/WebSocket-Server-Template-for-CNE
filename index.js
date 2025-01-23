const { ServerSettings } = require('./utils/ServerSettings');

const WebSocket = require('ws');


const Debugger = true;

const fs = require('fs');
const path = require('path');

// Define the host and port
const host = ServerSettings.serverHost;
const port = ServerSettings.serverPort;

var _serverinput = {port: port};
if (host !== 'localhost' && host !== '127.0.0.1') _serverinput.host = host;

// Create a WebSocket server
const wss = new WebSocket.Server(_serverinput, () => {
    console.log("");
    if (host === 'localhost' || host === '127.0.0.1')
        console.log(`Server is running on localhost at ws://${host}:${port}`);
    else
        console.log(`Server is running on ${host} at ws://${host}:${port}`);

    const { ServerTerminal } = require('./utils/ServerTerminal');
    ServerTerminal.onShutdown = shutdownServer;
});
global.webSocketServer = wss;

const endpoints = path.join(__dirname, 'endpoints');
const endpointFiles = fs.readdirSync(endpoints).filter(file => file.endsWith('.js'));

wss.clients.forEach(client => {
});
wss.on("connection", function (ws) {
    ws.__pingInterval = setInterval(() => {
        ws.ping();
    }, 20_000);

    addHeartbeat(ws);

    ws.on('pong', () => {
        clearTimeout(ws.heartbeatTimeout);
        addHeartbeat(ws);
    });
    
    ws.on('close', () => {
        clearInterval(ws.__pingInterval);
        clearTimeout(ws.heartbeatTimeout)
    });



    for (const file of endpointFiles) {
        const filePath = path.join(endpoints, file);
        const endpoint = require(filePath);
    
        const fieldsToCheck = ['message', 'close', 'error', "pong"];
        for (const field of fieldsToCheck) {
            if (!(field in endpoint)) continue;
            ws.on(field, function() {
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

    if (Debugger) {
        // ws.on('message', (data) => { debug_message(ws, data); });
        debug_connection(ws, ...arguments);
        ws.on('close', () => { debug_close(...arguments); });
    }
    
    ws.on('error', console.error);
});

function debug_message(ws, data) { console.log("Received from %s: %s", ws.clientId, data.toString()); }
function debug_connection(ws) { console.log("Client connected: %s", ws.clientId); }
function debug_close(ws) { console.log("Client disconnected: %s", ws.clientId); }

function shutdownServer() {
    console.log('\nShutting down server...');

    wss.clients.forEach((client) => {
        client.close();
    });

    wss.close(() => {
        console.log('WebSocket server closed');
        process.exit(0); // Exit the process
    });
}

function addHeartbeat(ws) {
    ws.heartbeatTimeout = setTimeout(() => {
        ws.terminate();
    }, 30_000 + 1_000);
}

// thanks ChatGPT
// Listen for termination signals (e.g., Ctrl+C)
process.on('SIGINT', shutdownServer);
process.on('SIGTERM', shutdownServer);