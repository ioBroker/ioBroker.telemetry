'use strict';

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios');

// Load your modules here, e.g.:
// const fs = require("fs");

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;

const roles = ['windows', 'temperature', 'gas', 'light', 'motion'];


async function updateObjects(object) {
    let settings = await adapter.getForeignObjectAsync('telemetry.0.settings');
    if (roles.includes(object._id) || settings.native.telemetryObjects.includes(object._id)) {
        if (roles.includes(object._id) != settings.native.telemetryObjects.includes(object._id)) {
            saveObjects();
        }
    }
}

async function addEvent(_id, state) {
    let adapterSettings = await adapter.getForeignObjectAsync('system.adapter.telemetry.0');
    let settings = await adapter.getForeignObjectAsync('telemetry.0.settings');
    let telemetryObjects = settings.native.telemetryObjects;
    if (!telemetryObjects.includes(_id)) {
        return;
    }

    let object = await adapter.getForeignObjectAsync(_id);

    const debounce = object.common.custom['telemetry.0'].debounce ?
        object.common.custom['telemetry.0'].debounce : 
        adapterSettings.native[object.common.role + '_debounce'];
    
    if (parseInt(object.common.custom['telemetry.0'].ignore) 
        || object.common.custom['telemetry.0'].lastEvent && (Date.now() - object.common.custom['telemetry.0'].lastEvent < debounce)
    ) {
        return;
    }

    let events = settings.native.events;
    if (!events) {
        events = [];
    }

    object.common.custom['telemetry.0'].lastEvent = Date.now();
    if (!object.common.custom['telemetry.0'].eventsInHour) {
        object.common.custom['telemetry.0'].eventsInHour = [];
    }
    object.common.custom['telemetry.0'].eventsInHour.push(object.common.custom['telemetry.0'].lastEvent);
    object.common.custom['telemetry.0'].eventsInHour = object.common.custom['telemetry.0'].eventsInHour.filter(time => Date.now() - time < 60 * 60 * 1000);
    adapter.log.info("Change object " + _id);
    adapter.setForeignObject(_id, object);
    
    let uuid = (await adapter.getForeignObjectAsync('system.meta.uuid')).native.uuid;
    state.uuid = uuid;
    
    state._id = _id;

    events.push(state);
    settings.native.events = events;
    adapter.setForeignObject('telemetry.0.settings', settings);
    
    if (events.length >= 100 || settings.native.lastSend && settings.native.lastSend - Date.now() > 5 * 60 * 1000) {
        sendEvents();
    }
}

async function saveObjects() {
    await adapter.unsubscribeForeignObjectsAsync('*');
    let objects = await adapter.getForeignObjectsAsync('*');
    let settings = await adapter.getForeignObjectAsync('telemetry.0.settings');
    settings.native.telemetryObjects = [];
    adapter.unsubscribeForeignStates('*');
    let telemetryObjects = settings.native.telemetryObjects;
    for (let i in objects) {
        let object = objects[i];
        if (object.common && object.common.role) {
            if (roles.includes(object.common.role)) {
                adapter.log.info("Telemetry object " + object._id);
                telemetryObjects.push(object._id);
                if (!object.common.custom) {
                    object.common.custom = {}
                }
                if (!object.common.custom['telemetry.0']) {
                    object.common.custom['telemetry.0'] = {}
                }
                adapter.setForeignObject(object._id, object);
                adapter.subscribeForeignStates(object._id);
            }
        }
    }
    adapter.log.info(JSON.stringify(settings.native.telemetryObjects));
    await adapter.setForeignObjectAsync('telemetry.0.settings', settings);
    await adapter.subscribeForeignObjectsAsync('*');
}

async function sendEvents() {
    let adapterSettings = await adapter.getForeignObjectAsync('system.adapter.telemetry.0');
    let settings = await adapter.getForeignObjectAsync('telemetry.0.settings');
    let events = settings.native.events;
    if (!events) {
        events = [];
    }
    try {
        const result = await axios.post(adapterSettings.native.url, events);
        for (let i in events) {
            let event = events[i];
            let object = await adapter.getForeignObjectAsync(event._id);
            object.common.custom['telemetry.0'].lastSend = Date.now();

            adapter.setForeignObject(object._id, object);
        }
        events = [];
        adapter.writeFile('telemetry.0', 'telemetry_events.json', JSON.stringify(events));
        settings.native.lastSend = Date.now();
        settings.native.events = events;
        adapter.setForeignObject('telemetry.0.settings', settings);

        if (result) {
            for (let i in result) {
                let answer = result[i];
                let object = await adapter.getForeignObjectAsync(answer._id);
                object.common.custom['telemetry.0'].ignore = answer.ignore;
                object.common.custom['telemetry.0'].debounce = answer.debounce;
                adapter.setForeignObject(object._id, object);
            }
        }
    } catch(e) {
        adapter.log.info(e);
    }
}

/**
 * Starts the adapter instance
 * @param {Partial<utils.AdapterOptions>} [options]
 */
function startAdapter(options) {
    // Create the adapter and define its methods
    return adapter = utils.adapter(Object.assign({}, options, {
        name: 'telemetry',

        // The ready callback is called when databases are connected and adapter received configuration.
        // start here!
        ready: main, // Main method defined below for readability

        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: (callback) => {
            try {
                // Here you must clear all timeouts or intervals that may still be active
                // clearTimeout(timeout1);
                // clearTimeout(timeout2);
                // ...
                // clearInterval(interval1);

                callback();
            } catch (e) {
                callback();
            }
        },

        // If you need to react to object changes, uncomment the following method.
        // You also need to subscribe to the objects with `adapter.subscribeObjects`, similar to `adapter.subscribeStates`.
        objectChange: (id, obj) => {
            if (obj) {
                // The object was changed
                // adapter.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
                updateObjects(obj);
            } else {
                // The object was deleted
                // adapter.log.info(`object ${id} deleted`);
            }
        },

        // is called if a subscribed state changes
        stateChange: (id, state) => {
            if (state) {
                // The state was changed
                // adapter.log.info(JSON.stringify(state));
                // adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                addEvent(id, state);
            } else {
                // The state was deleted
                adapter.log.info(`state ${id} deleted`);
            }
        },

        // If you need to accept messages in your adapter, uncomment the following block.
        // /**
        //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
        //  * Using this method requires "common.message" property to be set to true in io-package.json
        //  */
        // message: (obj) => {
        //     if (typeof obj === 'object' && obj.message) {
        //         if (obj.command === 'send') {
        //             // e.g. send email or pushover or whatever
        //             adapter.log.info('send command');

        //             // Send response in callback if required
        //             if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        //         }
        //     }
        // },
    }));
}

async function main() {

    // Reset the connection indicator during startup
    await adapter.setStateAsync('info.connection', false, true);

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:

    await saveObjects();
    /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
    */
    await adapter.setObjectNotExistsAsync('testVariable', {
        type: 'state',
        common: {
            name: 'testVariable',
            type: 'boolean',
            role: 'indicator',
            read: true,
            write: true,
        },
        native: {},
    });

    await adapter.setObjectNotExistsAsync('settings', {
        type: 'state',
        common: {
            name: 'settings',
            type: 'boolean',
            role: 'meta',
            read: true,
            write: true,
        },
        native: {},
    });

    // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
    // adapter.subscribeStates('testVariable');
    // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
    // adapter.subscribeStates('lights.*');
    // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
    // adapter.subscribeStates('*');

    /*
        setState examples
        you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
    */
    // the variable testVariable is set to true as command (ack=false)
    await adapter.setStateAsync('testVariable', true);

    // same thing, but the value is flagged "ack"
    // ack should be always set to true if the value is received from or acknowledged from the target system
    await adapter.setStateAsync('testVariable', { val: true, ack: true });

    // same thing, but the state is deleted after 30s (getState will return null afterwards)
    await adapter.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

    // examples for the checkPassword/checkGroup functions
    adapter.checkPassword('admin', 'iobroker', (res) => {
        adapter.log.info('check user admin pw iobroker: ' + res);
    });

    adapter.checkGroup('admin', 'admin', (res) => {
        adapter.log.info('check group user admin group admin: ' + res);
    });

    // Reset the connection indicator during startup
    await adapter.setStateAsync('info.connection', true, true);
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}