// Basic terminal interface from ChatGPT. Thanks man.
// Refactored to be more modular and easier to use.

const { Room } = require('../endpoints/Rooms');
const WebSocket = require('ws');

const readline = require('readline');

function listCommands() {
    console.log('Available commands:');
    Object.keys(ServerTerminal.commands).forEach(cmd => console.log(`  - ${cmd}`));
}

class ServerTerminal {
    static onShutdown = () => {
        rl.close();
        process.exit(0);
    };
    
    static commands = {
        help: listCommands,
        cls: () => { console.clear(); },

        "all rooms": () => { console.log(Room.rooms); },
        clients: () => {
            const _clients = [];
            webSocketServer.clients.forEach((ws) => {
                if (ws.readyState !== WebSocket.OPEN) return;
                _clients.push(ws.clientId);
            });
            console.log(_clients);
        },

        exit: ServerTerminal.onShutdown,
    };
}

// Set up the readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '>>> ',
});

const originalLog = console.log;
console.log = function (...args) {
    rl.output.write('\x1B[2K\r'); // Clear the current line
    originalLog.apply(console, args); // Call the original console.log
    rl.prompt(true); // Re-render the prompt
};

rl.on('line', (line) => {
    const input = line.trim();
    console.log('');
    if (ServerTerminal.commands[input]) ServerTerminal.commands[input]();
    else {
        console.log(`Unknown command: ${input}`);
        console.log('Type "help" for a list of available commands.');
    }
    rl.prompt();
}).on('close', () => {
    ServerTerminal.onShutdown();
});

// Start the terminal
console.log('\nServer Terminal Active!');
console.log('Type "help" for a list of available commands.');
rl.prompt();

module.exports = { ServerTerminal };