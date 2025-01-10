const { Unserializer } = require('./HaxeSerialization');
var Serializer = require("haxe-serializer")

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

class Packet {
    constructor(name = null, data = {}, add_meta_data = true) {
        this.name = name;
        this.data = data;
        this.add_meta_data = add_meta_data;
    }

    exists(key) {
        return this.data.hasOwnProperty(key);
    }

    set(key, value) {
        this.data[key] = value;
        return this;
    }
    
    get(key) {
        return this.data[key];
    }

    toString() {
        if (this.add_meta_data) this.data.__timestamp = Date.now();
        var hasName = (this.name != null && this.name.trim() != "");
        var start = (hasName) ? "!JSP"+this.name : "!JSp";
        start += "=>";

        let cerial = Serializer.serialize(this.data);

        return start+cerial.toString();
    }
}

module.exports = { PacketParser, Packet };