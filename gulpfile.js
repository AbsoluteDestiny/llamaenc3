var fs = require("fs");
var NwBuilder = require("nw-builder");
var gulp = require("gulp");
var gulpFilter = require("gulp-filter");
var flatten = require("gulp-flatten");
var zip = require("gulp-archiver");
var cp = require("glob-copy");
var del = require("del");
var packages = require("./package.json");
var version = packages.version;
console.log(version);

var binMap = {
  linux32: "build/LlamaEnc3/linux32",
  linux64: "build/LlamaEnc3/linux64",
  osx64: "build/LlamaEnc3/osx64/LlamaEnc3.app/Contents/Resources/app.nw",
  win32: "build/LlamaEnc3/win32",
  win64: "build/LlamaEnc3/win64"
};

gulp.task("clean", function() {
  return del(["build", "dist"]);
});

gulp.task("cleanbuild", function() {
  return del(["build"]);
});

gulp.task("cleandist", function() {
  return del(["dist"]);
});

gulp.task("nw", ["clean"], function() {
  var files = [
    "./**/**",
    "!./ff*.exe",
    "!./*.log",
    "!./bin/**",
    "!./dist/**",
    "!./build/**",
    "!./node_modules/**",
    "!./cache/**"
  ];
  // Don't copy over the dev-dependencies!
  for (var key in packages.dependencies) {
    files.push("./node_modules/" + key + "/*.js");
    files.push("./node_modules/" + key + "/*.json");
    files.push("./node_modules/" + key + "/**/*.js");
    files.push("./node_modules/" + key + "/**/*.json");
  }
  files = files.concat([
    "!./node_modules/**/+(test|tests|example|examples)/**"
  ]);
  var nw = new NwBuilder({
    version: "0.38.3",
    files: files,
    platforms: ["win64", "osx64"],
    zip: false,
    macIcns: "./llama.icns",
    winIco: "./llama.ico"
  });

  nw.on("log", console.log);

  // Build returns a promise
  return nw.build().catch(function(error) {
    console.log(error);
    throw error;
  });
});

gulp.task("win64", ["nw"], function() {
  return gulp.src(["bin/win64/**"]).pipe(gulp.dest(binMap["win64"]));
});

gulp.task("osx64", ["nw"], function() {
  return gulp.src(["bin/osx64/**"]).pipe(gulp.dest(binMap["osx64"]));
});

gulp.task("build", ["nw", "win64", "osx64"]);

gulp.task("zip", ["cleandist"], function(cb) {
  var fs = require("fs");
  var path = require("path");
  var archiver = require("archiver");
  var async = require("async");
  fs.mkdirSync(__dirname + "/dist/");

  async.eachSeries(
    Object.keys(binMap),
    function(platform, callback) {
      var ext = "zip";
      var type = "zip";
      var options = {};
      var mode = {};

      if (
        platform === "linux64" ||
        platform === "linux32" ||
        platform === "osx64"
      ) {
        ext = "tar.gz";
        type = "tar";
        options = {
          gzip: true,
          gzipOptions: {
            level: 1
          }
        };
        mode = { mode: 0755 };
      }
      var output = fs.createWriteStream(
        path.join(
          "dist",
          "LlamaEnc3-" +
            version +
            "-" +
            platform.replace("32", "-32").replace("64", "-64") +
            "bit." +
            ext
        )
      );
      var archive = archiver(type, options);

      output.on("close", function() {
        console.log(archive.pointer() + " total bytes");
        console.log(
          "archiver has been finalized and the output file descriptor has closed."
        );
        callback();
      });

      archive.on("error", function(err) {
        throw err;
      });

      archive.pipe(output);
      archive.directory(
        path.join("./build/LlamaEnc3/", platform),
        "LlamaEnc3",
        mode
      );
      archive.finalize();
    },
    function(err) {
      if (err) console.error(err.message);
      cb();
    }
  );
});

gulp.task("default", ["build"]);
