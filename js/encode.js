var FfmpegCommand = require('fluent-ffmpeg');
var check = require('../js/check.js');

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
      console.log(crop);
      vfilters.push({
        filter: 'crop',
        options: crop
      });
    }
    // set par
    vfilters.push({
      filter: 'setsar',
      options: vid.par()
    });
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
      .size(vid.finalsize())
      .addOptions('-preset medium')
      .addOptions('-profile:v high')
      .addOptions('-level 4.1')
      .addOptions(vid.width() > 1280 ? '-crf 22' : vid.width() > 640 ? '-crf 20' : '-crf 18')
      .addOptions('-x264-params ref=4:qpmin=4')
      .addOptions('-movflags +faststart')
      // .addOptions('-bufsize 10000000')
      // .addOptions('-maxrate 10000000')
      // 
      // set audio codec options
      .audioCodec('aac')
      .addOptions('-strict experimental')
      .audioBitrate(160)
      .audioChannels(2)
      .audioFrequency(48000)
      .audioFilters('volume=' + vid.lufs() + 'dB')
      .format('mp4')
      // set metadata
      .addOptions('-metadata encoder=LlamaEnc3.0')
      // event callbacks
      .on('start', function() {
        llama.in_progress(true);
        llama.startTime(new Date());
      })
      .on('error', function(err, a, b) {
        console.log('an error happened: ' + err.message);
        console.log(a);
        console.log(b);
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
        llama.in_progress(false);
      })
      .run();
  }
  this.make_mp4 = make_mp4;
}

module.exports = new Encode;