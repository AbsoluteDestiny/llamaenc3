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
    // if (vid.sourceSar() != vid.par()) {
    //   // set par
    //   vfilters.push({
    //     filter: 'setsar',
    //     options: vid.par()
    //   });
    // }
    // -ac 2 -strict experimental -ab 160k -s {ssize} -vcodec libx264 -preset slow -profile:v baseline -level 30 -maxrate 10000000 -bufsize 10000000 -b 1200k
    // --ref 4 --qpmin 4
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
    // var bitrate = Math.ceil((2.3438 * vid.width()) + 1500);
    // y = 1832.2ln(x) - 20154
    // var bitrate = Math.ceil(1832.2 * Math.log(vid.width() * vid.height()) - 20154);
    //y = 66.551x0.3147
    var bitrate = Math.ceil(66.551 * Math.pow(vid.width() * vid.height(), 0.3147));
    // var bitrate = Math.ceil(30.489 * Math.pow(vid.width() * vid.height(), 0.3633));
    var bufsize = 2 * bitrate;
    var maxrate = Math.max(10000, bitrate);
    // console.log(bitrate);
    pass1.addOptions('-preset medium')
      .addOptions('-pix_fmt yuv420p')
      .addOptions('-profile:v high')
      .addOptions('-level 4.0')
      // .addOptions(vid.width() > 1280 ? '-crf 20' : vid.width() > 640 ? '-crf 19' : '-crf 18')
      // .addOptions('-crf 18')
      .addOptions('-maxrate '+ maxrate + 'k')
      .addOptions('-b:v ' +  bitrate + 'k')
      .addOptions('-bufsize ' +  bufsize + 'k')
      // .addOptions(vid.width() > 1280 ? '-b:v 6000k' : vid.width() > 848 ? '-b:v 4500k' : '-b:v 3000k')
      // .addOptions(vid.width() > 1280 ? '-bufsize 12000k' : vid.width() > 848 ? '-bufsize 9000k' : '-bufsize 6000k')
      // .addOptions('-b:v 5500k')
      .addOptions('-x264-params ref=4:qpmin=4')
      .addOptions('-movflags +faststart');
      // .addOptions('-bufsize 10000000')
      // .addOptions('-maxrate 10000000')
      // 
      // set audio codec options
      if (llama.vid().audioPath()) {
        pass1.input(llama.vid().audioPath());
      }
      pass1.audioCodec('aac')
      .addOptions('-strict experimental')
      .audioBitrate(320)
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
      // .addOptions("-metadata", "album='"  + vid.vidshow() || "Vidding")
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
           // $("#progress").css('width', done + "%");
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