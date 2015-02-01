function Filter() {
  var self = this;
  _log = (function (methods, undefined) {
    var Log = Error; // does this do anything?  proper inheritance...?
    Log.prototype.write = function (args, method) {
      /// <summary>
      /// Paulirish-like console.log wrapper.  Includes stack trace via @fredrik SO suggestion (see remarks for sources).
      /// </summary>
      /// <param name="args" type="Array">list of details to log, as provided by `arguments`</param>
      /// <param name="method" type="string">the console method to use:  debug, log, warn, info, error</param>
      /// <remarks>Includes line numbers by calling Error object -- see
      /// * http://paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
      /// * http://stackoverflow.com/questions/13815640/a-proper-wrapper-for-console-log-with-correct-line-number
      /// * http://stackoverflow.com/a/3806596/1037948
      /// </remarks>

      // via @fredrik SO trace suggestion; wrapping in special construct so it stands out
      var suffix = {
          "@": (this.lineNumber ? this.fileName + ':' + this.lineNumber + ":1" // add arbitrary column value for chrome linking
                  : extractLineNumberFromStack(this.stack)
          )
      };
      if (method == "error" && global.LM) {
        LM.errorMessage(suffix['@'] + '\n\n' + args.join("\n\n"));
      }
      if (method == "warn" && global.LM) {
        // console.dir(args);
        LM.warnMessage(suffix['@'] + '\n\n' + args.join("\n\n"));
      }

      args = args.concat([suffix]);
      // via @paulirish console wrapper
      if (console && console[method]) {
        if (console[method].apply) {
          console[method].apply(console, args);
        } else {
          console[method](args);
        } // nicer display in some browsers
      }
    };
    var extractLineNumberFromStack = function (stack) {
      /// <summary>
      /// Get the line/filename detail from a Webkit stack trace.  See http:/stackoverflow.com/a/3806596/1037948
      /// </summary>
      /// <param name="stack" type="String">the stack string</param>
    
      // correct line number according to how Log().write implemented
      // console.log(stack.split('\n')[3]);
      var line = stack.split('\n')[3];
      // fix for various display text
      line = (line.indexOf(' (') >= 0 ? line.split(' (')[1].substring(0, line.length - 1) : line.split('at ')[1]);
      return line;
      };
    
      // method builder
      var logMethod = function(method) {
          return function (params) {
              /// <summary>
              /// Paulirish-like console.log wrapper
              /// </summary>
              /// <param name="params" type="[...]">list your logging parameters<param>
              // only if explicitly true somewhere
              // if (typeof DEBUGMODE === typeof undefined || !DEBUGMODE) return;


              // call handler extension which provides stack trace
              Log().write(Array.prototype.slice.call(arguments, 0), method); // turn into proper array & declare method to use
          };//--  fn  logMethod
      };
      var result = logMethod('log'); // base for backwards compatibility, simplicty
      // add some extra juice
      for(var i in methods) result[methods[i]] = logMethod(methods[i]);

      return result; // expose
    })(['log', 'error', 'debug', 'info', 'warn']);//--- _log

    self.logger = _log;
}

module.exports = new Filter;