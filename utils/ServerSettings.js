const fs = require('fs');
const { Server } = require('http');
const path = require('path');

class ServerSettings {
    // WebSocket Server Settings
    static serverHost = 'localhost';
    static serverPort = 5000;

    // Server Settings
    static enableServerConsole = false;
    static noConsoleLog = false;

    // Room Endpoint Settings
    static roomTimeoutTime = 10;
    static roomPingTimeOut = 60;
    static userCreationTimeOut = 20;

    static toJSON() {
        const jsonObject = {};
        for (const [key, value] of Object.entries(this)) {
            if (key.startsWith('__')) continue;
            jsonObject[key] = value;
        }
        return jsonObject;
    }

    static __filePath = path.join(__dirname, '../server-config.json');
    static save() {
      const filePath = ServerSettings.__filePath;
      
      const currentJson = this.toJSON();

      let existingJson = {};
      if (fs.existsSync(filePath)) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        try {
          existingJson = JSON.parse(fileContents);
        } catch (err) {
          console.error('Error parsing existing JSON file:', err);
        }
      }

      // Merge the existing JSON with the current JSON, keeping existing keys
      const mergedJson = { ...currentJson, ...existingJson };

      // Save the updated JSON back to the file
      fs.writeFileSync(filePath, JSON.stringify(mergedJson, null, 2));
      ServerSettings.loadFromFile();
    }

    static loadFromFile() {
      const filePath = ServerSettings.__filePath;
      if (fs.existsSync(filePath)) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        try {
          const savedData = JSON.parse(fileContents);

          
          for (const [key, value] of Object.entries(savedData)) {
            if (!(key in this)) continue;
            this[key] = value;
          }
        } catch (err) {
          console.error('Error parsing JSON file:', err);
        }
      } else {
        console.log('\nServer Config does not exist. No data loaded.\n');
      }
    }
}

ServerSettings.save();
module.exports = { ServerSettings };