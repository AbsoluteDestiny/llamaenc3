var Q = require('kew');
var tmp = require('tmp');
tmp.setGracefulCleanup();

// var $ = require('jquery');
// var probe = require('node-ffprobe');

// var llama = llama || {
//   version: "0.1"
// };

// var finalout = null;

// var FfmpegCommand = require('fluent-ffmpeg');
// FfmpegCommand.setFfmpegPath("../bin/ffmpeg.exe");
// FfmpegCommand.setFfprobePath("../bin/ffprobe.exe");

// // FfmpegCommand.getAvailableFormats(function(err, formats) {
// //   console.log('Available formats:');
// //   console.dir(formats);
// // });

// // FfmpegCommand.getAvailableCodecs(function(err, codecs) {
// //   console.log('Available codecs:');
// //   console.dir(codecs);
// // });

// function convertHMS(hms) {
//   var a = hms.split(':'); // split it at the colons
//   // minutes are worth 60 seconds. Hours are worth 60 minutes.
//   var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
//   return seconds;
// }

// function on_probe(err, probeData) {
//   if (err) {
//     return;
//   }
//   llama.vid.probe = probeData;
//   llama.vid.duration = probeData.format.duration;
//   llama.vid.hasvideo = false;
//   llama.vid.hasaudio = false;
  
//   // Look for usable streams
//   for (var i = probeData.streams.length - 1; i >= 0; i--) {
//     if (probeData.streams[i].codec_type == "video") {
//       llama.vid.hasvideo = true;
//     }
//     if (probeData.streams[i].codec_type == "audio") {
//       llama.vid.hasaudio = true;
//     }
//   }
//   var logfile = tmp.file(on_logfile_made);
//   }

// function on_logfile_made(err, logpath, fd, cleanupCallback) {
//   if (err) throw err;
//   llama.logfile = {};
//   llama.logfile.path = logpath;
//   llama.logfile.cleanup = cleanupCallback;
//   process.env['FFREPORT'] = 'file='+ logpath + ':level=32';
//   var thumbdir = tmp.dir({ mode: 0750, prefix: 'myTmpDir_', unsafeCleanup: true }, on_thumbdir_made);
// }

// function on_thumbdir_made(err, thumbpath, cleanupCallback) {
//   llama.thumbdir = {};
//   llama.thumbdir.path = thumbpath;
//   llama.thumbdir.cleanup = cleanupCallback;
//   pre_process_vid();
// }

// function pre_process_vid() {
//   var command = new FfmpegCommand(llama.vid.path);
//   command.addOption('-report')
//     .output('-')
//     .format(null)
//     .videoFilters([
//       {
//         filter: 'idet'
//       },
//       {
//         filter: 'cropdetect',
//         options: "24:2:0"
//       }
//     ])
//     .complexFilter([
//       {
//         filter: 'ebur128',
//         options: {'peak': true}
//       }
//     ])
//     .output(llama.thumbdir.path + '\\out%05d.png')
//     .format('image2')
//     .fps(0.15)
//     .on('start', function() {
//       $("#open").hide();
//     })
//     .on('error', function(err) {
//       console.log('an error happened: ' + err.message);
//     })
//     .on('progress', function(progress) {
//       if (llama.vid.duration) {
//          var done = 100 * (convertHMS(progress.timemark) / llama.vid.duration);
//          $("#progress").css('width', done + "%");
//       }
//     })
//     .on('end', function(err) {
//       var sf = require('slice-file');
//       var xs = sf('out.txt');
//       xs.slice(-50)
//         .on('data', function (line) {
//           var data = line.toString();
//           console.log(data);
//             try {
//               llama.vid.crops = data.match(/crop=[\d]+:[\d]+:[\d]+:[\d]+/g).slice(-1)[0].split("=")[1].split(":").map(function(x) { return parseInt(x, 10); });
//             } catch(e) {}

//             try {
//               llama.vid.lufs = -11.0 - data.match(/[\s]+I:[\s]+([\d-.]+)/).splice(-1)[0];
//             } catch(e) {}

//             try {
//               llama.vid.progressive = parseInt(data.match("Multi frame detection: [TBF0-9: ]+Progressive:([\\d]+)")[1], 10);
//             } catch(e) {}

//             try {
//               llama.vid.tff = parseInt(data.match("Multi frame detection: TFF:([\\d]+)")[1], 10);
//             } catch(e) {}

//             try {
//               llama.vid.bff = parseInt(data.match("Multi frame detection: [TF0-9: ]+BFF:([\\d]+)")[1], 10);
//             } catch(e) {}
//         })
//         .on('end', function() {
//           console.log(err);
//           console.log(llama.vid.crops);
//           console.log(llama.vid.lufs);
//           console.log(llama.vid.tff);
//           console.log(llama.vid.bff);
//           console.log(llama.vid.progressive);
//           fs.readdir(llama.thumbdir.path, function(err, files) {
//             llama.vid.thumbnails = files;
//             pre_process_complete();
//           });
//         });
//     })
//     .run();
// }

// function pre_process_complete() {

// }

// function analyse(path) {
//   llama.vid = llama.vid || {};
//   llama.vid.path = path;
//   var pr = new probe(path, on_probe);
// }

function File() {
  // function open(path, document) {
  //   analyse(path);
    

  //   // var track = '/path/to/media/file.mp3';

  //   // probe(path, function(err, probeData) {
  //   //     console.log(probeData);
  //   //     vdata = probeData;
  //   //     vduration = probeData.format.duration;
  //   //     FfmpegCommand(path)
  //   //     .on('end', function(files) {
  //   //       console.log('screenshots were saved as ' + files);
  //   //     })
  //   //     .on('error', function(err) {
  //   //       console.log('an error happened: ' + err.message);
  //   //     })
  //   //     .screenshots({
  //   //       timestamps: [vduration * 0.1, vduration * 0.2, vduration * 0.3, vduration * 0.8],
  //   //       filename: '%i.png',
  //   //       folder: './thumbnails',
  //   //       });
  //   // });
    


  //   // FfmpegCommand(path)
  //   //     .screenshots({
  //   //       // Will take screens at 20%, 40%, 60% and 80% of the video
  //   //       count: 4,
  //   //       folder: 'D:/Repos/git/llamaenc3/nw/screens'
  //   //     });
  // }
  
  // this.open = open;

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
        console.log('Failed to write file', err);
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
        console.log('Failed to write file', err);
      })
      .end();
  }
  this.setupTempFiles = setupTempFiles;
}

module.exports = new File;