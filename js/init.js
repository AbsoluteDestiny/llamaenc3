var fs = require('fs');
var path = require('path');

var Init = function() {
	function start() {
		var platform = process.platform;
		var arch = process.arch;
		var ext = "";
		if (platform === "win32") {
			ext = ".exe";
		}
		
		if (platform !== "win32" || platform !== "darwin") {
			var basepath = path.join(__dirname, "..");
			// console.log(path.join(basepath, "ffmpeg" + ext));
			if (!fs.existsSync(path.join(basepath, "ffmpeg" + ext))) {
				basepath = path.dirname(process.execPath);
				// console.log(path.join(basepath, "ffmpeg" + ext));
				if (!fs.existsSync(path.join(basepath, "ffmpeg" + ext))) {
					throw "I can't find the ffmpeg binaries!";
				}
			}
			process.env.PATH = process.env['path'] + path.delimiter + basepath + path.sep;
			process.env['FFMPEG_PATH'] = path.join(basepath, "ffmpeg" + ext);
			process.env['FFPROBE_PATH'] = path.join(basepath, "ffprobe" + ext);
		}
	}
	this.start = start;
};

module.exports = new Init;