var NwBuilder = require('node-webkit-builder');

var binMap = {
    'osx32' : 'bin/darwin/ia32/**',
    'osx64' : 'bin/darwin/x64/**',
    'win32' : 'bin/win32/ia32/**',
    'win64' : 'bin/win32/x64/**'
};

function do_build(platform) {
    var nw = new NwBuilder({
        files: [
                './**/**',
                '!./bin/**',
                '!./build/**',
                '!./cache/**',
                './' + binMap[platform],
                ], // use the glob format
        platforms: [platform],
        macZip: true,
        winIco: './llama.ico',
        buildType: 'versioned'
    });
    //Log stuff you want
    nw.on('log',  console.log);

    // Build returns a promise
    nw.build().then(function () {
       console.log('all done!');
    }).catch(function (error) {
        console.error(error);
    });
}

for (var platform in binMap) {
    do_build(platform);
}