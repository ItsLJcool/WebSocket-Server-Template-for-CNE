function plural(num, str) {
	return num + " " + str + (num === 1 ? "" : "s");
}

function singular(num, str) {
	return num === 1 ? "" : "s";
}

function substr(s,pos,len) {
	if(len === null) {
		len = s.length;
	} else if(len < 0) {
		if(pos === 0) {
			len = s.length + len;
		} else {
			return "";
		}
	}
	return s.substr(pos,len);
}

function fastCharCodeAt(s, pos) {
	return s.charCodeAt(pos);
}

function nullizeArray(array) {
	for (let i = 0; i < array.length; i++) {
		if (array[i] === undefined) {
			array[i] = null;
		}
	}
}

class Unserializer {
	static BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%:";

	static CODES = null;

	static initCodes() {
		var codes = [];
		for(var i = 0; i < BASE64.length; i++) {
			codes[BASE64.charCodeAt(i)] = i;
		}
		return codes;
	}

	constructor(buf) {
		this.buf = buf;
		this.length = this.buf.length;
		this.pos = 0;
		this.upos = 0;
		this.scache = [];
		this.cache = [];
	}

	get(p) {
		return this.buf.charCodeAt(p);
	}

	getC(p) {
		return this.buf.charAt(p);
	}

	readDigits() {
		var k = 0;
		var s = false;
		var fpos = this.pos;
		while (true) {
			var c = this.get(this.pos);
			if (c !== c)
				break;
			if (c === 45) { // -
				if (this.pos != fpos)
					break;
				s = true;
				this.pos++;
				continue;
			}
			if (c < 48 || c > 57) // 0-9
				break;
			k = k * 10 + (c - 48); // 0
			this.pos++;
		}
		if (s)
			k *= -1;
		return k;
	}

	readFloat() {
		var p1 = this.pos;
		while (true) {
			var c = this.get(this.pos);
			if (c !== c)
				break;
			// + - . , 0-9
			//if ((c >= 43 && c < 58) || c == "e".code || c == "E".code)
			if ((c >= 43 && c < 58) || c === 101 || c === 69)
				this.pos++;
			else
				break;
		}
		return parseFloat(substr(this.buf, p1, this.pos - p1));
	}

	unserializeObject(o) {
		while (true) {
			if (this.pos >= this.length)
				throw "Invalid object";
			if (this.getC(this.pos) === "g")
				break;
			var k = this.unserialize();
			if (typeof k !== "string")
				throw "Invalid object key";
			var v = this.unserialize();
			o[k] = v;
			//Reflect.setField(o, k, v);
		}
		this.pos++;
	}

	unserializeEnum(edecl, tag) {
		if (this.getC(this.pos++) !== ":")
			throw "Invalid enum format";
		var nargs = this.readDigits();
		if (nargs === 0)
			return new EnumInfo(edecl, tag);
		var args = new Array();
		while (nargs-- > 0)
			args.push(this.unserialize());
		return new EnumInfo(edecl, tag, args);
	}

	unserialize() {
		var char = this.getC(this.pos++);
		switch (char) {
			case "n":
				return null;
			case "t":
				return true;
			case "f":
				return false;
			case "z":
				return 0;
			case "i":
				return this.readDigits();
			case "d":
				return this.readFloat();
			case "y":
				var len = this.readDigits();
				if (this.getC(this.pos++) !== ":" || this.length - this.pos < len)
					throw "Invalid string length";
				var s = substr(this.buf, this.pos, len);
				this.pos += len;
				s = decodeURIComponent(s.split("+").join(" "));
				this.scache.push(s);
				return s;
			case "k":
				return NaN;
			case "m":
				return -Infinity;
			case "p":
				return +Infinity;
			case "a":
				var buf = this.buf;
				var a = new Array();
				this.cache.push(a);
				while (true) {
					var c = this.getC(this.pos);
					if (c === "h") {
						this.pos++;
						break;
					}
					if (c === "u") {
						this.pos++;
						var n = this.readDigits();
						a[a.length + n - 1] = null;
					} else
						a.push(this.unserialize());
				}
				nullizeArray(a);
				return a;
			case "o":
				var o = {};
				this.cache.push(o);
				this.unserializeObject(o);
				return o;
			case "r":
				var n = this.readDigits();
				if (n < 0 || n >= this.cache.length)
					throw "Invalid reference";
				return this.cache[n];
			case "R":
				var n = this.readDigits();
				if (n < 0 || n >= this.scache.length)
					throw "Invalid string reference";
				return this.scache[n];
			case "x":
				return new ExceptionData(this.unserialize());
			case "c":
				var name = this.unserialize();
				var o = {};
				var cl = new ClassData(name, o);
				this.cache.push(o);
				this.unserializeObject(o);
				return cl;
				/*var cl = resolver.resolveClass(name);
				if (cl == null)
					throw "Class not found " + name;
				var o = Type.createEmptyInstance(cl);
				cache.push(o);
				unserializeObject(o);
				return o;*/

			case "w":
				var name = this.unserialize();
				/*var edecl = resolver.resolveEnum(name);
				if (edecl == null)
					throw "Enum not found " + name;
				var e = unserializeEnum(edecl, unserialize());
				cache.push(e);
				return e;*/

				var e = this.unserializeEnum(name, this.unserialize());
				this.cache.push(e);
				return e;
			case "j":
				/*var name = unserialize();
				var edecl = resolver.resolveEnum(name);
				if (edecl == null)
					throw "Enum not found " + name;
				pos++; // skip ':'
				var index = readDigits();
				var tag = Type.getEnumConstructs(edecl)[index];
				if (tag == null)
					throw "Unknown enum index " + name + "@" + index;
				var e = unserializeEnum(edecl, tag);
				cache.push(e);
				return e;*/
				throw "Not implemented (j, enum)";
			case "l":
				var l = new List();
				this.cache.push(l);
				var buf = this.buf;
				while (this.getC(this.pos) !== "h")
					l.add(this.unserialize());
				this.pos++;
				return l;
			case "b":
				var h = new StringMap();
				this.cache.push(h);
				var buf = this.buf;
				while (this.getC(this.pos) !== "h") {
					var s = this.unserialize();
					h.set(s, this.unserialize());
				}
				this.pos++;
				return h;
			case "q":
				var h = new IntMap();
				this.cache.push(h);
				var buf = this.buf;
				var c = this.getC(this.pos++);
				while (c === ":") {
					var i = this.readDigits();
					h.set(i, this.unserialize());
					c = this.getC(this.pos++);
				}
				if (c != "h")
					throw "Invalid IntMap format";
				return h;
			case "M":
				var h = new ObjectMap();
				this.cache.push(h);
				var buf = this.buf;
				while (this.getC(this.pos) !== "h") {
					var s = this.unserialize();
					h.set(s, this.unserialize());
				}
				this.pos++;
				return h;
			case "v":
				var d;
				if (this.getC(this.pos) >= '0' && this.getC(this.pos) <= '9' && this.getC(this.pos + 1) >= '0' && this.getC(this.pos + 1) <= '9' && this.getC(this.pos + 2) >= '0'
					&& this.getC(this.pos + 2) <= '9' && this.getC(this.pos + 3) >= '0' && this.getC(this.pos + 3) <= '9' && this.getC(this.pos + 4) === '-') {
					// Included for backwards compatibility
					d = new Date(substr(this.buf, this.pos, 19));
					this.pos += 19;
				} else
					d = new Date(this.readFloat());
				this.cache.push(d);
				return d;
			case "s":
				var len = this.readDigits();
				var buf = this.buf;
				if (this.getC(this.pos++) != ":" || this.length - this.pos < len)
					throw "Invalid bytes length";

				// TODO: add support for bytes

				var codes = Unserializer.CODES;
				if (!codes) {
					codes = initCodes();
					Unserializer.CODES = codes;
				}
				var i = this.pos;
				var rest = len & 3;
				var size = (len >> 2) * 3 + ((rest >= 2) ? rest - 1 : 0);
				var max = i + (len - rest);
				var bytes = haxe.io.Bytes.alloc(size);
				var bpos = 0;
				while (i < max) {
					var c1 = codes[fastCharCodeAt(buf, i++)];
					var c2 = codes[fastCharCodeAt(buf, i++)];
					bytes.set(bpos++, (c1 << 2) | (c2 >> 4));
					var c3 = codes[fastCharCodeAt(buf, i++)];
					bytes.set(bpos++, (c2 << 4) | (c3 >> 2));
					var c4 = codes[fastCharCodeAt(buf, i++)];
					bytes.set(bpos++, (c3 << 6) | c4);
				}
				if (rest >= 2) {
					var c1 = codes[fastCharCodeAt(buf, i++)];
					var c2 = codes[fastCharCodeAt(buf, i++)];
					bytes.set(bpos++, (c1 << 2) | (c2 >> 4));
					if (rest === 3) {
						var c3 = codes[fastCharCodeAt(buf, i++)];
						bytes.set(bpos++, (c2 << 4) | (c3 >> 2));
					}
				}
				this.pos += len;
				var ret = new BytesData(bytes);
				this.cache.push(ret);
				return ret;
			case "C":
				// Not possible to implement this sadly, since we don't know how the hxUnserialize will parse the data
				throw "Not implemented yet";
				//var name = unserialize();
				//var cl = resolver.resolveClass(name);
				//if (cl == null)
				//	throw "Class not found " + name;
				//var o = Type.createEmptyInstance(cl);
				//cache.push(o);
				//o.hxUnserialize(this);
				//if (getC(pos++) != "g")
				//	throw "Invalid custom data";
				//return o;
			case "A":
				var name = this.unserialize();
				//var cl = resolver.resolveClass(name);
				//if (cl == null)
				//	throw "Class not found " + name;
				return new ClassA(name);
			case "B":
				var name = this.unserialize();
				//var e = resolver.resolveEnum(name);
				//if (e == null)
				//	throw "Enum not found " + name;
				return new EnumB(name);
			default:
		}
		this.pos--;
		throw("Invalid char " + this.buf.charAt(this.pos) + " at position " + this.pos);
	}

	static run(v) {
		return new Unserializer(v).unserialize();
	}
}

class ClassA {
	constructor(name) {
		this.name = name;
	}
}

class EnumB {
	constructor(name) {
		this.name = name;
	}
}

class BytesData {
	constructor(data) {
		this.data = data;
	}
}

class ObjectMap {
	constructor() {
		this.map = Object.create(null);
	}

	preview() {
		var addon = fancyObject(this.map);
		if(addon.length > 30)
			addon = addon.substring(0, 30) + "...";
		return addon;
	}

	get(key) {
		if(this.map.has(key)) {
			return this.map.get(key);
		}
		return null;
	}

	set(key, value) {
		this.map.set(key, value);
	}

	[Symbol.iterator]() {
		return this.map[Symbol.iterator]();
	}
}

class IntMap {
	constructor() {
		this.map = Object.create(null);
	}

	preview() {
		var addon = fancyObject(this.map);
		if(addon.length > 30)
			addon = addon.substring(0, 30) + "...";
		return addon;
	}

	get(key) {
		if(this.map.has(key)) {
			return this.map.get(key);
		}
		return null;
	}

	set(key, value) {
		this.map.set(key, value);
	}

	[Symbol.iterator]() {
		return this.map[Symbol.iterator]();
	}
}

class StringMap {
	constructor() {
		this.map = Object.create(null);
	}

	preview() {
		var addon = fancyObject(this.map);
		if(addon.length > 30)
			addon = addon.substring(0, 30) + "...";
		return addon;
	}

	set(key, value) {
		this.map[key] = value;
	}

	get(key) {
		return this.map[key];
	}

	[Symbol.iterator]() {
		return this.map[Symbol.iterator]();
	}
}

class List {
	constructor() {
		this.list = [];
	}

	preview() {
		var addon = fancyArray(this.list);
		if(addon.length > 30)
			addon = addon.substring(0, 30) + "...";
		return addon;
	}

	add(value) {
		this.list.push(value);
	}

	[Symbol.iterator]() {
		return this.list[Symbol.iterator]();
	}
}


class ExceptionData {
	constructor(data) {
		this.data = data;
	}

	preview() {
		var addon = fancyObject(this.map);
		if(addon.length > 30)
			addon = addon.substring(0, 30) + "...";
		return addon;
	}
}

class ClassData {
	constructor(name, data) {
		this.className = name;
		this.data = data;
	}

	preview() {
		if(Object.keys(this.data).length == 0) {
			return "new " + this.className + "()";
		} else {
			return "new " + this.className + "() (+data)";
		}
		//return "new " + this.name + "() { " + preview(this.data) + " }";
	}
}

const VALID_KEY_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function needsQuotes(key) {
	if(key.length == 0) return true;

	return !VALID_KEY_REGEX.test(key);
}

function fancyObject(data, includeSurrounding=true) {
	var arr = [];
	for(let key in data) {
		var value = data[key];
		key = needsQuotes(key) ? "\"" + key + "\"" : key;
		if(value == null) {
			arr.push(key + ": null");
			continue;
		}
		if(value == undefined) {
			arr.push(key + ": null"); // haxe doesn't have null, idk what happened
			console.warn("undefined in object");
			continue;
		}
		if(typeof value == "string") {
			arr.push(key + ": \"" + value + "\"");
			continue;
		}
		if(typeof value == "number") {
			arr.push(key + ": " + value);
			continue;
		}
		if(typeof value == "boolean") {
			arr.push(key + ": " + value);
			continue;
		}
		if(value instanceof List) {
			arr.push(key + ": " + fancyArray(value.list));
			continue;
		}
		if(value instanceof StringMap) {
			arr.push(key + ": " + fancyObject(value.map));
			continue;
		}
		if(value instanceof IntMap) {
			arr.push(key + ": " + fancyObject(value.map));
			continue;
		}
		if(value instanceof ObjectMap) {
			arr.push(key + ": " + fancyObject(value.map));
			continue;
		}
		// TODO: add support for bytes
		if(value instanceof Array) {
			arr.push(key + ": [" + fancyArray(value) + "]");
			continue;
		}
		if(value instanceof Object) {
			arr.push(key + ": {" + fancyObject(value) + "}");
			continue;
		}
		if(value instanceof Date) {
			arr.push(key + ": " + value.toString());
			continue;
		}
		if(value instanceof BytesData) {
			arr.push(key + ": " + value.data);
			continue;
		}
		if(value instanceof ClassData) {
			arr.push(key + ": " + value.className);
			continue;
		}
		if(value instanceof EnumInfo) {
			arr.push(key + ": " + value.preview());
			continue;
		}
		if(typeof obj == "object") {
			arr.push(key + ": " + fancyObject(value));
			continue;
		}
		arr.push(key + ": " + value);
	}
	if(includeSurrounding)
		return "{" + arr.join(", ") + "}";
	return arr.join(", ");
}

function fancyArray(data, includeSurrounding=true) {
	var arr = [];
	for(const item of data) {
		if(item == null) {
			arr.push("null");
			continue;
		}
		if(item == undefined) {
			arr.push("null"); // haxe doesn't have null, idk what happened
			console.warn("undefined in array");
			continue;
		}
		if(typeof item == "string") {
			arr.push("\"" + item + "\"");
			continue;
		}
		if(typeof item == "number") {
			arr.push(item);
			continue;
		}
		if(typeof item == "boolean") {
			arr.push(item ? "true" : "false");
			continue;
		}
		if(item instanceof List) {
			arr.push(fancyArray(item.list));
			continue;
		}
		if(item instanceof StringMap) {
			arr.push(fancyObject(item.map));
			continue;
		}
		if(item instanceof IntMap) {
			arr.push(fancyObject(item.map));
			continue;
		}
		if(item instanceof ObjectMap) {
			arr.push(fancyObject(item.map));
			continue;
		}
		if(item instanceof Array) {
			arr.push(fancyArray(item));
			continue;
		}
		if(item instanceof Object) {
			arr.push(fancyObject(item));
			continue;
		}
		if(item instanceof Date) {
			arr.push(item.toString());
			continue;
		}
		if(item instanceof BytesData) {
			arr.push(item.data);
			continue;
		}
		if(item instanceof ClassData) {
			arr.push(item.className);
			continue;
		}
		if(item instanceof EnumInfo) {
			arr.push(item.preview());
			continue;
		}
		if(typeof item == "object") {
			arr.push(fancyObject(item));
			continue;
		}
		arr.push(item);
	}
	if(includeSurrounding)
		return "[" + arr.join(", ") + "]";
	return arr.join(", ");
}

class EnumInfo {
	constructor(edecl, tag, args=null) {
		this.args = args;
		this.path = edecl;
		this.tag = tag;
	}

	preview() {
		if(this.args) {
			return this.path + "." + this.tag + "(" + fancyArray(this.args, false) + ")";
		}
		return this.path + "." + this.tag;
	}
}


function preview(data) {
	if(data && typeof data.preview == "function") {
		return data.preview();
	}
	return data;
}
class Serializer {
    constructor() {
        this.buf = [];
        this.cache = [];
        this.scache = [];
    }

    static BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%:";

    serialize(value) {
        switch (typeof value) {
            case "object":
                if (value === null) {
                    this.buf.push("n");
                } else if (Array.isArray(value)) {
                    if (this.cache.includes(value)) {
                        this.buf.push("r", this.cache.indexOf(value));
                    } else {
                        this.cache.push(value);
                        this.buf.push("a");
                        value.forEach((item) => this.serialize(item));
                        this.buf.push("h");
                    }
                } else if (value instanceof Date) {
                    this.buf.push("v", value.getTime());
                } else if (value instanceof Map) {
                    this.buf.push("b");
                    this.cache.push(value);
                    for (const [key, val] of value.entries()) {
                        this.serialize(key);
                        this.serialize(val);
                    }
                    this.buf.push("h");
                } else {
                    if (this.cache.includes(value)) {
                        this.buf.push("r", this.cache.indexOf(value));
                    } else {
                        this.cache.push(value);
                        this.buf.push("o");
                        for (const key in value) {
                            this.serialize(key);
                            this.serialize(value[key]);
                        }
                        this.buf.push("g");
                    }
                }
                break;

            case "boolean":
                this.buf.push(value ? "t" : "f");
                break;

            case "number":
                if (Number.isInteger(value)) {
                    this.buf.push("i", value);
                } else {
                    this.buf.push("d", value);
                }
                break;

            case "string":
                const index = this.scache.indexOf(value);
                if (index >= 0) {
                    this.buf.push("R", index);
                } else {
                    this.scache.push(value);
                    const encoded = encodeURIComponent(value).replace(/%20/g, "+");
                    this.buf.push("y", value.length, ":", encoded);
                }
                break;

            default:
                throw new Error(`Unsupported value type: ${typeof value}`);
        }
    }

    toString() {
        return this.buf.join("");
    }
}


module.exports = { Unserializer, Serializer, EnumInfo, ClassData, ExceptionData, BytesData, ObjectMap, IntMap, StringMap, List };