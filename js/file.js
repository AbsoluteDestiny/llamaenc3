var logger = require('../js/logging.js').logger;
var Q = require('kew');
var tmp = require('tmp');
tmp.setGracefulCleanup();

function File() {

  function setupTempFiles(llama) {
    Q.nfcall(tmp.file)
      .then(function (logpath, fd, cleanupCallback) {
        logger.log('File written successfully');
        llama.logpath(logpath);
        logpath = logpath.split("\\").join("\\\\").replace(":","\\:");
        logger.log(logpath);
        process.env['FFREPORT'] = 'file='+ logpath;
      })
      .fail(function (err) {
        logger.error('Failed to write file', err);
      })
      .end();

    Q.nfcall(tmp.dir, {mode: 0750, prefix: 'llamaenc_', unsafeCleanup: true })
      .then(function (thumbpath, cleanupCallback) {
        logger.log('File written successfully');
        logger.log(thumbpath);

        llama.thumbpath(thumbpath);
        logger.log(cleanupCallback);
        // llama.thumbpath_clean = cleanupCallback;
      })
      .fail(function (err) {
        logger.error('Failed to write file', err);
      })
      .end();
  }
  this.setupTempFiles = setupTempFiles;
}

module.exports = new File;