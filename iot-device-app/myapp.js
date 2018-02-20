'use strict';
//For better console.log for now
require( "console-stamp" )( console, { pattern : "yyyy/mm/dd HH:MM:ss.l" } );

const uuidV4 = require('uuid/v4');
const mqtt = require('mqtt');
const axios = require('axios');
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
var sms = require("./sms");

const AUTH_URL = "http://localhost:3000/auth";
const TOKEN_URL = "http://localhost:3000/token";
const MQTT_URL = 'mqtts://mqtt.googleapis.com:8883';
var deviceId = 'AER0000007396636';
var clientSecretCache = "";

var localState = uuidV4();
var waitForSMS = false;

function getToken(url, payload) {
  console.log("Send Token request [url, payload] = ", url, payload);
  axios({
    method: 'post',
    url: url,
    data: payload
  }).then(function(response){
    console.log("Token response = ", response.data);
    var respData = response.data;
    var headers = response.headers;
    emitter.emit('ready', respData['access_token'],
      headers['giot_project'], headers['giot_location'], headers['giot_registry']);
  }).catch(function(error){
    console.log("error in getToken", error);
  });
}

emitter.on("getToken", function() {
  var payload = {
    clientId: deviceId,
    clientSecret: clientSecretCache,
    "grant_type": "client_credentials"
  };
  getToken(TOKEN_URL, payload);
});

function performAuth(url, payload, headers) {
  console.log("Send Auth request [url, payload, headers] = ", url, payload, headers);
  axios({
    method: 'post',
    url: url,
    data: payload,
    headers: headers
  }).then(function(response){
    console.log("Auth response = ", response.data);
    var respData = response.data;
    if (respData.clientSecret !== 'undefined') {
      clientSecretCache = respData.clientSecret;
      emitter.emit("getToken");
    }
  }).catch(function(error){
    var errorData = error.response.data;
    if (errorData && errorData.statusCode !== 401) {
      console.log("Auth Error = ", errorData);
    } else {
      console.log("Unauthorized. Check for SMS");
      waitForSMS = true;
      setTimeout(readAndFilterSMSes, 2000);
    }
  });
}

function readAndFilterSMSes() {
  sms.getsmsTest(function(msgs){
    if (msgs && msgs.length > 0) {
      console.log("Received sms ", msgs[0]);
      emitter.emit("authtoken", msgs[0]);
      waitForSMS = false;
    }
    if (waitForSMS === true) {
        setTimeout(readAndFilterSMSes, 2000);
    }
  });
}

emitter.on("authtoken", function(msg) {
    var contentParts = msg.content.split(":");
    var tokenFromServer = contentParts[0];
    var stateFromServer = contentParts[1];
    var headers = {
      "Authorization": tokenFromServer
    }
    var payload = {
      clientId: deviceId,
      state: localState,
      response_type: 'code'
    };
    performAuth(AUTH_URL, payload, headers);
});

emitter.on("ready", function(accessToken, project, location, registry){
  var _mqttClient = mqtt.connect(MQTT_URL, {
    username: "unused",
    password: accessToken,
    clientId: 'projects/'+project+'/locations/'+location+'/registries/'+registry+'/devices/'+deviceId,
    protocol: 'mqtts',
    secureProtocol: 'TLSv1_2_method'
  });
  //Publish IP interfaces on connect
  _mqttClient.on('connect', function(connack) {
    console.log("Connected to MQTT", connack);
    if (connack) {
      var payload = JSON.stringify({
        'state': 'online',
        'ts': Date.now(),
        'deviceId': deviceId
      });
      var topic = '/devices/'+deviceId+'/state';
      console.log('MQTT: Publishing state on topic topic %s, message %s', topic, payload);
      _mqttClient.publish(topic, payload, function(err){
        if(err) {
          console.log("Error in publish", err);
        }
      });
    }
  });
  _mqttClient.on('error', function(error) {
    console.log("Error from mqtt client", error);
  });
  _mqttClient.on('close', function(error) {
    console.log("CLosed mqtt client", error);
    emitter.emit("getToken");
  });
});

var payload = {
  clientId: deviceId,
  state: localState,
  response_type: 'code'
};
performAuth(AUTH_URL, payload);
