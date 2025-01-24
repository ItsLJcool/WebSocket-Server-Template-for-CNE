// Basic terminal interface from ChatGPT. Thanks man.
// Refactored to be more modular and easier to use.

const { ServerSettings } = require('./ServerSettings');

const { Room } = require('../class_endpoints/RoomData');
const WebSocket = require('ws');

const readline = require('readline');

function listCommands() {
    console.log('Available commands:');
    Object.keys(ServerTerminal.commands).forEach(cmd => console.log(`  - ${cmd}`));
}

class ServerTerminal {
    static preventConsoleLog = ServerSettings.noConsoleLog;
    static onShutdown = () => {
        rl.close();
        process.exit(0);
    };
    
    static commands = {
        help: listCommands,
        cls: () => {
            console.clear();
        },

        "all rooms": () => { console.log("rooms: %s", Room.rooms); },
        clients: () => {
            const _clients = [];
            webSocketServer.clients.forEach((ws) => {
                if (ws.readyState !== WebSocket.OPEN) return;
                _clients.push({account: ws.account, clientId: ws.clientId});
            });
            console.log("Cleints: %s", _clients);
        },

        exit: ServerTerminal.onShutdown,
    };

    static serverConsole = ServerSettings.enableServerConsole;
}

// Set up the readline interface
var rl = null;

const originalClear = console.clear;
console.clear = function () {
    process.stdout.write('\x1Bc'); // Sends an ANSI escape sequence to clear the terminal
    originalClear(); // Clear visible output
};

const originalLog = console.log;
console.log = function (...args) {
    if (ServerTerminal.preventConsoleLog) return;
    if (ServerTerminal.serverConsole) rl.output.write('\x1B[2K\r');

    originalLog.apply(console, args);

    if (ServerTerminal.serverConsole) rl.prompt(true);
};

let preventClose = false;
function setupServerTerminal() {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '>>> ',
    });
    rl.input.setRawMode(true);

    rl.on('line', (line) => {
        const input = line.trim();
        console.log('');
        if (ServerTerminal.commands[input]) ServerTerminal.commands[input]();
        else {
            console.log(`Unknown command: ${input}`);
            console.log('Type "help" for a list of available commands.');
        }
        console.log('');
        rl.prompt();
    }).on('close', () => {
        if (preventClose) return;
        ServerTerminal.onShutdown();
    });
    
    // Start the terminal
    console.log('\nServer Terminal Active!');
    console.log('Type "help" for a list of available commands.');
    rl.prompt();
}


if (ServerTerminal.serverConsole) setupServerTerminal();

module.exports = { ServerTerminal };