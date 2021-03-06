/**
 * Listener implementation which uses snowboy hotword
 * detection.
 *
 * It will work as detailed below:
 *
 * 1. Waits for the hotword;
 * 2. When the hotword is detected, it will call jarvis.waitForCommand'
 * 3. Every sound afer that is collected until stillNotReadyForCommand is false;
 * 4. The resulting wav is then given to jarvis for processing.
 */

'use strict';

const record = require('node-record-lpcm16');
const Detector = require('snowboy').Detector;
const Models = require('snowboy').Models;
const events = require('./events');

let Logger = require('../logger');

/**
 * CORE configuration
 */
const coreConfig = require('../config/core.json');
const JARVIS_BUSY =
    'Hotword received but Jarvis is currently busy. Ignoring...';

let waitingForCommand = false;
let processingCommand = false;
let silenceEvents = 0;
let commandEvents = 0;

let FINALBUFFER = Buffer.from('');
let processCommandIniTime;

let jarvis;
let logger = new Logger('SLISTENER');

/**
 * Set jarvis
 *
 * @param {*} _jarvis
 */
function setJarvis(_jarvis) {
    jarvis = _jarvis;
}

/**
 * Retrieves the jarvis
 *
 * @return {*} jarvis
 */
function getJarvis() {
    return jarvis;
}

/**
 * Starts the core.
 */
function start() {
    jarvis.start();
    events.setupEvents(jarvis, () => {
      resetFlags();
    });
    jarvis.processCommandText(coreConfig.initial_question, () => { });
    startHotWordDetector();
}

/**
 * Saves buffer to FINALLBUFFER
 *
 * @param {*} buffer
 */
function saveCommandBuffer(buffer) {
    /**
     * Skips the very first chunk after the keyword. Usually it's the beep!
     */
    if (commandEvents === 0 && coreConfig.skip_first_chunk) {
        return;
    }

    logger.log('Saving command buffer.');
    FINALBUFFER = saveBuffer(buffer, FINALBUFFER);
}

/**
 * Uses snowboy for hotwork detection and calls jarvis when needed
 */
function startHotWordDetector() {
    const models = new Models();

    models.add({
        file: coreConfig.detector.model,
        sensitivity: coreConfig.detector.sensitivity,
        hotwords: coreConfig.detector.hotwords,
    });

    const detector = new Detector({
        resource: coreConfig.detector.resource,
        models: models,
        audioGain: coreConfig.detector.audio_gain,
        applyFrontend: coreConfig.detector.applyFrontend,
    });

    detector.on('silence', function() {
        if (waitingForCommand && processingCommand) {
            silenceEvents++;

            if (stillNotReadyForCommand()) {
                return;
            }

            processCommand();
        }
    });

    detector.on('sound', function(buffer) {
        if (waitingForCommand) {
            commandEvents++;
            processingCommand = true;

            if (stillNotReadyForCommand()) {
                saveCommandBuffer(buffer);
            } else {
                processCommand();
            }
        }
    });

    detector.on('error', function() {
        logger.logError('error');
    });

    detector.on('hotword', function(index, hotword, buffer) {
        silenceEvents = 0;

        logger.log('Hotword [' + hotword + '] received at index ['
            + index + ']');

        if (waitingForCommand) {
            saveCommandBuffer(buffer);
            return;
        }

        if (jarvis.busy || processingCommand) {
            logger.log(JARVIS_BUSY);
            return;
        }

        jarvis.waitForCommand(() => {});

        waitingForCommand = true;
    });

    const mic = record.start({
        threshold: 0,
        channels: 1,
        sampleRate: 16000,
        device: coreConfig.devices.mic,
        verbose: false,
    });

    mic.pipe(detector);

    logger.log('STARTED');

    if (coreConfig.logging.dumpFlags) {
        dumpFlags();
    }
}

/**
 * Saves the intermediate buffer
 *
 * @param {*} buffer
 * @param {*} finalBuffer
 * @return {*} newBuffer
 */
function saveBuffer(buffer, finalBuffer) {
    let newBuffer = Buffer.concat([finalBuffer, buffer]);
    return newBuffer;
}

/**
 * Adds a wav header to the buffer
 *
 * @param {*} buffer
 * @return {*} newBuffer
 */
function writeWavHeader(buffer) {
    let wav = require('wav');
    let writer = new wav.Writer();

    writer.write(buffer);
    writer.end();

    return Buffer.concat([writer._header, buffer]);
}

/**
 * Process command
 */
function processCommand() {
    logger.log('Processing command. [ commandEvents=' + commandEvents +
        ', silenceEvents=' + silenceEvents + ' ]');

    resetFlags();

    processCommandIniTime = new Date().getTime();

    jarvis.processCommandBuffer(writeWavHeader(FINALBUFFER), () => {
        /**
         * Total time spent for processing a command.
         */
        let totalTime = new Date().getTime() - processCommandIniTime;
        logger.log('TOTAL COMMAND PROCESSING TIME = [' + totalTime + '] ms');

        /**
         * Give it sometime for JARVIS to talk.
         * Avoid Jarvis responding to itself :-)
         */
        setTimeout(function() {
            processingCommand = false;
            FINALBUFFER = Buffer.from('');
        }, coreConfig.wait_for_javis_time);
    });
}

/**
 * Verifies if the command is ready to be processed
 *
 * @return {*} boolean
 */
function stillNotReadyForCommand() {
    if (commandEvents >= coreConfig.command.max) {
        return false;
    }

    if (silenceEvents <= coreConfig.silence.min) {
        return true;
    }

    if (commandEvents < coreConfig.command.min &&
        silenceEvents <= coreConfig.silence.max
    ) {
        return true;
    }
}

/**
 * Dumps the current flags to the console
 */
function dumpFlags() {
    logger.log('STATUS [waiting_for_comand=' + waitingForCommand +
        ', processing_command=' + processingCommand + ']');
    logger.log('EVENTS [silence=' + silenceEvents + ', command=' +
        commandEvents + ']');
    setTimeout(dumpFlags, coreConfig.logging.dumpFlagsInterval);
}

/**
 * Resets all internal flags
 */
function resetFlags() {
    waitingForCommand = false;
    processingCommand = false;
    silenceEvents = 0;
    commandEvents = 0;
}

exports = module.exports = {start, getJarvis, setJarvis};
