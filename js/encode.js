var check = require('../js/check.js');
var FfmpegCommand = require('fluent-ffmpeg');
var logger = require('../js/logging.js').logger;

function Encode() {
  function make_mp4(llama) {
    var vid = llama.vid();
    var vfilters = [];
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
    var command = new FfmpegCommand();
      llama.ffcancel = command.kill;
      command.input(vid.path())
      .output(llama.outPath())
      .videoFilters(vfilters)
      .addOptions('-sws_flags spline')
      // set video codec options
      // -preset fast -profile:v high -level 4.1 -crf 16-coder 0 -movflags +faststart -y
      .videoCodec('libx264')
      // .videoBitrate('1200k')
      .size(vid.finalsize());
      if (vid.sourceFPS() > 30) {
        command.videoFilters([
            {
              filter: 'fps',
              options: "fps=ntsc"
            }
          ]);
      }
    command.addOptions('-preset medium')
      .addOptions('-pix_fmt yuv420p')
      .addOptions('-profile:v high')
      .addOptions('-level 4.1')
      .addOptions(vid.width() > 1280 ? '-crf 22' : vid.width() > 640 ? '-crf 20' : '-crf 18')
      .addOptions('-x264-params ref=4:qpmin=4')
      .addOptions('-movflags +faststart');
      // .addOptions('-bufsize 10000000')
      // .addOptions('-maxrate 10000000')
      // 
      // set audio codec options
      if (llama.vid().audioPath()) {
        command.input(llama.vid().audioPath());
      }
      command.audioCodec('aac')
      .addOptions('-strict experimental')
      .audioBitrate(160)
      .audioChannels(2)
      .audioFrequency(48000)
      .audioFilters('volume=' + vid.lufs() + 'dB')
      
      // set metadata
      .format('mp4')
      .addOptions("-metadata", "title="  + vid.title().trim().split("'").join("\'"));
      if (!vid.anonymous()) {
        command.addOptions("-metadata", "artist="  + vid.vidder().trim().split("'").join("\'"));
      }
      if (llama.vidshow()) {
        command.addOptions("-metadata", "year="  + llama.vidshow().con_year)
        .addOptions("-metadata", "show="  + llama.showname().trim().split("'").join("\'"))
        .addOptions("-metadata", "network=VividCon");
      }
      command
      // .addOptions("-metadata", "album='"  + vid.vidshow() || "Vidding")
      .addOptions("-metadata", "grouping=LlamaEnc3.0")
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
           // $("#progress").css('width', done + "%");
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