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
    // fade
    if (vid.do_fade()) {
      if (vid.fade_start()) {
        var fadestart = 0;
        if (vid.do_trim()) {
          fadestart = (new Date('1970-01-01T' + vid.custom_start() + 'Z').getTime() / 1000);
        }
        vfilters.push({
          filter: 'fade',
          options: {
            t: 'in',
            st: fadestart,
            d: parseFloat(vid.fade_start())
          }
        });
      }
      if (vid.fade_end()) {
        var fadeend = vid.duration() - vid.fade_end();
        if (vid.do_trim()) {
          fadeend = (new Date('1970-01-01T' + vid.custom_end() + 'Z').getTime() / 1000) - vid.fade_end();
        }
        vfilters.push({
          filter: 'fade',
          options: {
            t: 'out',
            st: fadeend,
            d: parseFloat(vid.fade_end())
          }
        });
      }
    }

    // par
    vfilters.push('setsar=1/1');
    vfilters.push('setdar=' +  vid.finalsize().replace('x', '/'));
    console.log('vfilters', vfilters);

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
      .audioFilters('volume=' + vid.lufs() + 'dB');
      // fade
      var afilters = [];
      if (vid.do_fade()) {
        if (vid.fade_start()) {
          var fadestart = 0;
          if (vid.do_trim()) {
            fadestart = (new Date('1970-01-01T' + vid.custom_start() + 'Z').getTime() / 1000);
          }
          afilters.push({
            filter: 'afade',
            options: {
              t: 'in',
              st: fadestart,
              d: parseFloat(vid.fade_start())
            }
          });
        }
        if (vid.fade_end()) {
          var fadeend = vid.duration() - vid.fade_end();
          if (vid.do_trim()) {
            fadeend = (new Date('1970-01-01T' + vid.custom_end() + 'Z').getTime() / 1000) - vid.fade_end();
          }
          afilters.push({
            filter: 'afade',
            options: {
              t: 'out',
              st: fadeend,
              d: parseFloat(vid.fade_end())
            }
          });
        }
      }
      if (afilters.length) {
        pass1.audioFilters(afilters);
      }
      // set metadata
      pass1.format('mp4')
      .addOptions("-metadata", "title="  + vid.title().trim().split("'").join("\'"));
      if (!vid.anonymous()) {
        pass1.addOptions("-metadata", "artist="  + vid.vidder().trim().split("'").join("\'"));
      }
      if (llama.vidshow()) {
        pass1.addOptions("-metadata", "year="  + llama.vidshow().con_year)
        .addOptions("-metadata", "show="  + llama.showname().trim().split("'").join("\'"))
        .addOptions("-metadata", "network=VividCon");
      }
      var silence_start = vid.silence_start();
      var silence_end = vid.silence_end();
      if (llama.vid().do_trim()) {
        silence_start -= (new Date('1970-01-01T' + vid.custom_start() + 'Z').getTime() / 1000);
        silence_end -= vid.duration() - (new Date('1970-01-01T' + vid.custom_end() + 'Z').getTime() / 1000)
      }
      // console.log('silence');
      // console.log(vid.silence_start(), silence_start);
      // console.log(vid.silence_end(), silence_end);
      pass1
      .addOptions("-metadata", "grouping=LlamaEnc3.3_api2_" + silence_start + "_" + silence_end)
      .output(llama.outPath());
      // set trim and fade
      if (llama.vid().do_trim()) {
        var real_end = (new Date('1970-01-01T' + vid.custom_end() + 'Z').getTime() / 1000) - (new Date('1970-01-01T' + vid.custom_start() + 'Z').getTime() / 1000);
        console.log('trim vid', llama.vid().custom_start(), real_end)
        // console.log(real_end);
        pass1.duration(real_end)
        .seek(llama.vid().custom_start());
      }
      if (llama.vid().do_fade()) {

      }
      // event callbacks
      pass1.on('start', function() {
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