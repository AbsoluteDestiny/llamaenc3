var logger = require('../js/logging.js').logger;
var tmp = require('tmp');
var async = require('async');
var check = require("../js/check.js");
tmp.setGracefulCleanup();

function File() {

  function setupTempFiles(llama) {
    async.parallel([
        function(callback){
            tmp.file(function (err, logpath, fd, cleanupCallback) {
            if (err) throw err;
            // console.log(logpath);
            llama.logpath(logpath);
            console.log(logpath);
            logpath = logpath.split("\\").join("\\\\").replace(":","\\:");
            // logger.log(logpath);
            process.env['FFREPORT'] = 'file='+ logpath;
            llama.logpath_clean = cleanupCallback;
            callback(err, logpath);
          });
        },
        function(callback){
            tmp.dir({mode: 0750, prefix: 'llamaenc_', unsafeCleanup: true },
              function (err, thumbpath, cleanupCallback) {
                if (err) throw err;
                console.log(thumbpath);
                llama.thumbpath(thumbpath);
                llama.thumbpath_clean = cleanupCallback;
                callback(err, thumbpath);
            });
        }
    ],
    // optional callback
    function(err, results){
        // the results array will equal ['one','two'] even though
        // the second function had a shorter timeout.
        console.log(err);
        console.log(results);
        check.probe(llama);
    });

  }
  this.setupTempFiles = setupTempFiles;
}

module.exports = new File;