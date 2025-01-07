const { Unserializer } = require('../utils/Unserializer');

class PacketParser {
	constructor(ws, packet) {
        var params = packet.toString().split('=>');
        var name = params.shift().split("!HXP");
        if (name.length > 1)  {
            params = params.pop();
            params = Unserializer.run(params);
            name = name.pop();
        } else {
            params = name.pop().split("!HXp").pop();
            params = Unserializer.run(params);
            name = null;
        }

        this.data = params;
        this.name = name;
        return this;
    }
}

module.exports = { PacketParser };