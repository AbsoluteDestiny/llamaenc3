var gui = require('nw.gui'); //or global.window.nwDispatcher.requireNwGui() (see https://github.com/rogerwang/node-webkit/issues/707)
// Get the current window
var win = gui.Window.get();
win.maximize();
win.show();



var init = require('../js/init.js');
var exec = require('child_process').exec;
var path = require('path');
var file = require('../js/file.js');
var check = require('../js/check.js');
var encode = require('../js/encode.js');
var _ = require('lodash');
var humanizeDuration = require("humanize-duration");
var sanitize = require("sanitize-filename");
var open = require('open');
init.start();

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

  // Size and AR
  // self.cropDetect = ko.observableArray();
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
  self.scaledstartwidth = ko.computed(function() {
    return self.startwidth() * self.par();
  });
  self.startheight = ko.observable("");
  self.scaledstartheight = ko.computed(function() {
    return self.startheight();
  });
  self.newWidth = ko.computed(function() {
    if (self.do_crop()) {
      return (self.startwidth() - (parseInt(self.cropl(), 10) + parseInt(self.cropr(), 10)));
    }
    return self.startwidth();
  });
  self.newHeight = ko.computed(function() {
    if (self.do_crop()) {
      return (self.startheight() - (parseInt(self.cropt(), 10) + parseInt(self.cropb(), 10)));
    }
    return self.startheight();
  });
  self.crop = ko.computed(function() {
    // Final width:Final Height:X:Y
    if (self.do_crop()) {
      var crop = self.newWidth() + ":" + self.newHeight() + ":" + self.cropl() + ":" + self.cropt();
      // console.log(crop);
      return crop;
    }
    return "";
  });
  self.cropt = ko.observable(0);
  self.cropb = ko.observable(0);
  self.cropl = ko.observable(0);
  self.cropr = ko.observable(0);
  self.lufs = ko.observable(0);
  self.progressive = ko.observable(0);
  self.tff = ko.observable(0);
  self.bff = ko.observable(0);
  self.suggest_fo = ko.observable("");
  self.fo_choice = ko.observable("");
  
  self.parOptions = ko.observableArray([
    {value: 1, text: "Square Pixels (1.0)"},
    {value: 8/9, text: "4:3 NTSC DVD (0.9090)"},
    {value: 32/27, text: "16:9 NTSC DVD (1.2101)"},
    {value: 16/15, text: "4:3 PAL DVD (1.0925)"},
    {value: 64/45, text: "16:9 PAL DVD (1.45679)"},
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
    if (self.width() > self.height()) {
      if (self.width() > 1920) {
        return '1920x?';
      } else {
        return self.width() + 'x?';
      }
    } else {
      if (self.height() > 1080) {
        return '?x1080';
      } else {
        return '?x' + self.height();
      }
    }
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
  self.ffmpeg = ko.observable(false);
  self.ffprobe = ko.observable(false);
  self.vid = ko.observable("");
  self.vidPath = ko.observable("");
  //Status stuff
  self.in_progress = ko.observable(false);
  self.progress_title = ko.observable("");
  self.progres_description = ko.observable("");
  self.errorMessage = ko.observable("");
  self.progress = ko.observable(0.0);
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
  self.currentStep = ko.pureComputed(function() {
    if (startwidth.steps().length < self.step())
      return;
    return self.steps()[self.step()];
  });
  self.step.subscribe(function() {
    $(function() {
      $("select").select2({dropdownCssClass: 'dropdown-inverse'});
      $('[data-toggle="switch"]').bootstrapSwitch();
    });
  });
  self.steps = ko.observableArray();

  var step1 = new StepModel("Choose Vid");
  var step2 = new StepModel("Field Options", function() {
    if (self.vidPath() && self.vid() && self.vid().fo_choice()) {
      step2.done(true);
    }
  });
  var step3 = new StepModel("Cropping");
  var step4 = new StepModel("Encode");
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
  self.logpath_clean = function() { };
  self.thumbpath = ko.observable("");
  self.thumbpath_clean = function() { };
  
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
    self.logpath_clean();
    self.thumbpath_clean();
    self.vid(null);
    $('#open').val('');
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
    // console.log("encoding");
    encode.make_mp4(self);
  });
  self.open = function() {
    if (self.outPath()) {
      open(self.outPath());
    }
  };

  self.opendir = function() {
    if (self.outPath()) {
      open(path.dirname(self.outPath()));
    }
  };

  self.largeVid = ko.pureComputed(function() {
    if (self.vid()) {
      return Math.max($('.container:first').width(), self.vid().startwidth()) + "px";
    }
  });

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
      // console.log(self.vid().width());
      // console.log(self.vid().height());
      check.scan(self);
    } else {
      self.errorMessage(self.vidPath() + " has no " + missing.join(" or ") + " streams.");
      self.clearVid();
      self.in_progress(false);
    }
  };

  exec('ffmpeg -version', function (error, stdout, stderr) {
    // console.log("checking ffmpeg");
    if (!error) {
      // console.log('stdout: ' + stdout);
      self.ffmpeg(true);
    } else {
      self.errorMessage("We can't find a copy of ffmpeg :(");
      console.log('error: ' + error);
      console.log('stderr: ' + stderr);
    }
  });

  exec('ffprobe -version', function (error, stdout, stderr) {
    // console.log("checking ffprobe");
    if (!error) {
      // console.log('stdout: ' + stdout);
      self.ffprobe(true);
    } else {
      self.errorMessage("We can't find a copy of ffprobe :(");
      console.log('error: ' + error);
      console.log('stderr: ' + stderr);
    }
  });
};

var LM = new LLamaModel();
ko.applyBindings(LM);