var Boom = require('boom');
const Joi = require('joi');
//For generating JWT
var jwt = require('./jwt.js');
//For caching tokens and secrets
const NodeCache = require("node-cache");
const deviceCodeCache = new NodeCache();
//For generating tokens
const uuidV4 = require('uuid/v4');
//Token TTL
const AT_TTL_SEC = 3600;
//Service config containing AerPort accountId and credentials
var serviceConfig = require("./serviceConfig.json");
//AerPort connectivity platform api client
var caasClient = require("./aerCaaSClient");
//Google IoT project config
//projects/api-project-246376459450/locations/us-central1/registries/MyReg1/devices/AER0000007396636
var project = 'api-project-246376459450';
var location = 'us-central1';
var registry = 'MyReg1';

//For testing only
const sendSms = false;

//Route Handlers
const authHandler = function(request, reply) {
  console.log("Received AUTH request ", request.payload, request.headers);
  var deviceProfileId = request.payload.clientId;
  var headers = request.headers;
  //If Authorization header present
  if (headers && headers['authorization'] != null) {
    var authHeader = headers['authorization'];
    var token = deviceCodeCache.get(deviceProfileId + "_token");
    deviceCodeCache.del(deviceProfileId + "_token");
    console.log("token from cache " + token);
    if (token !== authHeader) {
      //If header does not have the expected value, return forbidden
      reply(Boom.forbidden('forbidden'));
    } else {
      //If header has the expected value then send code
      var clientSecret = new Buffer(uuidV4()).toString('base64');
      var key = deviceProfileId + "_clientSecret";
      deviceCodeCache.set(key, clientSecret);
      var payload = {
        clientSecret: clientSecret
      }
      console.log("Auth response = ", payload);
      reply(payload);
    }
  } else {
    var token = deviceCodeCache.get(deviceProfileId + "_token");
    if (!token) {
      var token = new Buffer(uuidV4()).toString('base64');
      deviceCodeCache.set(deviceProfileId + "_token", token);
      console.log("Token = " + token);
      //Send token via SMS
      if (sendSms) {
        caasClient.getNetworkStatus(serviceConfig.accountId, serviceConfig.apiKey, deviceProfileId, 'oauth@google.com', function(response) {
          if (response && response.IMSI) {
            var imsi = response.IMSI;
            caasClient.sendSms(serviceConfig.accountId, serviceConfig.apiKey, imsi, 'code:' + token + ';state:' + state, function(response) {
              if (response !== "undefined") {
                console.log("AerFrame Response = ", response);
                var messageId = response.substr(response.lastIndexOf('/'));
              }
            });
          }
        });
      }
    }
    reply(Boom.unauthorized("Unauthorized"));
  }
}

const tokenHandler = function(request, reply) {
  console.log("Received Token Request ", request.payload, request.headers);
  var deviceProfileId = request.payload.clientId;
  var key = deviceProfileId + "_clientSecret";
  var secretFromCache = deviceCodeCache.get(key);
  if (secretFromCache !== request.payload.clientSecret) {
    reply(Boom.forbidden('forbidden'));
  }
  //Generate signed JWT
  var token = {
    sub: request.payload.clientId,
    exp: parseInt(Date.now() / 1000) + AT_TTL_SEC,
    iss: 'https://localhost:3000/oauth',
    aud: 'api-project-246376459450',
    jti: uuidV4(),
    iat: parseInt(Date.now() / 1000),
  };
  var signedToken = jwt.signToken(token);
  //Send token along with project, location and registry
  var payload = {
    'access_token': signedToken,
    'token_type': 'bearer',
    'expires_in': AT_TTL_SEC
  };
  console.log("Token response = ", payload);
  reply(payload).header('giot_project', project).header('giot_location', location).header('giot_registry', registry);
}

//Route config
const authConfig = {
  handler: authHandler,
  validate: {
    payload: {
      clientId: Joi.string().min(1).required(),
      state: Joi.string().min(1).required(),
      scope: Joi.string(),
      response_type: Joi.string().min(1).required()
    }
  }
};

const tokenConfig = {
  handler: tokenHandler,
  validate: {
    payload: {
      clientId: Joi.string().min(1).required(),
      clientSecret: Joi.string().min(1).required(),
      grant_type: Joi.string().min(1).required()
    }
  }
};
