var colors = require('colors');
var logger = require('tracer');

function Filter() {
  var self = this;
  self.filter = function(message, data) {
    // if (data.level >= 4 && global.LM) {
    //   LM.errorMessage(message);
    // }
    return message;
  };
  self.logger = logger.colorConsole({
    transport : function(data) {
        if (data.level <=  2) { console.log(data.output);}
        if (data.level === 3) { console.info(data.output);}
        if (data.level === 4) {
          console.warn(data.output);
          if (global.LM) {
            LM.warningMessage(data.message);
          }
        }
        if (data.level === 5) {
          if (global.LM) {
            LM.errorMessage(data.message);
          }
          console.error(data.output);
        }
    },
    format: [
            "<{{title}}> (in {{file}}:{{line}})\n{{message}}", //default format
            {
                error : "<{{title}}> (in {{file}}:{{line}})\n{{message}}\nCall Stack:\n{{stack}}" // error format
            }
    ],
    filters: [
             colors.underline, colors.blue,
             {
               warn : [self.filter, colors.yellow],
               error : [self.filter, colors.red, colors.bold ]
             }
    ]
  });
}

module.exports = new Filter;