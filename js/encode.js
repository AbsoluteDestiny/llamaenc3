var check = require('../js/check.js');
var FfmpegCommand = require('fluent-ffmpeg');
var logger = require('../js/logging.js').logger;

function Encode() {
  function make_mp4(llama) {
    var vid = llama.vid();

    // Update the database of vidders
    llama.saveVidder();


    var vfilters = [];
    var NUL = "/dev/null";
    if (process.platform === "win32") {
      NUL = "NUL";
    }
    // deinterlace
    if (vid.fo_choice() != "progressive") {
      vfilters.push({
          filter: 'yadif',
          options: 'parity=' + vid.fo_choice() == "tff" ? 0 : 1
        });
    }
    // crop
    if (vid.do_crop()) {
      var crop = vid.crop();
      // logger.log(crop);
      vfilters.push({
        filter: 'crop',
        options: crop
      });
    }

    var pass1 = new FfmpegCommand();
      llama.ffcancel = pass1.kill;
      pass1.input(vid.path())
      .videoFilters(vfilters)
      .addOptions('-sws_flags spline')
      // set video codec options
      // -preset fast -profile:v high -level 4.1 -crf 16-coder 0 -movflags +faststart -y
      .videoCodec('libx264')
      // .videoBitrate('1200k')
      .size(vid.finalsize());
      if (vid.sourceFPS() > 30) {
        pass1.videoFilters([
            {
              filter: 'fps',
              options: "fps=ntsc"
            }
          ]);
      }

    var bitrate = Math.ceil(66.551 * Math.pow(vid.width() * vid.height(), 0.3147));

    var bufsize = 2 * bitrate;
    var maxrate = Math.max(10000, bitrate);

    pass1.addOptions('-preset medium')
      .addOptions('-pix_fmt yuv420p')
      .addOptions('-profile:v high')
      .addOptions('-level 4.0')
      .addOptions('-maxrate '+ maxrate + 'k')
      .addOptions('-b:v ' +  bitrate + 'k')
      .addOptions('-bufsize ' +  bufsize + 'k')
      .addOptions('-x264-params ref=4:qpmin=4')
      .addOptions('-movflags +faststart');

      // set audio codec options
      if (llama.vid().audioPath()) {
        pass1.input(llama.vid().audioPath());
      }

      if (process.platform == "win32" || (process.arch == "x64" && process.platform == "darwin")) {
        pass1.audioCodec('libfdk_aac')
        .audioBitrate(256);
      } else {
        pass1.audioCodec('aac')
        .addOptions('-strict experimental')
        .audioBitrate(192);
      }
      pass1.audioChannels(2)
      .audioFrequency(48000)
      .audioFilters('volume=' + vid.lufs() + 'dB')
      
      // set metadata
      .format('mp4')
      .addOptions("-metadata", "title="  + vid.title().trim().split("'").join("\'"));
      if (!vid.anonymous()) {
        pass1.addOptions("-metadata", "artist="  + vid.vidder().trim().split("'").join("\'"));
      }
      if (llama.vidshow()) {
        pass1.addOptions("-metadata", "year="  + llama.vidshow().con_year)
        .addOptions("-metadata", "show="  + llama.showname().trim().split("'").join("\'"))
        .addOptions("-metadata", "network=VividCon");
      }
      pass1
      .addOptions("-metadata", "grouping=LlamaEnc3.0_api1_" + vid.silence_start() + "_" + vid.silence_end())
      // event callbacks
      .on('error', function(err, a, b) {
        logger.error(err.message);
        logger.log(a);
        logger.log(b);
      });
    var pass2 = pass1.clone()
      .addOptions('-pass 2')
      .output(llama.outPath())
      .on('start', function() {
        // console.log("pass 1 done in:");
        // console.log(new Date() - llama.startTime());
      })
      .on('progress', function(progress) {
        if (vid.duration()) {
           var done = 30 + (70 * (check.convertHMS(progress.timemark) / vid.duration()));
           llama.currentTime(new Date());
           llama.progress(done);
        }
      })
      .on('end', function(err) {
        if (err) {
          logger.error(err);
        } else {
          // console.log("both passes done in:");
          // console.log(new Date() - llama.startTime());
          llama.in_progress(false);
          llama.steps()[4].done(true);
          llama.step(100);
        }
      });
    pass1
      .addOptions('-pass 1')
      .output(NUL)
      .on('start', function() {
        llama.in_progress(true);
        llama.startTime(new Date());
      })
      .on('progress', function(progress) {
        if (vid.duration()) {
           var done = 30 * (check.convertHMS(progress.timemark) / vid.duration());
           llama.currentTime(new Date());
           llama.progress(done);
        }
      })
      .on('end', function(err) {
        if (err) {
          logger.error(err);
        } else {
          pass2.run();
        }
      })
      .run();
  }
  this.make_mp4 = make_mp4;
}

module.exports = new Encode;