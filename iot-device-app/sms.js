var sys = require('util'),
    childProcess = require('child_process'),
    gammu;

var SMS = {

    _command: function (cmd, callback) {
        gammu = childProcess.exec(cmd, function (error, stdout, stderr) {
            if (error) {
                //console.log(error.stack);
                //console.log('Error code: '+error.code);
                //console.log('Signal received: '+error.signal);
            }
            // console.log('Child Process STDOUT: '+stdout);
            // console.log('Child Process STDERR: '+stderr);
            if (callback) {
    		  callback(stdout);
    	    }
        });
        gammu.on('exit', function (code) {
            if (code) {
                //sys.log('Child process exited with exit code ' + code);
            }
        });
    },
    _parseSMS: function(response) {
      var lines = response.split('\n');
      var msgs = [];
      var msg;

      var line = '';
      for (var i = 0; i < lines.length; i++) {
        //console.log('RAW Line = ' + lines[i]);
        if (!lines[i] || lines[i] == null) {
          continue;
        }
        line = lines[i].toString().trim();


        if (line.startsWith('Location')) {
          if (msg) {
            // console.log(msg);
            msgs.push(msg);
          }

          msg = {};
          continue;
        }
        else if ((line.indexOf('SMS parts in') > 0) && (line.indexOf('SMS sequences') > 0)) {
          if (msg) {
            // console.log(msg);
            msgs.push(msg);
          }

          msg = {};
          continue;
        }
        else if (line.startsWith('SMS message')) {
          continue;
        }
        else if (line.startsWith('SMSC number')) {
          msg.smsc = line.substr(line.indexOf(':')+1).trim().replace(/"/g, '');
        }
        else if (line.startsWith('Sent')) {
          msg.date = new Date(line.substr(line.indexOf(':')+1).trim());
        }
        else if (line.startsWith('Coding')) {
          msg.coding = line.substr(line.indexOf(':')+1).trim();
        }
        else if (line.startsWith('Remote number')) {
          msg.remote = line.substr(line.indexOf(':')+1).trim().replace(/"/g, '');
        }
        else if (line.startsWith('Status')) {
          msg.status = line.substr(line.indexOf(':')+1).trim();
        } else {
          if (line.length > 0 && msg) {
            if (msg.content) {
              msg.content += line.trim();
            } else {
              msg.content = line.trim();
            }
          }
        }
      }
      //console.log(msgs);
      return msgs;
    },
    _filterRead: function(msgs) {
      index = msgs.length - 1;
      while (index >= 0) {
        if (msgs[index].status === 'Read') {
          msgs.splice(index, 1);
        }
        index -= 1;
      }
      return msgs;
    },


    identify: function (callback) {
        this._command('gammu --identify', function(response){
            if (callback) callback(response);
        });
    },

    pin: function (pincode, callback) {
        this._command('gammu --entersecuritycode PIN ' + pincode, function(response){
            if (callback) callback(response);
        });
    },

    send: function (input, callback) {
//        this._command('echo "' + input.text + '" | gammu --sendsms TEXT ' + input.to, function(response){
        this._command('gammu sendsms TEXT ' + input.to + ' -text "' + input.text + '"', function(response){
            if (callback) callback(response);
        });
    },

    getsms: function (callback) {
      var ref = this;
        this._command('gammu getallsms', function(response){
          var msgs = ref._parseSMS(response);
          var unread = ref._filterRead(msgs);
	        if (callback) callback(unread);
        });
    },
    getsmsTest: function(callback) {
      if(callback) {
        var msgs = [];
        var msg = {
          content: "YTI3YjUzZmItNTY4Ny00MzdlLWFiMWYtMzQxMGI1ODVkNGEz:localstate"
        }
        msgs.push(msg);
        callback(msgs);
      }
    },

    deletesms: function (callback) {
        this._command('gammu deleteallsms 3', function(response){
                if (callback) callback(response);
        });
    },

    reset: function (callback) {
        //this._command('gammu reset HARD', function(response){
        //    if (callback) callback(response);
        //});
    }

};

module.exports = SMS;
