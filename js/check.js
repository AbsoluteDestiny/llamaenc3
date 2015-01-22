var path = require('path');
var fs = require('fs');
var ffprobe = require('node-ffprobe');
var sf = require('slice-file');
var FfmpegCommand = require('fluent-ffmpeg');

FfmpegCommand.getAvailableFormats(function(err, formats) {
  console.log('Available formats:');
  console.dir(formats);
});
// FfmpegCommand.getAvailableCodecs(function(err, codecs) {
//   console.log('Available codecs:');
//   console.dir(codecs);
// });

function Check() {
  var self = this;
  ffprobe.FFPROBE_PATH = process.env['FFPROBE_PATH'];
  // progress.env['path'] = progress.env['path'] + ';' + path.resolve(__dirname, "../bin");
  // FfmpegCommand.setFfmpegPath(path.join(__dirname, ".." + path.sep + "bin" + path.sep + "ffmpeg.exe"));
  // FfmpegCommand.setFfprobePath(path.join(__dirname, ".." + path.sep + "bin" + path.sep + "ffprobe.exe"));


  function probe(llama) {
    var pr = new ffprobe(llama.vid().path(), function(err, probeData) {
      if (err) throw err;
      console.log(probeData);
      llama.vid().data(probeData);
      llama.analyse();
    });
  }
  self.probe = probe;

  function convertHMS(hms) {
    var a = hms.split(':'); // split it at the colons
    // minutes are worth 60 seconds. Hours are worth 60 minutes.
    var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
    return seconds;
  }
  self.convertHMS = convertHMS;

  function scan(llama) {
    // FfmpegCommand.setFfmpegPath("../bin/ffmpeg.exe");
    // FfmpegCommand.setFfprobePath("../bin/ffprobe.exe");
    var command = new FfmpegCommand();
    llama.ffcancel = command.kill;
    // console.log(12 / llama.vid().duration());
    // command
    command.input(llama.vid().path());
    command.addOption('-report')
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
      ])
      .complexFilter([
        {
          filter: 'ebur128',
          options: {'peak': true}
        }
      ])
      .output(llama.thumbpath() + '\\out%04d.png')
      .seek(Math.floor(llama.vid().duration()/10))
      .format('image2')
      .videoFilters([
        {
          filter: 'fps',
          options: "fps=10/" + Math.floor(llama.vid().duration()) + ":round=down"
        }
      ])
      // .addOptions("-vf select=eq(pict_type\\,I)*not(mod(n\\,100))")
      // .addOptions("-vf select=eq(pict_type\\,I)")
      // .addOptions("-vf select=not(mod(n\\,5))")
      // .addOptions("-vsync 0")
      // .fps(12 / llama.vid().duration()) // Create ~12 screenshots
      // .addOptions("-vsync 0")
      // .fps(0.5) // choose every other I frame
      // .addOptions('-qscale:v 2')
      .on('start', function() {
        // $("#open").hide();
        llama.startTime(new Date());
      })
      .on('error', function(err, a, b) {
        console.log('an error happened: ' + err.message);
        console.log(a);
        console.log(b);
      })
      .on('progress', function(progress) {
        if (llama.vid().duration()) {
           var done = 100 * (convertHMS(progress.timemark) / llama.vid().duration());
           llama.currentTime(new Date());
           llama.progress(done);
           // $("#progress").css('width', done + "%");
        }
      })
      .on('end', function(err) {
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
            } catch(e) {  }

            try {
              var lufs = -16.0 - data.match(/[\s]+I:[\s]+([\d-.]+)/).splice(-1)[0];
              if (lufs && Math.abs(lufs) > 1) {
                llama.vid().lufs(lufs);
              }
            } catch(e) {  }

            try {
              var progressive = parseInt(data.match("Multi frame detection: [TBF0-9: ]+Progressive:([\\d]+)")[1], 10);
              llama.vid().progressive(progressive || 0);
              // console.log(progressive);
            } catch(e) {  }

            try {
              var tff = parseInt(data.match("Multi frame detection: TFF:([\\d]+)")[1], 10);
              llama.vid().tff(tff || 0);
              // console.log(tff);
            } catch(e) {  }

            try {
              var bff = parseInt(data.match("Multi frame detection: [TF0-9: ]+BFF:([\\d]+)")[1], 10);
              llama.vid().bff(bff || 0);
              // console.log(bff);
            } catch(e) {  }
          })
          .on('end', function() {
            if (llama.vid().tff() + llama.vid().bff() + llama.vid().progressive() > 0) {
                if (llama.vid().tff() > llama.vid().bff() && llama.vid().tff() > llama.vid().progressive()) {
                    // llama.vid().fo("tff");
                    llama.vid().suggest_fo("tff");
                } else if (llama.vid().bff() > llama.vid().tff() && llama.vid().bff() > llama.vid().progressive()) {
                    // llama.vid().fo("bff");
                    llama.vid().suggest_fo("bff");
                } else {
                  llama.vid().suggest_fo("progressive");
                }
            } else {
                // llama.vid().fo("progressive");
                llama.vid().suggest_fo("progressive");
            }
            // console.log(llama.vid().suggest_fo());
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