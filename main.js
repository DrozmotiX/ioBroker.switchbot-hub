'use strict';

/*
 * Created with @iobroker/create-adapter v1.34.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const stateAttr = require(`${__dirname}/lib/state_attr.js`); // Load attribute library
const {default: axios} = require('axios');

const stateExpire = {}; // Array containing all times for online state expire
const warnMessages = {}; // Array containing sentry messages
const watchdogTimer = {}; // Array containing all times for watchdog loops

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
		if (!this.config.openToken){
			this.log.error('*** No token provided, Please enter your token in adapter settings !!!  ***');
			// this.terminate ? this.terminate('Cannot work without token, adapter disabled') : process.exit();
		}

		// Load all device and their related states & values
		const getDevices = async () => {
			try {

				// Call API and get all devices
				const apiResponse  = await this.apiCall(`/v1.0/devices`);
				this.log.debug(`[getDevices API response]: ${JSON.stringify(apiResponse)}`);
				if  (!apiResponse) throw new Error(`Can not get device list from SwitchBot API`);
				this.setState('info.connection', true, true);

				const arrayHandler = async (deviceArray) =>{
					for (const device in deviceArray){
						this.devices[deviceArray[device].deviceId] = deviceArray[device];
						await this.extendObjectAsync(deviceArray[device].deviceId, {
							type: 'device',
							common: {
								name: deviceArray[device].deviceName
							},
							native: {},
						});

						//ToDo: consider to remove this channel or make optional
						// Write info data of device to states
						for (const infoState in deviceArray[device]) {
							await this.stateSetCreate(`${deviceArray[device].deviceId}._info.${infoState}`, infoState, deviceArray[device][infoState]);
						}

						// Request device status
						this.log.debug(`[deviceStatus for ]: ${JSON.stringify(this.devices[device])}`);
						await deviceStatus(deviceArray[device].deviceId);

					}
				};

				const deviceList = apiResponse.body.deviceList;
				// const infraredRemoteList = apiResponse.body.infraredRemoteList;

				this.log.info(`Connected to SwitchBot API found ${deviceList.length} devices`);
				this.log.info(`Will refresh states every ${this.config.intervall} Minutes`);

				if (!deviceList) throw new Error(`Can not handle device list from SwitchBot API`);

				try {
					await arrayHandler(deviceList);
					// await arrayHandler(infraredRemoteList);
				} catch (error) {
					throw new Error(`[ArrayHandler] ${error}`);
				}

				this.log.info(`All devices and states loaded, adapter ready`);
				this.log.debug(`All devices and states : ${JSON.stringify(this.devices)}`);

			} catch (error) {
				this.log.error(`Get/update of devices failed : ${error}`);
				this.setState('info.connection', false, true);
			}
		};

		/**
		 * Get all vales for specific device
		 *
		 * @param {string} [deviceId] - deviceId of SwitchBot device
		 */
		const deviceStatus = async (deviceId) => {
			try {

				const apiResponse  = await this.apiCall(`/v1.0/devices/${deviceId}/status`);
				const devicesValues = apiResponse.body; //.body.deviceList;
				this.log.debug(`[deviceStatus apiResponse ]: ${JSON.stringify(this.devices[apiResponse])}`);
				if (!devicesValues) throw new Error(`Empty device list received, cannot process`);
				this.devices[deviceId].states = {};

				// Write status data of device to states
				for (const statusState in devicesValues) {
					await this.stateSetCreate(`${deviceId}.${statusState}`, statusState, devicesValues[statusState]);
					this.devices[deviceId].states[statusState] = devicesValues[statusState];
				}

			} catch (error) {
				this.log.error(`Cannot get/update status of ${this.devices[deviceId].deviceName} ${error}`);
			}
		};

		// Request devices, create related objects and get all values
		try {
			await getDevices();

			// Reset timer (if running) and start new one for next watchdog interval
			if (watchdogTimer[`all`]) {
				clearTimeout(watchdogTimer[`all`]);
				watchdogTimer[`all`] = null;
			}
			watchdogTimer[`all`] = setTimeout(async () => {

				if (this.devices.length > 0) {

					for (const deviceId in this.devices){
						await deviceStatus(deviceId);
					}

				} else {
					await getDevices();
				}

			}, (this.config.intervall * 60000));

		}catch (error) {
			this.log.error(`Init Error ${error}`);
		}

	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			for (const device in watchdogTimer){
				if (watchdogTimer[device]) {
					clearTimeout(watchdogTimer[device]);
					delete watchdogTimer[device];
				}
			}
			// Reset the connection indicator during startup
			this.setState('info.connection', false, true);

			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Make API call to SwitchBot API and return response
	 * See documentation at https://github.com/OpenWonderLabs/SwitchBotAPI
	 *
	 * @param {string} [url] - Endpoint to handle API call, like `/v1.0/devices`
	 * @param {string} [method] - API method, get (default) or post
	 * @param {object} [data] - API method, get (default) or post
	 */
	apiCall(url, method, data) {

		if (!url) throw new Error(`No URL provided, cannot make API call`);
		if (!data) {
			method = `get`;
			return axios.get(url,{
				baseURL: 'https://api.switch-bot.com',
				// method: method,
				url: url,
				timeout: 1000,
				headers: {'Authorization': this.config.openToken}
			})
				.then(response => response.data)
				.catch(error => {
					throw new Error(`Cannot handle API call : ${error}`);
				});

		} else if (method === 'post') {
			return axios.post(url,data,{
				baseURL: 'https://api.switch-bot.com',
				url: url,
				timeout: 1000,
				headers: {
					'Content-Type': 'application/json;charset=UTF-8',
					'Authorization': this.config.openToken,
				}
			})
				.then(response => response.data)
				.catch(error => {
					throw new Error(`Cannot handle API call : ${error}`);
				});
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

			if (stateAttr[name] !== undefined && stateAttr[name].min !== undefined){
				common.min = stateAttr[name].min;
			}
			if (stateAttr[name] !== undefined && stateAttr[name].max !== undefined){
				common.max = stateAttr[name].max;
			}

			common.name = stateAttr[name] !== undefined ? stateAttr[name].name || name : name;
			common.type = stateAttr[name] !== undefined ? stateAttr[name].type || typeof (value) : typeof (value) ;
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
			if (value !== null || value !== undefined) {
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
			throw new Error(`[stateSetCreate] ${error}`);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (state && state.ack === false) {
			// Split state name in segments to be used later
			const deviceArray = id.split('.');
			const deviceId = deviceArray[2];
			const deviceType = this.devices[deviceArray[2]].deviceType;

			let apiURL = '';
			const apiData = {
				'command': 'setAll',
				'parameter': state.val,
				'commandType': 'command'
			};

			//ToDo: Implement all device types
			switch (deviceType) {

				case ('Curtain'):
					apiURL =`/v1.0/devices/${deviceId}/commands`;
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

			// Make API call
			try {
				this.log.debug(`[sendState] ${JSON.stringify(this.devices[deviceId])}: ${JSON.stringify(apiData)}`);
				const apiResponse  = await this.apiCall(`${apiURL}`, `post`, `${JSON.stringify(apiData)}`);
				this.log.debug(`[sendState apiResponse]: ${JSON.stringify(this.devices[apiResponse])}`);

				// Set ACK to true if API post  command successfully
				if (apiResponse.statusCode === 'success') {
					this.setState(id,{ack: true});
				} else {
					this.log.error(`Unable to send command : ${apiResponse.message}`);
				}
			} catch (e) {
				this.log.error(`Cannot send command to API : ${e}`);
			}

			// The state was changed
			// this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			// this.log.info(`state ${id} deleted`);
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