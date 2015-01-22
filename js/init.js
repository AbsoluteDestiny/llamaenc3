var path = require('path');

var Init = function() {
	function start() {
		// console.log(process.env['path']);
		// console.log(__dirname);
		var platform = process.platform;
		var arch = process.arch;
		var ext = "";
		process.env.PATH = process.env['path'] + path.delimiter + path.join(__dirname, ".." + path.sep + "bin" + path.sep + platform + path.sep + arch);
		if (platform === "win32") {
			ext = ".exe";
		}
		process.env['FFMPEG_PATH'] = path.join(__dirname, ".." + path.sep + "bin" + path.sep + platform + path.sep + arch + path.sep + "ffmpeg" + ext);
		process.env['FFPROBE_PATH'] = path.join(__dirname, ".." + path.sep + "bin" + path.sep + platform + path.sep + arch + path.sep + "ffprobe" + ext);
	}
	this.start = start;
};

module.exports = new Init;