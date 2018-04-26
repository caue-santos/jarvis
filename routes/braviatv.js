'use strict'

var express = require('express');
var router = express.Router();
var request = require('request');
var config = require('../jarvis/services/config').getConfig();
var buildPlayAction = require('../jarvis/services/actionsProcessor').buildPlayAction;

router.get('/', function (req, res, next) {

    var serviceConfig = config.jarvis.services.braviatv;

    var url = "http://" + serviceConfig.ip + "/sony/IRCC";

    request.post({
        url: url,
        body: buildRequest("netflix"),
        headers: {
            'X-Auth-PSK': serviceConfig.key
        }
    },
        function (err, httpResponse, body) {
            if (err) {
                res.send(err);
            }
            else {
                res.send(buildPlayAction(serviceConfig.success_message));
            }
        });

});

function buildRequest(action) {

    var string = '<?xml version="1.0" encoding="utf-8"?>' +
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
        '   <s:Body> ' +
        '       <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">' +
        '	<IRCCCode>AAAAAgAAABoAAAB8Aw==</IRCCCode>' +
        '</u:X_SendIRCC>' +
        '</s:Body>' +
        '</s:Envelope> ';

    return string;

}

module.exports = router;