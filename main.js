'use strict';

const utils       = require('@iobroker/adapter-core');
const axios       = require('axios');
const crypto      = require('crypto');
const adapterName = require('./package.json').name.split('.').pop();

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
const telemetryObjects = {};
let events = [];
const hashes = {};
const subscribes = [];
let lastSend = Date.now();
let connected = false;
let sendTimeout = null;
let lastSendUpdate = null;

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
    'value.health.*'
];

let url;

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

function updateObject(id, object, sendUpdate) {
    const custom = (object && object.common && object.common.custom && object.common.custom[adapter.namespace]) || {};

    if (object && object.common && isRoleRequired(object.common.role) && !custom.ignore) {
        let hash = id.split('.');
        let start = hash.shift();
        start += '.' + hash.shift();
        hash = hash.join('.');
        hash = crypto.createHash('sha256').update(hash).digest('hex');

        hashes[start + '.' + hash] = id;

        telemetryObjects[id] = {
            debounce: custom.debounce,
            ignore: false,
            lastSend: telemetryObjects[id] ? telemetryObjects[id].lastSend : 0,
            hash,
            eventsInHour: [],
            name: object.common.name,
            role: object.common.role,
        };

        if (!subscribes.includes(id)) {
            adapter.subscribeForeignStates(id);
            subscribes.push(id);
        }
    } else {
        if (telemetryObjects[id] && telemetryObjects[id].hash && hashes[telemetryObjects[id].hash]) {
            delete hashes[telemetryObjects[id].hash];
        }

        if (custom.ignore) {
            telemetryObjects[id] = {
                debounce: custom.debounce,
                ignore: true,
                name: object.common.name,
                role: object.common.role,
            };
        } else if (telemetryObjects[id]) {
            delete telemetryObjects[id];
        }
        const pos = subscribes.indexOf(id);

        if (pos !== -1) {
            adapter.unsubscribeForeignStates(id);
            subscribes.splice(pos, 1);
        }
    }

    sendUpdate && adapter.setState('data.update', true, true);
}

async function fetchObjects() {
    const objects = await adapter.getForeignObjectsAsync('*');

    for (const i in objects) {
        const object = objects[i];
        if (object.common && object.common.role) {
            if (isRoleRequired(object.common.role)) {
                updateObject(object._id, object);
            }
        }
    }

    adapter.setState('data.update', true, true);

    adapter.log.info(JSON.stringify(telemetryObjects));

    await adapter.subscribeForeignObjectsAsync('*');
}

function sendUpdate() {
    if (Date.now() - lastSendUpdate > 15000) {
        sendTimeout && clearTimeout(sendTimeout);
        sendTimeout = null;
        lastSendUpdate = Date.now();
        adapter.setState('data.update', true, true);
        adapter.setState('data.events', JSON.stringify(events), true);
    } else {
        sendTimeout && clearTimeout(sendTimeout);
        sendTimeout = setTimeout(() => {
            sendTimeout = null;
            lastSendUpdate = Date.now();
            adapter.setState('data.update', true, true);
            adapter.setState('data.events', JSON.stringify(events), true);
        }, 1000);
    }
}

async function addEvent(id, state) {
    const object = telemetryObjects[id];
    if (!object || object.ignore) {
        return;
    }

    const debounce = object.debounce || adapter.config[object.role + '_debounce'];

    if (object.lastEvent && Date.now() - object.lastEvent < debounce) {
        return;
    }

    object.lastEvent = Date.now();
    object.eventsInHour.push(object.lastEvent);
    object.eventsInHour = object.eventsInHour.filter(time => Date.now() - time < 60 * 60 * 1000);

    delete state.c;
    delete state.q;
    delete state.user;
    delete state.lc;
    state.id = object.hash;
    state.role = object.role;

    events.push(state);

    sendUpdate();

    if (events.length >= 100 || (lastSend && Date.now() - lastSend > adapter.config.sendIntervalSec * 1000)) {
        eventsTimeout && clearTimeout(eventsTimeout);
        eventsTimeout = null;
        await sendEvents();
    } else {
        eventsTimeout = eventsTimeout || setTimeout(() => {
            eventsTimeout = null;
            sendEvents();
        }, adapter.config.sendIntervalSec * 1000 - (Date.now() - lastSend));
    }
}

async function sendEvents() {
    try {
        const result = await axios.post(url, events);

        updateConnection(true);
        const now = Date.now();
        for (const i in events) {
            const event = events[i];
            if (hashes[event.id] && telemetryObjects[hashes[event.id]]) {
                telemetryObjects[hashes[event.id]].lastSend = now;
            }
        }

        events = [];
        lastSend = Date.now();

        if (result) {
            for (const i in result) {
                const answer = result[i];
                let changed;
                const object = telemetryObjects[hashes[answer.id]];
                let realObj;
                if (object) {
                    if (answer.ignore !== undefined && object.ignore !== answer.ignore) {
                        changed = true;
                        realObj = await adapter.getForeignObjectAsync(object.id);
                        realObj.common.custom = object.common.custom || {};
                        realObj.common.custom[adapter.namespace] = realObj.common.custom[adapter.namespace] || {};
                        realObj.common.custom[adapter.namespace].ignore = !!answer.ignore;
                        realObj.common.custom[adapter.namespace].enabled = true;
                    }

                    if (answer.debounce !== undefined && object.common.custom[adapter.namespace].debounce !== answer.debounce) {
                        changed = true;
                        realObj = await adapter.getForeignObjectAsync(object.id);
                        realObj.common.custom = object.common.custom || {};
                        realObj.common.custom[adapter.namespace] = realObj.common.custom[adapter.namespace] || {};
                        realObj.common.custom[adapter.namespace].enabled = true;
                        realObj.common.custom[adapter.namespace].debounce = answer.debounce;
                    }
                    if (changed) {
                        // if default settings, just delete custom settings
                        if (!realObj.common.custom[adapter.namespace].ignore && !realObj.common.custom[adapter.namespace].debounce) {
                            realObj.common.custom[adapter.namespace] = null;
                        }
                        await adapter.setForeignObjectAsync(object.id, realObj);
                    }
                }
            }
        }
        sendUpdate();
    } catch (e) {
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
                eventsTimeout && clearTimeout(eventsTimeout);
                eventsTimeout = null;

                if (sendTimeout) {
                    adapter.setState('data.events', JSON.stringify(events), true);
                    clearTimeout(sendTimeout);
                    sendTimeout = null;
                }

                callback && callback();
            } catch (e) {
                callback && callback();
            }
        },

        // If you need to react to object changes, uncomment the following method.
        // You also need to subscribe to the objects with `adapter.subscribeObjects`, similar to `adapter.subscribeStates`.
        objectChange: async (id, obj) =>
            await updateObject(id, obj, true),

        // is called if a subscribed state changes
        stateChange: async (id, state) => {
            if (id && state && state.val !== null && state.val !== undefined) {
                // The state was changed
                // adapter.log.info(JSON.stringify(state));
                // adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                await addEvent(id, state);
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
    // parse all de-bounces
    Object.keys(adapter.config)
        .filter(attr => attr.endsWith('_debounce'))
        .forEach(attr =>
            adapter.config[attr] = parseInt(adapter.config[attr], 10) || 5000);

    adapter.config.sendIntervalSec = parseInt(adapter.config.sendIntervalSec, 10) || 300;

    const uuid = (await adapter.getForeignObjectAsync('system.meta.uuid')).native.uuid;
    url = adapter.config.url.endsWith('/') ? adapter.config.url + uuid : adapter.config.url + '/' + uuid;

    // Reset the connection indicator during startup
    await adapter.setStateAsync('info.connection', false, true);

    await fetchObjects();

    await sendEvents();
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}