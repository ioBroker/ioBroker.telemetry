'use strict';

const utils       = require('@iobroker/adapter-core');
const axios       = require('axios');
const adapterName = require('./package.json').name.split('.').pop();

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
let telemetryObjects = {};

const roles = [
    'sensor.motion',
    'sensor.rain',
    'sensor.lock',
    'button.*',
    'value.window',
    'value.temperature',
    'level.temperature',
    'value.humidity',
    'value.blood.sugar',
    'level.co2',
    'level.co2',
    'value.health.*'
];

function isRoleRequired(role) {
    if (roles.includes(role)) {
        return true;
    } else {
        return !!roles.filter(r => r.includes('*')).find(r => role.startsWith(r.substring(0, r.length - 1)));
    }
}

async function updateObjects(object) {
    const settings = await adapter.getObjectAsync('settings');
    if (!object || !object.common) {
        return;
    }

    if (isRoleRequired(object.common.role) || settings.native.telemetryObjects.includes(object._id)) {
        if (!settings.native.telemetryObjects.includes(object._id)) {
            await saveObjects();
        }
    }
}

async function addEvent(_id, state) {
    const settings = await adapter.getObjectAsync('settings');
    const telemetryObjects = settings.native.telemetryObjects;

    if (!telemetryObjects.includes(_id)) {
        return;
    }

    const object = await adapter.getForeignObjectAsync(_id);

    const debounce = object.common.custom[adapter.namespace].debounce ?
        object.common.custom[adapter.namespace].debounce :
        adapter.config[object.common.role + '_debounce'];

    if (parseInt(object.common.custom[adapter.namespace].ignore)
        || object.common.custom[adapter.namespace].lastEvent && (Date.now() - object.common.custom[adapter.namespace].lastEvent < debounce)
    ) {
        return;
    }

    let events = settings.native.events;
    if (!events) {
        events = [];
    }

    object.common.custom[adapter.namespace].lastEvent = Date.now();
    if (!object.common.custom[adapter.namespace].eventsInHour) {
        object.common.custom[adapter.namespace].eventsInHour = [];
    }
    object.common.custom[adapter.namespace].eventsInHour.push(object.common.custom[adapter.namespace].lastEvent);
    object.common.custom[adapter.namespace].eventsInHour = object.common.custom[adapter.namespace].eventsInHour.filter(time => Date.now() - time < 60 * 60 * 1000);
    adapter.log.info(`Change object ${_id}`);
    adapter.setForeignObject(_id, object);

    state.uuid = (await adapter.getForeignObjectAsync('system.meta.uuid')).native.uuid;

    state._id = _id;

    events.push(state);
    settings.native.events = events;
    adapter.setObject('settings', settings);

    // TODO: here is the problem - if event will not come in the next 5 minutes, the queue will not be saved, even if it has 99 events
    if (events.length >= 100 || settings.native.lastSend && settings.native.lastSend - Date.now() > 5 * 60 * 1000) {
        await sendEvents();
    }
}

async function saveObjects() {
    await adapter.unsubscribeForeignObjectsAsync('*');
    const objects = await adapter.getForeignObjectsAsync('*');
    const settings = await adapter.getObjectAsync('settings');

    settings.native.telemetryObjects = [];
    adapter.unsubscribeForeignStates('*');

    telemetryObjects = {};
    for (const i in objects) {
        const object = objects[i];
        if (object.common && object.common.role) {
            if (roles.includes(object.common.role)) {
                adapter.log.info(`Telemetry object ${object._id}`);
                telemetryObjects.push(object._id);

                if (!object.common.custom) {
                    object.common.custom = {};
                }
                if (!object.common.custom[adapter.namespace]) {
                    // TODO: custom['telemetry.0'] must have mandatory parameter "enabled": true, else it will be deleted by controller.
                    // but it is not required to write redundant info. We know, that it is enabled by default, so we must write it only if
                    // it must be ignored: {enabled: true, ignored: true}
                    object.common.custom[adapter.namespace] = {};
                }

                // TODO: Write information here only if really changed.
                adapter.subscribeForeignStates(object._id);
            }
        }
    }


    adapter.log.info(JSON.stringify(settings.native.telemetryObjects));
    // TODO: why you save here the redundant information? We have stored all required info in the objects itself
    await adapter.setObjectAsync('settings', settings);
    await adapter.subscribeForeignObjectsAsync('*');
}

async function sendEvents() {
    // TODO: it is not good to read the settings object (that anyway does not required) from DB. Why not to store it in RAM?
    const settings = await adapter.getObjectAsync('settings');
    let events = settings.native.events;
    if (!events) {
        events = [];
    }
    try {
        const result = await axios.post(adapter.config.url, events);
        for (const i in events) {
            const event = events[i];
            // TODO: do not use Objects for dynamic data. States are for that.
            const object = await adapter.getForeignObjectAsync(event._id);
            object.common.custom[adapter.namespace].lastSend = Date.now(); // TODO: why you need it?

            adapter.setForeignObject(object._id, object);
        }
        events = [];
        adapter.writeFile(adapter.namespace, 'telemetry_events.json', JSON.stringify(events));
        settings.native.lastSend = Date.now();
        settings.native.events = events;

        adapter.setObject('settings', settings);

        if (result) {
            for (const i in result) {
                const answer = result[i];
                const object = await adapter.getForeignObjectAsync(answer._id); // TODO Store this information in RAM and not read every time from DB
                let changed;

                if (answer.ignore !== undefined && object.common.custom[adapter.namespace].ignore !== answer.ignore) {
                    changed = true;
                    object.common.custom = object.common.custom || {};
                    object.common.custom[adapter.namespace] = object.common.custom[adapter.namespace] || {};
                    object.common.custom[adapter.namespace].ignore = !!answer.ignore;
                    object.common.custom[adapter.namespace].enabled = true;
                }
                if (answer.debounce !== undefined && object.common.custom[adapter.namespace].debounce !== answer.debounce) {
                    changed = true;
                    object.common.custom = object.common.custom || {};
                    object.common.custom[adapter.namespace] = object.common.custom[adapter.namespace] || {};
                    object.common.custom[adapter.namespace].enabled = true;
                    object.common.custom[adapter.namespace].debounce = answer.debounce;
                }
                changed && await adapter.setForeignObjectAsync(object._id, object);
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
        name: adapterName,

        // The ready callback is called when databases are connected and adapter received configuration.
        // start here!
        ready: main, // Main method defined below for readability

        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: callback => {
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
            if (id && state && state.val !== null && state.val !== undefined) {
                // The state was changed
                // adapter.log.info(JSON.stringify(state));
                // adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                addEvent(id, state);
            }
        },

        message: (obj) => {
            if (typeof obj === 'object' && obj.message && obj.callback) {
                if (obj.command === 'browse') {
                    // Send response in callback if required
                    adapter.sendTo(obj.from, obj.command, {result: telemetryObjects}, obj.callback);
                }
            }
        },
    }));
}

async function main() {

    // Reset the connection indicator during startup
    await adapter.setStateAsync('info.connection', false, true);

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:

    await saveObjects();

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


    // TODO: Set this state to true with the first successful POST request
    // And set to false if the POST fails (no connection)
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