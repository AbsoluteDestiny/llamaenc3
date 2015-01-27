var fs = require('fs');
var NwBuilder = require('node-webkit-builder');
var gulp = require('gulp');
var gulpFilter = require('gulp-filter');
var flatten = require('gulp-flatten');
var zip = require('gulp-zip');
var archiver = require('archiver');
var cp = require('glob-copy');
var del = require('del');
var packages = require('./package.json');
var version = packages.version;
console.log(version);

var binMap = {
    'osx32' : 'build/LlamaEnc3/osx32/LlamaEnc3.app/Contents/Resources',
    'osx64' : 'build/LlamaEnc3/osx64/LlamaEnc3.app/Contents/Resources',
    'win32' : 'build/LlamaEnc3/win32',
    'win64' : 'build/LlamaEnc3/win64'
};

gulp.task('clean', function(cb) {
  del(['build', 'dist'], cb);
});

gulp.task('nw', ['clean'], function () {
    var files = [
            './**/**',
            '!./ff*.exe',
            '!./bin/**',
            '!./dist/**',
            '!./build/**',
            '!./node_modules/**',
            '!./cache/**',
            ];
    // Don't copy over the dev-dependencies!
    for (var key in packages.dependencies) {
        files.push("node_modules/" + key + "/**");
    }
    var nw = new NwBuilder({
        files: files,
        platforms: ['osx32', 'osx64', 'win32', 'win64', 'linux64', 'linux32'],
        macZip: true,
        winIco: './llama.ico'
    });

    // Build returns a promise
    return nw.build().then(function (a) {
        // for (var platform in binMap) {
        //     copyBinaries(platform);
        // }
        console.log("nw build done");
    }).catch(function (error) {
        console.error(error);
        cb(error);
    });
});

gulp.task("copyBin", ['nw'],function() {
    var win32 = gulpFilter('**/win32/**');
    var osx32 = gulpFilter('**/osx32/**');
    var osx64 = gulpFilter('**/osx64/**');
    var win64 = gulpFilter('**/win64/**');
    return gulp.src(["bin/**/**"])
        .pipe(win32)
        .pipe(flatten())
        .pipe(gulp.dest(binMap['win32']))
        .pipe(win32.restore())
        .pipe(osx32)
        .pipe(flatten())
        .pipe(gulp.dest(binMap['osx32']))
        .pipe(osx32.restore())
        .pipe(osx64)
        .pipe(flatten())
        .pipe(gulp.dest(binMap['osx64']))
        .pipe(osx64.restore())
        .pipe(win64)
        .pipe(flatten())
        .pipe(gulp.dest(binMap['win64']));
});

// gulp.task("copyNM", ['nw'],function() {
//     var win32 = gulpFilter('**/win32/**');
//     var osx32 = gulpFilter('**/osx32/**');
//     var osx64 = gulpFilter('**/osx64/**');
//     var win64 = gulpFilter('**/win64/**');
    
//     console.log(sources);
//     return gulp.src(sources, { "base" : "." })
//         .pipe(gulp.dest(binMap['win32']))
//         .pipe(gulp.dest(binMap['osx32']))
//         .pipe(gulp.dest(binMap['osx64']))
//         .pipe(gulp.dest(binMap['win64']));
// });


gulp.task('zip', ['copyBin'], function() {
    var win32 = gulpFilter('**/osx32/**');
    var osx32 = gulpFilter('**/osx64/**');
    var osx64 = gulpFilter('**/win32/**');
    var win64 = gulpFilter('**/win64/**');
    var linux64 = gulpFilter('**/linux64/**');
    var linux32 = gulpFilter('**/linux32/**');
    return gulp.src('build/LlamaEnc3/**')
        .pipe(win32)
        .pipe(zip('LlamaEnc3-' + version + '-osx-32bit.zip'))
        .pipe(gulp.dest('dist'))
        .pipe(win32.restore())
        .pipe(osx32)
        .pipe(zip('LlamaEnc3-' + version + '-osx-64bit.zip'))
        .pipe(gulp.dest('dist'))
        .pipe(osx32.restore())
        .pipe(osx64)
        .pipe(zip('LlamaEnc3-' + version + '-win-32bit.zip'))
        .pipe(gulp.dest('dist'))
        .pipe(osx64.restore())
        .pipe(win64)
        .pipe(zip('LlamaEnc3-' + version + '-win-64bit.zip'))
        .pipe(gulp.dest('dist'))
        .pipe(win64.restore())
        .pipe(linux32)
        .pipe(zip('LlamaEnc3-' + version + '-linux-32bit.zip'))
        .pipe(gulp.dest('dist'))
        .pipe(linux32.restore())
        .pipe(linux64)
        .pipe(zip('LlamaEnc3-' + version + '-linux-64bit.zip'))
        .pipe(gulp.dest('dist'));
});

gulp.task('default', ['copyBin']);