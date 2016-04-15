var logger = require('../js/logging.js').logger;
var temp = require('temp');
temp.track();
var check = require("../js/check.js");

function File() {

  function setupTempFiles(llama) {
    temp.cleanupSync();
    var logpath = temp.openSync('le3').path;
    var thumbpath = temp.mkdirSync('le3');
    llama.logpath(logpath);
    console.log(logpath);
    logpath = logpath.split("\\").join("\\\\").replace(":","\\:");
    console.log(logpath);
    process.env['FFREPORT'] = 'file='+ logpath;
    llama.thumbpath(thumbpath);

  }
  this.setupTempFiles = setupTempFiles;
}

module.exports = new File;