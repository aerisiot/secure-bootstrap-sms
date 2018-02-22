'use strict';
//For better console.log for now
require( "console-stamp" )( console, { pattern : "yyyy/mm/dd HH:MM:ss.l" } );
//Hapi and its subcomponents
const Hapi = require('hapi');
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
var aerAccountId = serviceConfig.accountId;
var aerApiKey = serviceConfig.apiKey;
var aerAAApiBaseUrl = serviceConfig.aerAdminBaseUrl;
//AerPort connectivity platform api client
var caasClient = require("./aerCaaSClient");
//Encryption of SMS payload
var xxtea = require('xxtea');
var crypto = require('crypto'),
    algorithm = 'aes-128-ctr';
//Google IoT project config
//projects/api-project-246376459450/locations/us-central1/registries/MyReg1/devices/AER0000007396636
var project = 'api-project-246376459450';
var location = 'us-central1';
var registry = 'MyReg1';

//For testing only
const sendSms = true;

const server = new Hapi.Server();
server.connection({
  port: 3000,
  host: 'localhost'
});

//Route Handlers

function encrypt(payload, password) {
    console.log("payload, password", payload, password);
    var crypted = payload;
    //No encryption for now
    // var crypted = xxtea.encrypt(payload, password);
    // crypted = new Buffer(crypted).toString('base64');
    // crypted = Buffer.from(crypted, 'utf8').toString('hex');
    // var cipher = crypto.createCipher(algorithm, password);
    // var crypted = cipher.update(payload,'utf8','hex')
    // crypted += cipher.final('hex');
    console.log("encrypted ", crypted);
    return crypted;
}

const authHandler = function(request, reply) {
  console.log("********Received AUTH request ", request.payload, request.headers);
  var deviceProfileId = request.payload.clientId;
  var clientState = request.payload.state;
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
      caasClient.getNetworkStatus(aerAAApiBaseUrl, aerAccountId, aerApiKey, deviceProfileId, 'oauth@google.com', function(response) {
        if (response && response.IMSI) {
          var imsi = response.IMSI;
          var dataSession = response.dataSession;
          if (dataSession) {
            var ipAddress = dataSession.ipAddress;
            var smsPayload = encrypt(token + ':' + clientState, ipAddress);
            if (sendSms) {
              caasClient.sendSms(serviceConfig.accountId, serviceConfig.apiKey, imsi, smsPayload, function(response) {
                if (response !== "undefined") {
                  var messageId = response.resourceURL.substr(response.resourceURL.lastIndexOf('/'));
                  console.log("Message Id = " + messageId);
                }
              });
            }
          }
        }
      });
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

//Routes
server.route({
  method: 'GET',
  path: '/about',
  handler: function(request, reply) {
    reply({app: 'oauth', status: 'OK', time: Date.now()});
  }
});

server.route({
  method: 'POST',
  path: '/token',
  config: tokenConfig
});

server.route({
  method: 'POST',
  path: '/auth',
  config: authConfig
});

server.start((err) => {
  if (err) {
    throw err;
  }
  console.log(`Server running at: ${server.info.uri}`);
});
