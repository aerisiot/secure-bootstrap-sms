var jsonwebtoken = require('jsonwebtoken');
const fs = require('fs');
var path = require('path');

var privateKey = fs.readFileSync(path.join(__dirname, './secrets/oauth_jwt_rsa_priv.pem'));

var jwt = (function() {
  return {
    signToken: function(payload) {
      var token = jsonwebtoken.sign(payload, {
        key: privateKey
      }, {
        algorithm: 'RS256'
      });
      return token;
    }
  };
})();
module.exports = jwt;
