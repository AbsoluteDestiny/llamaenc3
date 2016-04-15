var fs = require('fs');
var NwBuilder = require('nw-builder');
var gulp = require('gulp');
var gulpFilter = require('gulp-filter');
var flatten = require('gulp-flatten');
var zip = require('gulp-archiver');
var cp = require('glob-copy');
var del = require('del');
var packages = require('./package.json');
var version = packages.version;
console.log(version);

var binMap = {
    'linux32' : 'build/LlamaEnc3/linux32',
    'linux64' : 'build/LlamaEnc3/linux64',
    'osx64' : 'build/LlamaEnc3/osx64/LlamaEnc3.app/Contents/Resources/app.nw',
    'win32' : 'build/LlamaEnc3/win32',
    'win64' : 'build/LlamaEnc3/win64'
};

gulp.task('clean', function(cb) {
  del(['build', 'dist'], cb);
});

gulp.task('cleanbuild', function(cb) {
  del(['build'], cb);
});

gulp.task('cleandist', function(cb) {
  del(['dist'], cb);
});

gulp.task('nw', ['clean'], function () {
    var files = [
            './**/**',
            '!./ff*.exe',
            '!./*.log',
            '!./bin/**',
            '!./dist/**',
            '!./build/**',
            '!./node_modules/**',
            '!./cache/**',
            ];
    // Don't copy over the dev-dependencies!
    for (var key in packages.dependencies) {
        files.push("./node_modules/" + key + "/*.js");
        files.push("./node_modules/" + key + "/*.json");
        files.push("./node_modules/" + key + "/**/*.js");
        files.push("./node_modules/" + key + "/**/*.json");
    }
    files = files.concat(['!./node_modules/**/+(test|tests|example|examples)/**']);
    var nw = new NwBuilder({
        version: '0.12.3',
        files: files,
        platforms: ['osx64', 'win32', 'win64', 'linux64', 'linux32'],
        zip: false,
        macIcns: './llama.icns',
        winIco: './llama.ico'
    });

    nw.on('log',  console.log);

    // Build returns a promise
    return nw.build().catch(function (error) {
        console.log(error);
        throw error;
    });
});

gulp.task("build", ['nw'],function() {
    var linux32 = gulpFilter('**/linux32/**');
    var linux64 = gulpFilter('**/linux64/**');
    var win32 = gulpFilter('**/win32/**');
    var win64 = gulpFilter('**/win64/**');
    var osx64 = gulpFilter('**/osx64/**');
    return gulp.src(["bin/**/**"])
        .pipe(linux32)
        .pipe(flatten())
        .pipe(gulp.dest(binMap['linux32']))
        .pipe(linux32.restore())
        .pipe(linux64)
        .pipe(flatten())
        .pipe(gulp.dest(binMap['linux64']))
        .pipe(linux64.restore())
        .pipe(win32)
        .pipe(flatten())
        .pipe(gulp.dest(binMap['win32']))
        .pipe(win32.restore())
        .pipe(osx64)
        .pipe(flatten())
        .pipe(gulp.dest(binMap['osx64']))
        .pipe(osx64.restore())
        .pipe(win64)
        .pipe(flatten())
        .pipe(gulp.dest(binMap['win64']));
});

gulp.task('zip', ['cleandist'], function(cb) {
    var fs = require('fs');
    var path = require('path');
    var archiver = require('archiver');
    var async = require('async');
    fs.mkdirSync(__dirname + '/dist/');

    async.eachSeries(Object.keys(binMap), function(platform, callback) {
        var ext = 'zip';
        var type = 'zip';
        var options = {};
        var mode = {};

        if (platform === 'linux64' || platform === 'linux32') {
            ext = 'tar.gz';
            type = 'tar';
            options = {
              gzip: true,
              gzipOptions: {
                level: 1
              }
            };
            mode = {mode: 0755};
        }
        var output = fs.createWriteStream(path.join('dist', 'LlamaEnc3-' + version + '-' + platform.replace('32', '-32').replace('64', '-64') + 'bit.' + ext));
        var archive = archiver(type, options);

        output.on('close', function() {
          console.log(archive.pointer() + ' total bytes');
          console.log('archiver has been finalized and the output file descriptor has closed.');
          callback();
        });

        archive.on('error', function(err) {
          throw err;
        });

        archive.pipe(output);
        archive.directory(path.join('./build/LlamaEnc3/', platform), 'LlamaEnc3', mode);
        archive.finalize();
    }, function (err) {
        if (err) console.error(err.message);
        cb();
    });

});

gulp.task('default', ['build']);
