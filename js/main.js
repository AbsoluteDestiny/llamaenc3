var gui = require('nw.gui'); //or global.window.nwDispatcher.requireNwGui() (see https://github.com/rogerwang/node-webkit/issues/707)
// Get the current window
var win = gui.Window.get();
var clipboard = gui.Clipboard.get();

$(function() {
  win.maximize();
  win.show();
  // Register dev console to ctrl+d
  $("body").on('keypress', function(e) {
    if (e.which === 4 && e.ctrlKey === true) {
      if (win.isDevToolsOpen()) {
        win.closeDevTools();
      } else {
        win.showDevTools();
      }
    }
  });
});
var init = require('../js/init.js');
init.start();

var LM;
var _ = require('lodash');
var del = require('del');
var exec = require('child_process').exec;
var fs = require('fs');
var GitHubApi = require("github");
var https = require('https');
var humanizeDuration = require("humanize-duration");
var init = require('../js/init.js');
var open = require('open');
var path = require('path');
var sanitize = require("sanitize-filename");
var semver = require('semver');
var temp = require('temp');

var check = require('../js/check.js');
var encode = require('../js/encode.js');
var file = require('../js/file.js');
var logger = require('../js/logging.js').logger;
var packagejson = require("../package.json");

var Datastore = require('nedb');
var vidders = new Datastore({
  filename: path.join(require('nw.gui').App.dataPath, 'vidders.db'),
  autoload: true
});


var goodInfoKeys = ["nb_streams", "nb_programs", "format_name", "start_time", "duration", "size", "bit_rate", "codec_name", "profile", "codec_type", "codec_time_base", "codec_tag_string", "width", "height", "has_b_frames", "sample_aspect_ratio", "display_aspect_ratio", "pix_fmt", "level", "color_range", "color_space", "color_transfer", "color_primaries", "chroma_location", "timecode", "is_avc", "r_frame_rate", "avg_frame_rate", "time_base", "start_pts", "duration_ts", "max_bit_rate", "bits_per_raw_sample", "nb_frames", "nb_read_frames", "nb_read_packets", "sample_fmt", "sample_rate", "channels", "channel_layout", "bits_per_sample"];

var audioFile = function(llama, path) {
  var self = this;
  self.llama = llama;
  self.audioOK = ko.observable(false);
  self.checked = ko.observable(false);
};

var VidModel = function(llama, path) {
  var self = this;
  self.llama = llama;
  self.path = ko.observable(path);
  self.audioPath = ko.observable("");

  self.videoOK = ko.observable(false);
  self.audioOK = ko.observable(false);

  self.scanned_ok = ko.observable(false);

  self.readyToScan = ko.computed(function() {
    return self.videoOK() && self.audioOK();
  });
  self.readyToScan.subscribe(function() {
    if (self.readyToScan() && !self.scanned_ok()) {
      check.scan(llama);
    }
  });

  self.thumbnails = ko.observableArray();

  //Thumbnail Management
  self.currentThumbIdx = ko.observable(0);
  self.currentThumb = ko.pureComputed(function() {
    if (self.thumbnails().length) {
      return self.thumbnails()[Math.min(self.currentThumbIdx(), self.thumbnails().length - 1)];
    }
  });
  self.data = ko.observable("");
  self.audioData = ko.observable("");
  self.containerInfo = ko.pureComputed(function() {
    if (self.data()) {
      return _.chain(self.data().format)
              .pick(goodInfoKeys)
              .pairs()
              .value();
    }
  });
  self.videoInfo = ko.pureComputed(function() {
    if (self.data()) {
      return _.chain(self.data().streams)
              .find({codec_type: "video"})
              .pick(goodInfoKeys)
              .pairs()
              .value();
    }
  });
  self.audioInfo = ko.pureComputed(function() {
    if (self.data()) {
      var data = self.audioData() || self.data();
      return _.chain(data.streams)
              .find({codec_type: "audio"})
              .pick(goodInfoKeys)
              .pairs()
              .value();
    }
  });
  self.copyInfo = function() {
    if (self.data()) {
      var template = 'Container:\n\n<% _.forEach(format, function(item) { %><%- item[0] %>: <%- item[1] %>\n<% }); %>\n\n';
      template = template + 'Video:\n\n<% _.forEach(video, function(item) { %><%- item[0] %>: <%- item[1] %>\n<% }); %>\n\n';
      template = template + 'Audio:\n\n<% _.forEach(audio, function(item) { %><%- item[0] %>: <%- item[1] %>\n<% }); %>';
      clipboard.set(_.template(template, {format: self.containerInfo(), video: self.videoInfo(), audio: self.audioInfo()}));
    }
  };


  self.nframes = null;
  self.duration = ko.pureComputed(function() {
    if (self.data() && self.data().format) {
      return parseFloat(self.data().format.duration);
    } else {
      return 0;
    }
  });


  // Vid metadata
  self.title = ko.observable("");
  self.anonymous = ko.observable(false);
  self.author = ko.observable("");
  self.vidder = ko.computed(function() {
    if (self.anonymous()) {
      return "Anonymous";
    }
    return self.author();
  });
  self.meta = "LlamaEnc3";
  self.fieldOptionsReady = ko.pureComputed(function() {
    return self.fo_choice();
  });
  self.metadataReady = ko.pureComputed(function() {
    return self.vidder() && self.title();
  });
  self.sourceFPS = ko.observable(0);
  self.silence_start = ko.observable(0); // The amount of silence at the start of the vid.
  self.silence_end = ko.observable(0); // The amount of silence at the end of the vid.

  // Size and AR

  self.do_crop = ko.observable(false);
  self.startwidth = ko.observable("");
  self.sourceSar = ko.observable();
  self.customPar = ko.observable(1.0);
  self.chosenPar = ko.observable(1.0);
  self.par = ko.pureComputed(function() {
    if (self.chosenPar() === 0) {
      return parseFloat(self.customPar());
    }
    return self.chosenPar() || 1.0;
  });
  self.cropt = ko.observable(0);
  self.cropb = ko.observable(0);
  self.cropl = ko.observable(0);
  self.cropr = ko.observable(0);
  self.suggestCropt = ko.observable(0);
  self.suggestCropb = ko.observable(0);
  self.suggestCropl = ko.observable(0);
  self.suggestCropr = ko.observable(0);
  self.cropTo704 = ko.observable(false);
  // If we are cropping to 704, crop is 8 or user crop if larger.
  self.actualcropl = ko.computed(function() {
    return Math.max(self.cropTo704() ? 8 : 0, self.do_crop() ? parseInt(self.cropl(), 10) : 0);
  });
  self.actualcropr = ko.computed(function() {
    return Math.max(self.cropTo704() ? 8 : 0, self.do_crop() ? parseInt(self.cropr(), 10) : 0);
  });
  self.scaledstartwidth = ko.computed(function() {
    return self.startwidth() * self.par();
  });
  self.startheight = ko.observable("");
  self.scaledstartheight = ko.computed(function() {
    return self.startheight();
  });
  self.newWidth = ko.computed(function() {
    return (self.startwidth() - (self.actualcropl() + self.actualcropr()));
  });
  self.newHeight = ko.computed(function() {
    if (self.do_crop()) {
      return (self.startheight() - (parseInt(self.cropt(), 10) + parseInt(self.cropb(), 10)));
    }
    return self.startheight();
  });
  self.crop = ko.computed(function() {
    if (self.do_crop()) {
      var crop = self.newWidth() + ":" + self.newHeight() + ":" + self.actualcropl() + ":" + self.cropt();
      return crop;
    }
    return "";
  });
  self.lufs = ko.observable(0);
  self.progressive = ko.observable(0);
  self.tff = ko.observable(0);
  self.bff = ko.observable(0);
  self.suggest_fo = ko.observable("");
  self.fo_choice = ko.observable("");
  
  self.parOptions = ko.observableArray([
    {value:1, ffmpeg: 1, text: "Square Pixels (1.0)"},
    {value:10/11, ffmpeg: 8/9, text: "4:3 NTSC DVD (0.90)"},
    {value:40/33, ffmpeg: 32/27, text: "16:9 NTSC DVD (1.21)"},
    {value:12/11, ffmpeg: 16/15, text: "4:3 PAL DVD (1.09)"},
    {value:16/11, ffmpeg: 64/45, text: "16:9 PAL DVD (1.45)"},
    // {value: 4/3, text: "16:9 HDV / HDCAM (1.333)"},
    {value: 0, text: "Custom PAR"}
  ]);
  self.width = ko.pureComputed(function() {
    return 4 * Math.floor(self.newWidth() * self.par()/4);
  });
  self.height = ko.pureComputed(function() {
    return 4 * Math.floor(self.newHeight()/4);
  });
  self.finalsize = ko.pureComputed(function() {
    var scale = 1;
    if (self.width() > self.height()) {
      if (self.width() > 1920) {
        scale = 1920 / self.width();
      }
    } else {
      if (self.height() > 1080) {
        scale = 1080 / self.height();
      }
    }
    var scaleV = 4 * Math.floor(self.width() * scale/4);
    var scaleH = 4 * Math.floor(self.height() * scale/4);
    return scaleV + "x" + scaleH;
  });

  // Is everything ready for encoding?
  self.convertable = ko.computed(function() {
    return self.fieldOptionsReady() && self.metadataReady();
  });

};


var StepModel = function(title, done_test) {
  var self = this;
  self.title = title;
  self.needs = ko.observableArray([]);
  self.done = ko.observable(false);

  self.ready = ko.pureComputed(function() {
    var hasNeeds = false;
    for (var i = self.needs().length - 1; i >= 0; i--) {
      if (!self.needs()[i].done()) {
        hasNeeds = true;
        break;
      }
    }
    return !hasNeeds || self.done();
  });

  if (done_test) {
    self.doneTest = ko.computed(done_test);
  }
};

var LLamaModel = function () {
  var self = this;
  self.version = packagejson.version;
  self.ffmpeg = ko.observable(false);
  self.ffprobe = ko.observable(false);
  self.vid = ko.observable("");
  self.vidPath = ko.observable("");
  //Status stuff
  self.updateAvailable = ko.observable("");
  self.githubAsset = ko.computed(function() {
    var platform = process.platform;
    var arch = process.arch;
    var base = platform === "win32" ? "win" : platform === "darwin" ? "osx" : "linux";
    var bit = arch === "x64" ? '64bit' : '32bit';
    // console.log(base + "-" + bit);
    return _.find(self.updateAvailable().assets,
      function(item) {
         return _.contains(item.name, base + "-" + bit);
      });
  });
  self.in_progress = ko.observable(false);
  self.in_progress.subscribe(function() {
    if (!self.in_progress()) {
      win.setProgressBar(-1);
    }
  });
  self.progress_title = ko.observable("");
  self.progres_description = ko.observable("");
  self.errorMessage = ko.observable("");
  self.errorMessage.subscribe(function() {
    self.in_progress(false);
    win.showDevTools();
    clipboard.set(self.errorMessage(), 'text');
  });
  self.warningMessage = ko.observable("");
  self.warningMessage.subscribe(function() {
    self.in_progress(false);
    win.showDevTools();
    // clipboard.set(self.warningMessage(), 'text');
  });
  self.progress = ko.observable(0.0);
  self.progress.subscribe(function() {
    if (self.in_progress() && 0 < self.progress() < 100) {
      win.setProgressBar(self.progress() / 100);
    } else {
      win.setProgressBar(-1);
    }
  });
  // self.encodeProgress = ko.observable(0.0);
  self.startTime = ko.observable(0);
  self.currentTime = ko.observable(0);
  self.ETA = ko.pureComputed(function() {
    if (self.in_progress() && self.currentTime() && self.progress()) {
      if (self.progress() > 10 || self.currentTime() - self.startTime() > 10000) {
        var rate = 1000 * (self.progress() / (self.currentTime() - self.startTime()));
        var seconds = (100 - self.progress()) / rate;
        return humanizeDuration(parseInt(seconds * 1000, 10));
      }
      return "calculating...";
    }
  });

  // User Flow Progress
  self.step = ko.observable(0);
  self.step.subscribe(function() {
    $(function() {
      $("select").select2({dropdownCssClass: 'dropdown-inverse'});
      $('[data-toggle="switch"]').bootstrapSwitch();
    });
  });
  self.steps = ko.observableArray();

  var step1 = new StepModel("Source");
  var step2 = new StepModel("Fields", function() {
    if (self.vidPath() && self.vid() && self.vid().fo_choice()) {
      step2.done(true);
    }
  });
  var step3 = new StepModel("Crop", function() {
    if (self.vidPath() && self.vid() && self.step() > 1) {
      step3.done(true);
    }
  });
  var step4 = new StepModel("Encode", function() {
    if (self.vidPath() && self.vid() && self.step() > 2) {
      step4.done(true);
    }
  });
  var step5 = new StepModel("Done");
  step2.needs.push(step1);
  step3.needs.push(step1);
  step4.needs.push(step1);
  step5.needs.push(step1);
  step4.needs.push(step2);
  step5.needs.push(step4);
  self.steps([step1, step2, step3, step4, step5]);


  // Temporary file management
  self.logpath = ko.observable("");
  self.thumbpath = ko.observable("");
  
  // Vid info
  self.vid.subscribe(function() {
    if (self.vid()) {
      step1.done(true);
    }
  });
  self.vidPath.extend({ notify: 'always' });
  self.clearVid = function() {
    self.step(0);
    self.progress(0);
    self.vid(null);
    $('#open').val('');
    temp.cleanupSync();
  };
  self.vidPath.subscribe(function() {
    if (self.vidPath()) {
      self.clearVid();
      self.vid(new VidModel(self, self.vidPath()));
      file.setupTempFiles(self);
      check.probe(self);
    }
  });
  self.vidPicked = function() {
    self.vidPath($("#open").val());
  };

  self.outPath = ko.observable("");
  self.outPath.extend({ notify: 'always' });
  self.outPath.subscribe(function() {
    encode.make_mp4(self);
  });
  self.open = function() {
    if (self.outPath()) {
      // open(self.outPath());
      gui.Shell.openItem(self.outPath());
    }
  };

  self.opendir = function() {
    if (self.outPath()) {
      gui.Shell.showItemInFolder(self.outPath());
    }
  };

  self.largeVid = ko.pureComputed(function() {
    if (self.vid()) {
      return Math.max($('.container:first').width(), self.vid().startwidth()) + "px";
    }
  });

  self.vidders = ko.observableArray();
  self.vvcShows = ko.observableArray();
  self.vidshowYear = ko.observable();
  self.vidshowYears = ko.pureComputed(function() {
    return _.uniq(_.pluck(self.vvcShows(), 'con_year'), true);
  });
  self.vidshowsByYear = ko.pureComputed(function() {
    return _.map(
      _.where(self.vvcShows(), {'con_year': self.vidshowYear()}),
      function(item) {
        return {'text' : item.name, 'value' : self.vvcShows().indexOf(item)};
      });
  });
  self.vidshowChoice = ko.observable("");
  self.vidshow = ko.computed(function() {
    if (self.vidshowChoice()) {
      return self.vvcShows()[self.vidshowChoice()];
    }
  });
  self.showname = ko.computed(function() {
    if (self.vid() && self.vidshow()) {
      return self.vidshow().con_year + ": " + self.vidshow().name.trim();
    }
    return "";
  });
  self.suggestedFileName = ko.computed(function() {
    var name = "Vid";
    if (self.vid() && self.vid().vidder() && self.vid().title()) {
      name = self.vid().vidder().trim() + "-" + self.vid().title().trim();
      if (self.vidshow()) {
        name = "[" + self.showname() + "]" + name;
      }
    }
    return sanitize(name) + ".m4v";
  });

  $.get("http://vividcon.info/connect/showlist/1/", function(data) {
    var vidshows = _.chain(data)
    .where({ 'model': 'viddb.vidshow' })
    .sortBy([
        function(model) {
          return -1 * model.fields.con_year;
        },
        function(model) {
          return model.fields.themed ? 0 : 1;
        },
        function(model) {
          return model.fields.name;
        }
      ])
    .filter(function(model) { return !model.fields.internal;})
    .map(function(model) {
      return model.fields;
    })
    .value();
    self.vvcShows(vidshows);
  });


  self.analyse = function() {
    // TODO: cache the result of this.
    self.in_progress(true);
    // Do we have both a video and an audio stream?
    var hasVideo = false;
    var hasAudio = false;
    var missing = [];
    for (var i = self.vid().data().streams.length - 1; i >= 0; i--) {
      var stream = self.vid().data().streams[i];
      if (stream.codec_type === "video") {
        hasVideo = true;
        self.vid().startwidth(parseInt(stream.width, 10));
        self.vid().startheight(parseInt(stream.height, 10));
        self.vid().nframes = stream.nb_frames;
      } else { missing.push("Video"); }
      if (stream.codec_type === "audio") { hasAudio = true;}
        else { missing.push("Audio"); }
    }
    if (hasVideo && hasAudio) {
      // logger.log(self.vid().width());
      // logger.log(self.vid().height());
      check.scan(self);
    } else {
      self.errorMessage(self.vidPath() + " has no " + missing.join(" or ") + " streams.");
      self.clearVid();
      self.in_progress(false);
    }
  };

  exec('ffmpeg -version', function (error, stdout, stderr) {
    // logger.log("checking ffmpeg");
    if (!error) {
      logger.log('stdout: ' + stdout);
      self.ffmpeg(true);
    } else {
      logger.error("We can't find a copy of ffmpeg :(");
      logger.log('error: ' + error);
      logger.log('stderr: ' + stderr);
    }
  });

  exec('ffprobe -version', function (error, stdout, stderr) {
    // logger.log("checking ffprobe");
    if (!error) {
      logger.log('stdout: ' + stdout);
      self.ffprobe(true);
    } else {
      logger.error("We can't find a copy of ffprobe :(");
      logger.log('error: ' + error);
      logger.log('stderr: ' + stderr);
    }
  });

  self.findUpdate = function() {
    var github = new GitHubApi({
      version: "3.0.0",
    });
    github.releases.listReleases({
        owner: "AbsoluteDestiny",
        repo: "llamaenc3"
    }, function(err, res) {
        if (!err) {
          var latest = res[0];
          if (semver.gt(latest.tag_name, packagejson.version)) {
            self.updateAvailable(latest);
            $("#updateModal").modal();
          }
        }
    });
  };
  self.findUpdate();

  self.saveVidder = function() {
    if (!self.vid().anonymous()) {
      vidders.update({ name: self.vid().author() }, { $inc: { count: 1 } }, { upsert: true }, function () {
        self.syncVidders();
      });
    }
  };

  self.syncVidders = function() {
    vidders.find({count: { $gt: 0 }}).sort({ name: 1 }).exec(function(err, data) {
      if (data) {
        // console.log(data);
        self.vidders(data);
      }
    });
  };
  self.syncVidders();
};

LM = new LLamaModel();
global.LM = LM;
ko.applyBindings(LM);