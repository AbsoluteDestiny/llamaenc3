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
      .videoCodec('libx264')
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

    pass1.addOptions('-preset slow')
      .addOptions('-pix_fmt yuv420p')
      .addOptions('-profile:v high')
      .addOptions('-level 4.0')
      .addOptions('-maxrate '+ maxrate + 'k')
      .addOptions('-crf 18')
      .addOptions('-movflags +faststart');

      // set audio codec options
      if (llama.vid().audioPath()) {
        pass1.input(llama.vid().audioPath());
      }

      pass1.audioCodec('aac')
      .audioBitrate(256)
      .audioChannels(2)
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
      .addOptions("-metadata", "grouping=LlamaEnc3.3_api2_" + vid.silence_start() + "_" + vid.silence_end())
      .output(llama.outPath())
      // event callbacks
      .on('start', function() {
        llama.in_progress(true);
        llama.startTime(new Date());
      })
      .on('error', function(err, a, b) {
        logger.error(err.message);
        logger.log(a);
        logger.log(b);
      })
      .on('progress', function(progress) {
        if (vid.duration()) {
           var done = 100 * (check.convertHMS(progress.timemark) / vid.duration());
           llama.currentTime(new Date());
           llama.progress(done);
        }
      })
      .on('end', function(err) {
        if (err) {
          logger.error(err);
        } else {
          llama.in_progress(false);
          llama.steps()[4].done(true);
          llama.step(100);
        }
      })
      .run();
  }
  this.make_mp4 = make_mp4;
}

module.exports = new Encode;