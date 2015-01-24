var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var Glob = require("glob").Glob;
var ffprobe = require('node-ffprobe');
var sf = require('slice-file');
var FfmpegCommand = require('fluent-ffmpeg');

FfmpegCommand.getAvailableFormats(function(err, formats) {
  console.log('Available formats:');
  console.dir(formats);
});
FfmpegCommand.getAvailableCodecs(function(err, codecs) {
  console.log('Available codecs:');
  console.dir(codecs);
});

function Check() {
  var self = this;
  ffprobe.FFPROBE_PATH = process.env['FFPROBE_PATH'];
  console.log(process.env['FFMPEG_PATH']);
  FfmpegCommand.setFfmpegPath(process.env['FFMPEG_PATH']);
  FfmpegCommand.setFfprobePath(process.env['FFPROBE_PATH']);

  function probe(llama) {
    // Scan the vid file looking for video and audio
    // If there is only video, look for audio elsewhere.
    llama.in_progress(true);
    var pr = new ffprobe(llama.vid().path(), function(err, probeData) {
      if (err) {
        llama.errorMessage(err);
        // console.log(err);
      }
      // console.log(probeData);
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
            // console.log("sar");
            // console.log(sar);
            var numerator = parseInt(sar.split(":")[0], 10);
            var denominator = parseInt(sar.split(":")[1], 10);
            if (numerator) {
              llama.vid().sourceSar(numerator/denominator);
              // console.log(numerator/denominator);
              if (_.find(llama.vid().parOptions(), {value: numerator/denominator})) {
                llama.vid().chosenPar(numerator/denominator);
              } else {
                llama.vid().chosenPar(0);
              }
              llama.vid().customPar(numerator/denominator);
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
        console.log("need audio");
        return self.findAudio(llama);
      }
      if (!hasVideo && !hasAudio) {
        var errMessage = llama.vidPath() + " has no " + missing.join(" or ") + " streams.";
        llama.errorMessage(errMessage);
      }
    });
  }
  self.probe = probe;

  function findAudio(llama) {
    // console.log("finding audio");
    // var p = llama.vid().path();
    // var searchpath = path.join(path.dirname(p), path.basename(p, path.extname(p)));
    // searchpath = searchpath.split("\\").join("/") + "!(" + path.extname(p) + ")";
    // console.log(searchpath);
    var files = _.filter(fs.readdirSync(path.dirname(p)), function(fname) {
      return _.contains(fname, path.basename(p, path.extname(p)));
    });
    if (!files.length) {
      llama.errorMessage(llama.vid().path() + " has no audio.\n\nIf your audio is in a different file, make sure the filename matches the video and has a .wav, .aiff or .m4a extension.");
      return;
    }
    // console.log("found files");
    // console.dir(files);
    _.forEach(files, function(file) {
      file = path.join(path.dirname(p), file);
      var pr = new ffprobe(file, function(err, probeData) {
        if (err || llama.vid().audioPath()) {
          console.log(err);
          return;
        }
        for (var i = probeData.streams.length - 1; i >= 0; i--) {
          var stream = probeData.streams[i];
          if (stream.codec_type === "video") {
            return;
          }
          if (stream.codec_type === "audio") {
            // console.log(file);
            // console.log(stream);
            if (!llama.vid().duration()) {
              llama.vid().data().format.duration = stream.duration;
            }
            llama.vid().audioPath(file);
            llama.vid().audioOK(true);
          }
        }
      });
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
          console.log('an error happened: ' + err.message);
          console.log(a);
          console.log(b);
          llama.errorMessage(err);
          // console.log(err);
        }
      })
      .on('progress', function(progress) {
        // console.log(progress);
        if (llama.vid().duration()) {
           var done = 100 * (convertHMS(progress.timemark) / llama.vid().duration());
           llama.currentTime(new Date());
           llama.progress(done);
        }
      })
      .on('end', function(err) {
        if (err) {
          llama.errorMessage(err);
          // console.log(err);
        }
        var xs = sf(llama.logpath());
        xs.slice(-50)
          .on('data', function (line) {
            var data = line.toString();
            // console.log(data);
            try {
              var crops = data.match(/crop=[\d]+:[\d]+:[\d]+:[\d]+/g).slice(-1)[0].split("=")[1].split(":").map(function(x) { return parseInt(x, 10); });
              // console.log(crops);
              llama.vid().cropt(crops[3]);
              llama.vid().cropl(crops[2]);
              llama.vid().cropr(llama.vid().startwidth() - (crops[0] + crops[2]));
              llama.vid().cropb(llama.vid().startheight() - (crops[1] + crops[3]));
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
              // console.log(progressive);
            } catch(e) {  }

            try {
              var tff = parseInt(data.match("Multi frame detection:[\\s]*TFF:[\\s]*([\\d]+)")[1], 10);
              llama.vid().tff(tff || 0);
              // console.log(tff);
            } catch(e) {  }

            try {
              var bff = parseInt(data.match("Multi frame detection:[TF0-9:\\s]*BFF:[\\s]*([\\d]+)")[1], 10);
              llama.vid().bff(bff || 0);
              // console.log(bff);
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