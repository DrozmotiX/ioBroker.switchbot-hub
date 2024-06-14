'use strict';

/*
 * Created with @ioBroker/create-adapter v1.34.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const stateAttr = require(`${__dirname}/lib/state_attr.js`); // Load attribute library
const irDeviceButtons = require(`${__dirname}/lib/irRemoteDevices.js`); // Load irRemote Button definitions
const {default: axios} = require('axios');
const crypto = require('crypto');
const https = require('https');
const { TextDecoder } = require('util');


const disableSentry = false; // Ensure to set to true during development !

// const stateExpire = {}; // Array containing all times for online state expire
const warnMessages = {}; // Array containing sentry messages
const dataRefreshTimer = {}; // Array containing all times for watchdog loops
const intervallSettings = {
	all: 60 * 60000,
	Curtain: 7 * 60000,
	Humidifier: 7 * 60000,
	Meter: 7 * 60000,
	Plug: 30 * 60000,
	SmartFan: 30 * 60000,
};

class SwitchbotHub extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'switchbot-hub',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));

		// Constructors keeping relevant information for data processing
		this.devices = {};
		this.createdStatesDetails = {};
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {

		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);

		// Check if token is provided
		if (!this.config.openToken) {
			this.log.error('*** No token provided, Please enter your token in adapter settings !!!  ***');
		}

		// Load intervall settings
		intervallSettings.all = this.config.intervallAll != null ? this.config.intervallAll * 60000 || intervallSettings.all : intervallSettings.all;
		intervallSettings.Curtain = this.config.intervallCurtain != null ? this.config.intervallCurtain * 60000 || intervallSettings.Curtain : intervallSettings.Curtain;
		intervallSettings.Humidifier = this.config.intervallHumidifier != null ? this.config.intervallHumidifier * 60000 || intervallSettings.Humidifier : intervallSettings.Humidifier;
		intervallSettings.Meter = this.config.intervallMeter != null ? this.config.intervallMeter * 60000 || intervallSettings.Meter : intervallSettings.Meter;
		intervallSettings.Plug = this.config.intervallPlug != null ? this.config.intervallPlug * 60000 || intervallSettings.Plug : intervallSettings.Plug;
		intervallSettings.SmartFan = this.config.intervallSmartFan != null ? this.config.intervallSmartFan * 60000 || intervallSettings.SmartFan : intervallSettings.SmartFan;

		// Request devices, create related objects and get all values
		try {
			await this.loadDevices();
		} catch (error) {
			this.log.error(`Init Error ${error}`);
		}

		// Start intervall to refresh all devices and data
		await this.dataRefresh('all');

	}

	/**
	 * Get & refresh all vales for specific device by intervall setting
	 *
	 * @param {string} [deviceId] - deviceId of SwitchBot device
	 */
	async dataRefresh(deviceId){

		let intervallTimer = intervallSettings.all;

		if (this.devices[deviceId] && this.devices[deviceId].intervallTimer) {
			intervallTimer = this.devices[deviceId].intervallTimer;
		}

		// Reset timer (if running) and start new one for next watchdog interval
		if (dataRefreshTimer[deviceId]) {
			clearTimeout(dataRefreshTimer[deviceId]);
			dataRefreshTimer[deviceId] = null;
		}
		dataRefreshTimer[deviceId] = setTimeout(async () => {

			if (deviceId !== 'all') { // Only refresh values of device

				await this.deviceStatus(deviceId);

			} else { // Refresh all  devices
				await this.loadDevices();
			}

		}, (intervallTimer));
	}

	/**
	 * Define proper intervall time for selected device type
	 *
	 * @param {string} [deviceId] - deviceId of SwitchBot device
	 */
	defineIntervallTime(deviceId){

		try {
			let timeInMs = 3600000; //  Default to 1 hour

			if (!this.devices[deviceId] || !this.devices[deviceId].deviceType) return;

			switch (this.devices[deviceId].deviceType) {
				case ('Plug'):
					timeInMs = intervallSettings.Plug;
					break;
				case ('Curtain'):
					timeInMs = intervallSettings.Curtain;
					break;
				case ('Meter'):
					timeInMs = intervallSettings.Meter;
					break;
				case ('Humidifier'):
					timeInMs = intervallSettings.Humidifier;
					break;
				case ('Smart Fan'):
					timeInMs = intervallSettings.SmartFan;
					break;
			}
			this.devices[deviceId].intervallTimer = timeInMs;

		} catch (error) {

			this.sendSentry(`[defineIntervallTime]`, `${error}`);

		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			for (const device in dataRefreshTimer) {
				if (dataRefreshTimer[device]) {
					clearTimeout(dataRefreshTimer[device]);
					delete dataRefreshTimer[device];
				}
			}
			// Reset the connection indicator during startup
			this.setState('info.connection', false, true);

			callback();
		} catch (e) {
			this.sendSentry(`[onUnload]`, `${e}`);
			callback();
		}
	}

	/**
	 * Make API call to SwitchBot API and return response.
	 * See documentation at https://github.com/OpenWonderLabs/SwitchBotAPI
	 *
	 * @param {string} [url] - Endpoint to handle API call, like `/v1.1/devices`
	 * @param {object} [data] - Data for api post calls, if empty get will be executed
	 */
	apiCall(url, data) {
		const ti = Date.now();
		const dataIn = this.config.openToken + ti;
		const signTerm = crypto.createHmac('sha256', this.config.secretKey)
			.update(Buffer.from(dataIn, 'utf-8'))
			.digest();
		const sign = signTerm.toString("base64");
		let methodSend = 'POST';
		if (!data) {
			methodSend = 'GET';
		}

		const options = {
			hostname: 'api.switch-bot.com',
			port: 443,
			path: url,
			method: methodSend,
			headers: {
				"Authorization": this.config.openToken,
				"sign": sign,
				"nonce": "",
				"t": ti,
				"Content-Type": "application/json; charset=utf8"
			}
		};
		if (!url) throw new Error(`No URL provided, cannot make API call`);
		if (!data) {
			return new Promise((resolve, reject) => {
				const req = https.request(options, res => {
					let dataArray;

					res.on('data', d => {
						dataArray = d;
					});

					res.on('end', () => {
						const out = new TextDecoder().decode(new Uint8Array(dataArray));
						try {
							resolve(JSON.parse(out));
						} catch (err) {
							reject(err);
						}
					});
				});

				req.on('error', error => {
					reject(error);
				});

				req.end();
			});


		} else {
			return new Promise((resolve, reject) => {
				const req = https.request(options, res => {
					let dataArray;

					res.on('data', d => {
						dataArray = d;
					});

					res.on('end', () => {
						const out = new TextDecoder().decode(new Uint8Array(dataArray));
						try {
							resolve(JSON.parse(out));
						} catch (err) {
							reject(err);
						}
					});
				});

				req.on('error', error => {
					reject(error);
				});
				req.write(data);
				req.end();
			});
		}
	}

	// Load all device and their related states & values
	async loadDevices() {
		try {

			// Call API and get all devices
			const apiResponse = await this.apiCall(`/v1.1/devices`);
			this.log.debug(`[getDevices API response]: ${JSON.stringify(apiResponse)}`);
			if (!apiResponse) {
				this.log.error(`Empty device list received, cannot process`);
				return;
			}
			this.setState('info.connection', true, true);

			const arrayHandler = async (deviceArray) => {
				for (const device in deviceArray) {
					this.devices[deviceArray[device].deviceId] = deviceArray[device];
					await this.extendObjectAsync(deviceArray[device].deviceId, {
						type: 'device',
						common: {
							name: deviceArray[device].deviceName
						},
						native: {},
					});

					await this.extendObjectAsync(`${deviceArray[device].deviceId}._info`, {
						type: 'channel',
						common: {
							name: `Device Information`
						},
						native: {},
					});

					//ToDo: consider to remove this channel or make optional
					// Write info data of device to states
					for (const infoState in deviceArray[device]) {
						await this.stateSetCreate(`${deviceArray[device].deviceId}._info.${infoState}`, infoState, deviceArray[device][infoState]);
					}

					// Create states not provided by API (no get, post  only)
					switch (deviceArray[device].deviceType) {

						case ('Bot'):
							await this.stateSetCreate(`${deviceArray[device].deviceId}.press`, `press`, null);
							await this.stateSetCreate(`${deviceArray[device].deviceId}.state`, `ON/OFF`, null);
							break;

					}

					// Request device values
					this.log.debug(`[deviceStatus for ]: ${JSON.stringify(this.devices[deviceArray[device].deviceId].deviceName)}`);
					await this.deviceStatus(deviceArray[device].deviceId);

					// Define intervall time (only if device has states)
					if (this.devices[deviceArray[device].deviceId] && this.devices[deviceArray[device].deviceId].states) {

						try {
							await this.defineIntervallTime(deviceArray[device].deviceId);
						} catch (e) {
							this.log.error(`Cannot process intervall timer definition ${e}`);
						}


					}

					// Start polling intervall for specific device
					await this.dataRefresh(deviceArray[device].deviceId);

				}
			};

			const deviceList = apiResponse.body.deviceList;
			const infraredRemoteList = apiResponse.body.infraredRemoteList;

			this.log.info(`Connected to SwitchBot API found ${deviceList.length} devices`);

			try {
				if (deviceList) {
					await arrayHandler(deviceList);
				} else {
					this.log.error(`Can not handle device list from SwitchBot API`);
				}

				if (infraredRemoteList != null) {
					await this.infraredRemoteDevices(infraredRemoteList);
				} else {
					this.log.error(`Can not handle infrared remote list from SwitchBot API`);
				}

			} catch (error) {
				this.sendSentry(`[arrayHandler]`, `${error}`);
			}

			this.log.info(`All devices and values loaded, adapter ready`);
			this.log.debug(`All devices configuration data : ${JSON.stringify(this.devices)}`);

		} catch (error) {
		//	this.sendSentry(`[loadDevices]`, `${error}`);
			this.setState('info.connection', false, true);
		}
	}

	/**
	 * Get all vales for specific device
	 *
	 * @param {string} [deviceId] - deviceId of SwitchBot device
	 */
	async deviceStatus(deviceId) {
		try {

			const apiResponse = await this.apiCall(`/v1.1/devices/${deviceId}/status`);
			const devicesValues = apiResponse.body;
			this.log.debug(`[deviceStatus apiResponse ]: ${JSON.stringify(apiResponse)}`);
			if (!devicesValues || Object.keys(devicesValues).length === 0) {
				this.log.debug(`No States found for type ${this.devices[deviceId].deviceType}`);
				return;
			}
			this.devices[deviceId].states = {};

			// Write status data of device to states
			for (const statusState in devicesValues) {
				await this.stateSetCreate(`${deviceId}.${statusState}`, statusState, devicesValues[statusState]);
				this.devices[deviceId].states[statusState] = devicesValues[statusState];
			}

		} catch (error) {
			this.sendSentry(`[deviceStatus]`, `${error}`);
		}
	}

	async infraredRemoteDevices(remoteArray) {
		try {
			for (const remoteControl in remoteArray) {
				this.devices[remoteArray[remoteControl].deviceId] = remoteArray[remoteControl];
				await this.extendObjectAsync(remoteArray[remoteControl].deviceId, {
					type: 'device',
					common: {
						name: remoteArray[remoteControl].deviceName
					},
					native: {},
				});

				// Write info data of device to states
				for (const infoState in remoteArray[remoteControl]) {
					await this.stateSetCreate(`${remoteArray[remoteControl].deviceId}._info.${infoState}`, infoState, remoteArray[remoteControl][infoState]);
				}

				// Get all required IR buttons from Library
				if (!irDeviceButtons[remoteArray[remoteControl].remoteType]){
					this.log.error(`IR Remote Type ${[remoteArray[remoteControl].remoteType]} not yet implemented`);
				}

				const allIrButtons = irDeviceButtons[remoteArray[remoteControl].remoteType];

				// Add default buttons if IR type !== Others
				if (remoteArray[remoteControl].remoteType !== 'Others'){
					allIrButtons.turnOn = {name: 'Turn device On'};
					allIrButtons.turnOff = {name: 'Turn device Off'};
				}

				// Create IR specific channels
				for (const irButton in allIrButtons) {

					const common = {
						name: allIrButtons[irButton].name,
						type: allIrButtons[irButton]!== undefined ? allIrButtons[irButton].type || 'number' : 'number',
						role: allIrButtons[irButton]!== undefined ? allIrButtons[irButton].type || 'button' : 'button',
						write: true,
					};

					if (allIrButtons[irButton].states){
						common.states = allIrButtons[irButton].states;
					}
					if (allIrButtons[irButton].def){
						common.def = allIrButtons[irButton].def;
					}
					const stateName = irButton.replace(' ', '_');
					await this.extendObjectAsync(`${remoteArray[remoteControl].deviceId}.${stateName}`, {
						type: 'state',
						common
					});
					this.subscribeStates(`${remoteArray[remoteControl].deviceId}.${stateName}`);
				}
			}
		}catch (error) {
			this.sendSentry(`[infraredRemoteDevices]`, `${error}`);
		}
	}

	/**
	 * State create and value update handler
	 * @param {string} stateName ID of state to create
	 * @param {string} name Name of object
	 * @param {object} value Value
	 */
	async stateSetCreate(stateName, name, value) {
		this.log.debug('Create_state called for : ' + stateName + ' with value : ' + value);

		try {

			// // Try to get details from state lib, if not use defaults. throw warning is states is not known in attribute list
			const common = {};
			if (!stateAttr[name]) {
				let warnMessage = `State attribute definition missing for : ${name}`;
				if (warnMessages[name] !== warnMessage) {
					warnMessages[name] = warnMessage;

					// Send information to Sentry with value
					warnMessage = `State attribute definition missing for : ${name} with value : ${value} `;
					// this.sendSentry(warnMessage, null);
					this.log.warn(warnMessage);
				}
			}

			if (stateAttr[name] !== undefined && stateAttr[name].min !== undefined) {
				common.min = stateAttr[name].min;
			}
			if (stateAttr[name] !== undefined && stateAttr[name].max !== undefined) {
				common.max = stateAttr[name].max;
			}
			if (stateAttr[name] !== undefined && stateAttr[name].def !== undefined) {
				common.def = stateAttr[name].def;
			}
			common.name = stateAttr[name] !== undefined ? stateAttr[name].name || name : name;
			common.type = stateAttr[name] !== undefined ? stateAttr[name].type || typeof (value) : typeof (value);
			common.role = stateAttr[name] !== undefined ? stateAttr[name].role || 'state' : 'state';
			common.read = true;
			common.unit = stateAttr[name] !== undefined ? stateAttr[name].unit || '' : '';
			common.write = stateAttr[name] !== undefined ? stateAttr[name].write || false : false;

			if ((!this.createdStatesDetails[stateName])
				|| (this.createdStatesDetails[stateName]
					&& (
						common.name !== this.createdStatesDetails[stateName].name
						|| common.name !== this.createdStatesDetails[stateName].name
						|| common.type !== this.createdStatesDetails[stateName].type
						|| common.role !== this.createdStatesDetails[stateName].role
						|| common.read !== this.createdStatesDetails[stateName].read
						|| common.unit !== this.createdStatesDetails[stateName].unit
						|| common.write !== this.createdStatesDetails[stateName].write
					)
				)) {

				this.log.debug(`An attribute has changed : ${stateName} | old ${this.createdStatesDetails[stateName]} | new ${JSON.stringify(common)}`);

				await this.extendObjectAsync(stateName, {
					type: 'state',
					common
				});

			} else {
				// console.log(`Nothing changed do not update object`);
			}

			// Set value to state including expiration time
			if (value !== null) {
				await this.setStateChangedAsync(stateName, {
					val: typeof value === 'object' ? JSON.stringify(value) : value, // real objects are not allowed
					ack: true,
				});
			}

			// // Timer  to set online state to  FALSE when not updated during  2 time-sync intervals
			// if (name === 'online') {
			// 	// Clear running timer
			// 	if (stateExpire[stateName]) {
			// 		clearTimeout(stateExpire[stateName]);
			// 		stateExpire[stateName] = null;
			// 	}
			//
			// 	// timer
			// 	stateExpire[stateName] = setTimeout(async () => {
			// 		// Set value to state including expiration time
			// 		await this.setState(stateName, {
			// 			val: false,
			// 			ack: true,
			// 		});
			// 		this.log.debug('Online state expired for ' + stateName);
			// 	}, this.config.Time_Sync * 2000);
			// 	this.log.debug('Expire time set for state : ' + name + ' with time in seconds : ' + this.config.Time_Sync * 2);
			// }

			// Store current object definition to memory
			this.createdStatesDetails[stateName] = common;

			// Subscribe on state changes if writable
			common.write && this.subscribeStates(stateName);

		} catch (error) {
			this.sendSentry(`[stateSetCreate]`, `${error}`);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		try {
			if (state && state.ack === false) {

				// Split state name in segments to be used later
				const deviceArray = id.split('.');
				const deviceId = deviceArray[2];
				const deviceType = this.devices[deviceArray[2]].deviceType;

				// Default configuration for SmartBot POST api
				const apiURL = `/v1.1/devices/${deviceId}/commands`;
				const apiData = {
					'command': 'setAll',
					'parameter': state.val,
					'commandType': 'command'
				};

				// Prepare data to submit API call
				if (deviceType) { // State change regular device  detected
					switch (deviceType) {

						case ('Bot'):

							if (deviceArray[3] === 'press') {
								apiData.command = `press`;
								apiData.parameter = `default`;
							} else if (deviceArray[3] === 'state') {
								if (state.val) {
									apiData.command = `turnOn`;
									apiData.parameter = `default`;
								} else {
									apiData.command = `turnOff`;
									apiData.parameter = `default`;
								}
							}

							break;

						case ('Curtain'):
							apiData.command = `setPosition`;
							apiData.parameter = `0,ff,${state.val}`;
							break;

						case ('Humidifier'):
							//ToDo: add proper definitions and values
							break;

						case ('Plug'):
							//ToDo: add proper definitions and values
							break;

						case ('Smart Fan'):
							//ToDo: add proper definitions and values
							break;

						default:

					}
				} else { // State change of IR Remote  detected
					apiData.parameter = `default`;
					switch (deviceArray[3]) {

						case ('turnOn'):
							apiData.command = `turnOn`;
							break;

						case ('turnOff'):
							apiData.command = `turnOff`;
							break;

					}

					if (deviceArray[3] === 'temperature'
						|| deviceArray[3] === 'mode'
						|| deviceArray[3] === 'fan_speed'
						|| deviceArray[3] === 'power_state'
					){
						this.log.error(`Command ${deviceArray[3]} not (yet) implemented`);
						return;
						//ToDo: Define routine to have correct state values
						// apiData.command = `setAll`;
						// apiData.parameter = `{
						// 	temperature : ${},
						// 	mode : ${},
						// 	fan speed : ${},
						// 	power state : ${},
						// }`
					}
				}

				// Make API call
				try {
					this.log.debug(`[sendState] ${JSON.stringify(this.devices[deviceId])}: ${JSON.stringify(apiData)}`);
					const apiResponse = await this.apiCall(`${apiURL}`, `${JSON.stringify(apiData)}`);
					this.log.debug(`[sendState apiResponse]: ${JSON.stringify(apiResponse)}`);

					// Set ACK to true if API post  command successfully
					if (apiResponse.statusCode === 100) {
						this.setState(id, {ack: true});
					} else {
						this.log.error(`Unable to send command : ${apiResponse.message}`);
					}
				} catch (e) {
					this.log.error(`Cannot send command to API : ${e}`);
				}
			}
		} catch (error) {
			this.sendSentry(`[onStateChange]`, `${error}`);
		}
	}

	/**
	 * Sentry error message handler
	 * @param {string} msg Message to send
	 * @param {object} error Error message (including stack) to handle exceptions
	 */
	sendSentry(msg, error) {

		let sentryMessage = msg; // If no (stack) error is provided just send the message
		if (error) sentryMessage = `${msg} | Error : ${error} | StackTrace : ${error.stack}}`;


		if (!disableSentry) {
			if (this.supportsFeature && this.supportsFeature('PLUGINS')) {
				const sentryInstance = this.getPluginInstance('sentry');
				if (sentryInstance) {
					this.log.info(`[Error caught and sent to Sentry, thank you for collaborating!]  ${sentryMessage}`);
					sentryInstance.getSentryObject().captureException(sentryMessage);
				} else {
					this.log.error(`Sentry disabled, error caught : ${sentryMessage}`);
				}
			}
		} else {
			this.log.error(`Sentry disabled, error caught : ${sentryMessage}`);
		}
	}

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new SwitchbotHub(options);
} else {
	// otherwise start the instance directly
	new SwitchbotHub();
}