'use strict';

const utils       = require('@iobroker/adapter-core');
const axios       = require('axios');
const sha256       = require('js-sha256');
const adapterName = require('./package.json').name.split('.').pop();

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
let telemetryObjects = {};
let events = [];
let hashes = {};
let lastSend = Date.now();
let connected = false;

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

let uuid;

let eventsTimeout;

function isRoleRequired(role) {
    if (!role) {
        return false;
    }
    if (roles.includes(role)) {
        return true;
    } else {
        return !!roles.filter(r => r.includes('*')).find(r => role.startsWith(r.substring(0, r.length - 1)));
    }
}

function updateConnection(_connected) {
    if (connected !== _connected) {
        connected = _connected;
        adapter.setState('info.connection', connected, true);
    }
}

function addObject(id, object) {
    adapter.subscribeForeignStates(id);
    object.common.custom = object.common.custom || {};
    object.common.custom[adapter.namespace] = object.common.custom[adapter.namespace] || {};
    let hash = id.split('.');
    hash = hash.slice(2);
    hash = hash.join();
    hash = sha256(hash);
    object.common.custom[adapter.namespace].hash = hash;
    hashes[hash] = id;
    telemetryObjects[object._id] = object;
    adapter.setState('data.update', true, true);
}

function removeObject(id) {
    delete hashes[telemetryObjects[id].common.custom[adapter.namespace].hash];
    delete telemetryObjects[id];
    adapter.unsubscribeForeignStates(id);
    adapter.setState('data.update', true, true);
}

async function updateObject(id, object) {
    if (!object) {
        if (Object.keys(telemetryObjects).includes(object._id)) {
            removeObject(id);
        }
        return;
    }
    if (isRoleRequired(object.common.role) || Object.keys(telemetryObjects).includes(object._id)) {
        if (isRoleRequired(object.common.role) && !Object.keys(telemetryObjects).includes(object._id)) {
            addObject(id, object);
        }
        if (!isRoleRequired(object.common.role)) {
            removeObject(id);
        }
        if (Object.keys(telemetryObjects).includes(object._id)) {
            telemetryObjects[object._id].common.custom[adapter.namespace].debounce = object.common.custom[adapter.namespace].debounce;
            telemetryObjects[object._id].common.custom[adapter.namespace].ignore = object.common.custom[adapter.namespace].ignore;
            if (object.common.custom[adapter.namespace].ignore) {
                adapter.unsubscribeForeignStates(object._id);
            } else {
                adapter.subscribeForeignStates(object._id);
            }
            adapter.setState('data.update', true, true);
        }
    }
}

async function fetchObjects() {
    // await adapter.unsubscribeForeignObjectsAsync('*');
    const objects = await adapter.getForeignObjectsAsync('*');
    //const settings = await adapter.getObjectAsync('settings');

    adapter.unsubscribeForeignStates('*');

    telemetryObjects = {};
    for (const i in objects) {
        const object = objects[i];
        if (object.common && object.common.role) {
            if (isRoleRequired(object.common.role)) {
                addObject(object._id, object);
            }
        }
    }

    adapter.log.info(JSON.stringify(telemetryObjects));

    // TODO: why you save here the redundant information? We have stored all required info in the objects itself
    // await adapter.setObjectAsync('settings', settings);
    await adapter.subscribeForeignObjectsAsync('*');
}

async function addEvent(_id, state) {
    if (!Object.keys(telemetryObjects).includes(_id)) {
        return;
    }

    const object = telemetryObjects[_id];

    const debounce = object.common.custom[adapter.namespace].debounce ?
        object.common.custom[adapter.namespace].debounce :
        adapter.config[object.common.role + '_debounce'];

    if (parseInt(object.common.custom[adapter.namespace].ignore)
        || object.common.custom[adapter.namespace].lastEvent && (Date.now() - object.common.custom[adapter.namespace].lastEvent < debounce)
    ) {
        return;
    }

    object.common.custom[adapter.namespace].lastEvent = Date.now();
    if (!object.common.custom[adapter.namespace].eventsInHour) {
        object.common.custom[adapter.namespace].eventsInHour = [];
    }
    object.common.custom[adapter.namespace].eventsInHour.push(object.common.custom[adapter.namespace].lastEvent);
    object.common.custom[adapter.namespace].eventsInHour = object.common.custom[adapter.namespace].eventsInHour.filter(time => Date.now() - time < 60 * 60 * 1000);

    adapter.setState('data.events', JSON.stringify(events), true);

    state.uuid = uuid;
    state.hash = object.common.custom[adapter.namespace].hash;
    delete state._id;

    events.push(state);

    adapter.setState('data.update', true, true);

    if (events.length >= 100 || (lastSend && Date.now() - lastSend > 5 * 60 * 1000)) {
        await sendEvents();
        clearTimeout(eventsTimeout);
        eventsTimeout = setTimeout(sendEvents, 5 * 60 * 1000);
    }
}

async function sendEvents() {
    try {
        const result = await axios.post(adapter.config.url, events);
        updateConnection(true);
        for (const i in events) {
            const event = events[i];
            
            let object = telemetryObjects[event._id];
            object.common.custom[adapter.namespace].lastSend = Date.now();
        }
        events = [];
        lastSend = Date.now();

        ///adapter.setObject('settings', settings);

        if (result) {
            for (const i in result) {
                const answer = result[i];
                let changed;
                let object;

                if (answer.ignore !== undefined && object.common.custom[adapter.namespace].ignore !== answer.ignore) {
                    changed = true;
                    object = object || await adapter.getForeignObjectAsync(hashes[answer.hash]);
                    object.common.custom = object.common.custom || {};
                    object.common.custom[adapter.namespace] = object.common.custom[adapter.namespace] || {};
                    object.common.custom[adapter.namespace].ignore = !!answer.ignore;
                    object.common.custom[adapter.namespace].enabled = true;

                    if (answer.ignore) {
                        await adapter.unsubscribeForeignStates(object._id);
                    }
                }
                if (answer.debounce !== undefined && object.common.custom[adapter.namespace].debounce !== answer.debounce) {
                    changed = true;
                    object = object || await adapter.getForeignObjectAsync(hashes[answer.hash]);
                    object.common.custom = object.common.custom || {};
                    object.common.custom[adapter.namespace] = object.common.custom[adapter.namespace] || {};
                    object.common.custom[adapter.namespace].enabled = true;
                    object.common.custom[adapter.namespace].debounce = answer.debounce;
                }
                changed && await adapter.setForeignObjectAsync(object._id, object);
            }
        }
        adapter.setState('data.update', true, true);
    } catch(e) {
        updateConnection(false);
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
                clearTimeout(eventsTimeout);

                callback();
            } catch (e) {
                callback();
            }
        },

        // If you need to react to object changes, uncomment the following method.
        // You also need to subscribe to the objects with `adapter.subscribeObjects`, similar to `adapter.subscribeStates`.
        objectChange: (id, obj) =>
            updateObject(id, obj),

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
            if (typeof obj === 'object' && obj.callback) {
                if (obj.command === 'browse') {
                    // Send response in callback if required
                    adapter.sendTo(obj.from, obj.command, {result: telemetryObjects}, obj.callback);
                }
            }
        },
    }));
}

async function main() {

    uuid = (await adapter.getForeignObjectAsync('system.meta.uuid')).native.uuid

    // Reset the connection indicator during startup
    await adapter.setStateAsync('info.connection', false, true);

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:

    await fetchObjects();

    await sendEvents();

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
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}