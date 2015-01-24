var Q = require('kew');
var tmp = require('tmp');
tmp.setGracefulCleanup();

function File() {

  function setupTempFiles(llama) {
    Q.nfcall(tmp.file)
      .then(function (logpath, fd, cleanupCallback) {
        // console.log('File written successfully');
        llama.logpath(logpath);
        logpath = logpath.split("\\").join("\\\\").replace(":","\\:");
        // console.log(logpath);
        process.env['FFREPORT'] = 'file='+ logpath;
        // llama.logpath_clean = cleanupCallback;
      })
      .fail(function (err) {
        if (err) {
          llama.errorMessage(err);
          console.log(err);
        }
        // console.log('Failed to write file', err);
      })
      .end();

    Q.nfcall(tmp.dir, {mode: 0750, prefix: 'llamaenc_', unsafeCleanup: true })
      .then(function (thumbpath, cleanupCallback) {
        // console.log('File written successfully');
        // console.log(thumbpath);

        llama.thumbpath(thumbpath);
        // console.log(cleanupCallback);
        // llama.thumbpath_clean = cleanupCallback;
      })
      .fail(function (err) {
        if (err) {
          llama.errorMessage(err);
          // console.log(err);
        }
        console.log('Failed to write file', err);
      })
      .end();
  }
  this.setupTempFiles = setupTempFiles;
}

module.exports = new File;