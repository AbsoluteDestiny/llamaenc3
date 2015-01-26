var _ = require('lodash');
var async = require('async');
var FfmpegCommand = require('fluent-ffmpeg');
var ffprobe = require('node-ffprobe');
var fs = require('fs');

var logger = require('../js/logging.js').logger;
var path = require('path');
var sf = require('slice-file');

FfmpegCommand.getAvailableFormats(function(err, formats) {
  logger.log('Available formats:');
  logger.log(formats);
});
FfmpegCommand.getAvailableCodecs(function(err, codecs) {
  logger.log('Available codecs:');
  logger.log(codecs);
});

function Check() {
  var self = this;
  if (process.platform !== "win32" || process.platform !== "darwin") {
    ffprobe.FFPROBE_PATH = process.env['FFPROBE_PATH'];
    logger.log(process.env['FFMPEG_PATH']);
    FfmpegCommand.setFfmpegPath(process.env['FFMPEG_PATH']);
    FfmpegCommand.setFfprobePath(process.env['FFPROBE_PATH']);
  }

  function probe(llama) {
    // Scan the vid file looking for video and audio
    // If there is only video, look for audio elsewhere.
    llama.in_progress(true);
    var pr = new ffprobe(llama.vid().path(), function(err, probeData) {
      if (err) {
        // llama.errorMessage(err);
        logger.error(err);
      }
      logger.log(probeData);
      if (probeData.format && probeData.format.format_name) {
        probeData.format.format_name = probeData.format.format_name.split(",").join(" ");
      }
      llama.vid().data(probeData);
      llama.in_progress(true);
      // Do we have both a video and an audio stream?
      var hasVideo = false;
      var hasAudio = false;
      var missing = [];
      for (var i = llama.vid().data().streams.length - 1; i >= 0; i--) {
        var stream = llama.vid().data().streams[i];
        if (stream.codec_type === "video") {
          hasVideo = true;
          llama.vid().startwidth(parseInt(stream.width, 10));
          llama.vid().startheight(parseInt(stream.height, 10));
          llama.vid().nframes = stream.nb_frames;
          var fps = stream.r_frame_rate;
          if (fps) {
            var fnumerator = parseInt(fps.split("/")[0], 10);
            var fdenominator = parseInt(fps.split("/")[1], 10);
            llama.vid().sourceFPS(fnumerator/fdenominator);
          }
          var sar = stream.sample_aspect_ratio;
          if (sar) {
            logger.log("sar");
            logger.log(sar);
            logger.log(llama.vid().startwidth());
            var numerator = parseInt(sar.split(":")[0], 10);
            var denominator = parseInt(sar.split(":")[1], 10);
            if (llama.vid().startwidth() === 720 && (llama.vid().height() === 480 || llama.vid().height() === 576) ) {
              // This is probably a standard def video and we should crop it to 704.
              llama.vid().cropTo704(true);
            }
            // Ffmpeg has opinions on the SAR, lets see if they match ours...
            if (numerator) {
              llama.vid().sourceSar(numerator/denominator);
              logger.log(numerator/denominator);
              var parmatch = null;
              if (llama.vid().startwidth() === 720) {
                parmatch = _.find(llama.vid().parOptions(), {ffmpeg: numerator/denominator});
                if (parmatch) {
                  llama.vid().chosenPar(parmatch.value);
                }
              } else {
                // It's not a 720x vid but it still has a par, let's set it...
                parmatch = _.find(llama.vid().parOptions(), {value: numerator/denominator});
                if (parmatch) {
                  llama.vid().chosenPar(parmatch.value);
                } else {
                  llama.vid().chosenPar(0);
                }
                llama.vid().customPar(numerator/denominator);
              }
            } else {
              // FFmpeg doesnt know so make best guess based on vid dimensions, preferring 4:3
              if (llama.vid().startwidth() === 720 && llama.vid().height() === 480) {
                llama.vid().chosenPar(10/11);
              }
              if (llama.vid().startwidth() === 720 && llama.vid().height() === 576) {
                llama.vid().chosenPar(12/11);
              }
            }
          }
          llama.vid().videoOK(true);
        } else {
          missing.push("Video");
        }
        if (stream.codec_type === "audio") {
          hasAudio = true;
          llama.vid().audioOK(hasAudio);
        }
      }
      if (hasVideo && !hasAudio) {
        missing.push("Audio");
        logger.log("need audio");
        return self.findAudio(llama);
      } else if (!hasVideo && hasAudio) {
        var errMessage = llama.vidPath() + " has no " + missing.join(" or ") + " streams.";
        logger.warn(errMessage);
      }
    });
  }
  self.probe = probe;

  function findAudio(llama) {
    logger.log("finding audio");
    var p = llama.vid().path();
    logger.log(p);
    var files = _.chain(fs.readdirSync(path.dirname(p)))
      .filter(function(fname) {
         return _.contains(fname, path.basename(p, path.extname(p)));
       })
      .map(function(file) { return path.join(path.dirname(p), file);})
      .value();
    logger.log(files);
    if (!files || !files.length) {
      logger.warn(llama.vid().path() + " has no audio.\n\nIf your audio is in a different file, make sure the filename matches the video but with a different extension.");
      return;
    }
    logger.log("found files");
    async.map(files, function(file, callback) {
      ffprobe(file, function(err, result) {
        callback(null, result);
      });
    },
      function(err, results) {
      for (var i = 0; i < results.length; i++) {
        var result = results[i];
        // logger.log(result);
        if (!result) {
          continue;
        }
        for (var j = 0; j < result.streams.length; j++) {
          var stream = result.streams[j];
          console.log(stream);
          if (stream.codec_type === "video") {
            continue;
          }
          if (stream.codec_type === "audio") {
            if (!llama.vid().duration()) {
              llama.vid().data().format.duration = stream.duration;
            }
            llama.vid().audioData(result);
            llama.vid().audioPath(result.file);
            llama.vid().audioOK(true);
          }
        }
      }
      if (!llama.vid().audioOK()) {
        logger.warn(llama.vid().path() + " has no audio.\n\nIf your audio is in a different file, make sure the filename matches the video but with a different extension.");
      }
    });
  }
  self.findAudio = findAudio;

  function convertHMS(hms) {
    var a = hms.split(':'); // split it at the colons
    // minutes are worth 60 seconds. Hours are worth 60 minutes.
    var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
    return seconds;
  }
  self.convertHMS = convertHMS;

  function scan(llama) {
    var command = new FfmpegCommand();
    llama.ffcancel = command.kill;
    command.input(llama.vid().path())
      .addOption('-report')
      // .addOptions('-skip_frame nokey')
      .output('-')
      .format(null)
      .videoFilters([
        {
          filter: 'idet'
        },
        {
          filter: 'cropdetect',
          options: "24:2:0"
        }
      ]);
    if (llama.vid().audioPath()) {
      command.input(llama.vid().audioPath());
    }
    command.complexFilter([
        {
          filter: 'ebur128',
          options: {'peak': true}
        }
      ])
      .output(llama.thumbpath() + '\\out%04d.png')
      .format('image2');
      if (llama.vid().duration()) {
        command.seek(Math.floor(llama.vid().duration()/10));
        command.videoFilters([
          {
            filter: 'fps',
            options: "fps=10/" + Math.floor(llama.vid().duration()) + ":round=down"
          }
        ]);
      } else {
        command.videoFilters([
          {
            filter: 'fps',
            options: "fps=0.1"
          }
        ]);
      }
      // .addOptions("-vf select=eq(pict_type\\,I)*not(mod(n\\,100))")
      // .addOptions("-vf select=eq(pict_type\\,I)")
      // .addOptions("-vf select=not(mod(n\\,5))")
      // .addOptions("-vsync 0")
      // .fps(12 / llama.vid().duration()) // Create ~12 screenshots
      // .addOptions("-vsync 0")
      // .fps(0.5) // choose every other I frame
      // .addOptions('-qscale:v 2')
      command.on('start', function() {
        // $("#open").hide();
        llama.startTime(new Date());
      })
      .on('error', function(err, a, b) {
        if (err) {
          // logger.log('an error happened: ' + err.message);
          logger.log(a);
          logger.log(b);
          logger.error(err);
        }
      })
      .on('progress', function(progress) {
        // logger.log(progress);
        if (llama.vid().duration()) {
           var done = 100 * (convertHMS(progress.timemark) / llama.vid().duration());
           llama.currentTime(new Date());
           llama.progress(done);
        }
      })
      .on('end', function(err) {
        if (err) {
          logger.error(err);
        }
        var xs = sf(llama.logpath());
        xs.slice(-50)
          .on('data', function (line) {
            var data = line.toString();
            logger.log(data);
            try {
              var crops = data.match(/crop=[\d]+:[\d]+:[\d]+:[\d]+/g).slice(-1)[0].split("=")[1].split(":").map(function(x) { return parseInt(x, 10); });
              logger.log(crops);
              llama.vid().suggestCropt(crops[3]);
              llama.vid().cropt(llama.vid().suggestCropt());
              llama.vid().suggestCropl(crops[2]);
              llama.vid().cropl(llama.vid().suggestCropl());
              llama.vid().suggestCropr(llama.vid().startwidth() - (crops[0] + crops[2]));
              llama.vid().cropr(llama.vid().suggestCropr());
              llama.vid().suggestCropb(llama.vid().startheight() - (crops[1] + crops[3]));
              llama.vid().cropb(llama.vid().suggestCropb());
              llama.vid().do_crop(true);
            } catch(e) {  }

            try {
              var lufs = -16.0 - data.match(/[\s]+I:[\s]+([\d-.]+)/).splice(-1)[0];
              if (lufs && Math.abs(lufs) > 1) {
                llama.vid().lufs(lufs);
              }
            } catch(e) {  }

            try {
              var progressive = parseInt(data.match("Multi frame detection:[TBF0-9:\\s]*Progressive:[\\s]*([\\d]+)")[1], 10);
              llama.vid().progressive(progressive || 0);
              logger.log(progressive);
            } catch(e) {  }

            try {
              var tff = parseInt(data.match("Multi frame detection:[\\s]*TFF:[\\s]*([\\d]+)")[1], 10);
              llama.vid().tff(tff || 0);
              logger.log(tff);
            } catch(e) {  }

            try {
              var bff = parseInt(data.match("Multi frame detection:[TF0-9:\\s]*BFF:[\\s]*([\\d]+)")[1], 10);
              llama.vid().bff(bff || 0);
              logger.log(bff);
            } catch(e) {  }
          })
          .on('end', function() {
            if (llama.vid().tff() + llama.vid().bff() + llama.vid().progressive() > 0) {
                if (llama.vid().tff() > llama.vid().bff() && llama.vid().tff() > llama.vid().progressive()) {
                    llama.vid().suggest_fo("tff");
                } else if (llama.vid().bff() > llama.vid().tff() && llama.vid().bff() > llama.vid().progressive()) {
                    llama.vid().suggest_fo("bff");
                } else {
                  llama.vid().suggest_fo("progressive");
                }
            } else {
                llama.vid().suggest_fo("progressive");
            }
            fs.readdir(llama.thumbpath(), function(err, files) {
              llama.vid().thumbnails.removeAll();
              llama.vid().thumbnails(files);
              llama.vid().currentThumbIdx(Math.floor(files.length / 2));
              llama.vid().scanned_ok(true);
              llama.in_progress(false);
              llama.progress(0);
              llama.step(1);
            });
          });
      })
      .run();
  }
  this.scan = scan;
}

module.exports = new Check;