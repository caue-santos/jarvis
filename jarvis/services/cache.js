'use strict'

var fs = require('fs');
var cacheConfig = require('./config').getConfig();

const CACHE_DIR = "/tmp/jarviscache";
const CACHE_CONFIG = CACHE_DIR + "/cache.json";

var Logger = require('../logger');
var logger = new Logger("CACHE");

class Cache {

    constructor(serviceName) {
        this.serviceName = serviceName;
        this.serviceConfig = cacheConfig.jarvis.services.cache;
        this.config = this.getConfig();

    }

    putFileCacheValue(key, fileName) {
        var cacheFileName = this.serviceConfig.cacheDir + "/" + "cache_" + new Date().getTime();
        var _cache = this;

        fs.copyFile(fileName, cacheFileName, function () {
            _cache.putCacheValue(key, cacheFileName);
        });
    }

    putCacheValue(key, value) {
        logger.log('Adding to cache. [key =' + key + ', value=' + value + ']');
        this.config.entries.push({ key: key, value: value, service: this.serviceName, date: new Date().getTime() });
        this.saveConfig();
    }

    getCacheValue(key) {

        for (var i in this.config.entries) {
            if (this.config.entries[i].key == key && this.config.entries[i].service == this.serviceName) {
                logger.log('Found in cache [value=' + this.config.entries[i].value + ']');
                return this.config.entries[i].value;
            }
        }

        return undefined;
    }

    saveConfig() {
        fs.writeFile(this.serviceConfig.cacheConfig, JSON.stringify(this.config), function () {
            logger.log('Cache saved.')
        });
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.serviceConfig.cacheConfig, 'utf8'));
        } catch (err) {
            return this.config = {
                "entries": [
                ]
            };
        }

    }
}

module.exports = Cache;