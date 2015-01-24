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
init.start();

var VidModel = function(path) {
  var self = this;
  self.path = ko.observable(path);
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
      return self.data().format.duration;
    } else {
      return 0;
    }
  });


  // Vid metadata
  self.title = ko.observable("");
  self.anonymous = ko.observable(false);
  self.author = ko.observable("");
  self.vidder = ko.observable(function() {
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

  // Size and AR
  // self.cropDetect = ko.observableArray();
  self.do_crop = ko.observable(false);
  self.startwidth = ko.observable("");
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
      console.log(crop);
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
  self.scanned_ok = ko.observable(false);
  self.parOptions = ko.observableArray([
    {value: 1.0, text: "Square Pixels (1.0)"},
    {value: 10/11, text: "4:3 NTSC DVD (0.9090)"},
    {value: 40/33, text: "16:9 NTSC DVD (1.2101)"},
    {value: 59/54, text: "4:3 PAL DVD (1.0925)"},
    {value: 118/81, text: "16:9 PAL DVD (1.45679)"},
    {value: 4/3, text: "16:9 HDV / HDCAM (1.333)"},
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


var LLamaModel = function () {
  var self = this;
  self.ffmpeg = ko.observable(false);
  self.ffprobe = ko.observable(false);

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
  self.step = ko.observable(0);
  self.step.subscribe(function() {
    $(function() {
      $("select").select2({dropdownCssClass: 'dropdown-inverse'});
      $('[data-toggle="switch"]').bootstrapSwitch();
    });
  });
  self.steps = ko.observableArray([
    "Choose Vid",
    "Field Options",
    "Cropping",
    "Encode"]);
  
  // Temporary file management
  self.logpath = ko.observable("");
  self.logpath_clean = function() { };
  self.thumbpath = ko.observable("");
  self.thumbpath_clean = function() { };
  
  // Vid info
  self.vid = ko.observable("");
  self.vidPath = ko.observable("");
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
      self.vid(new VidModel(self.vidPath()));
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
    console.log("encoding");
    encode.make_mp4(self);
  });

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
        return {'text' : item.name, 'value' : item};
      });
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

  self.encode = function() {
    console.log("encoding");
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

ko.applyBindings(new LLamaModel());