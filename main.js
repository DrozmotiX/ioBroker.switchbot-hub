"use strict";

/*
 * Created with @ioBroker/create-adapter v1.34.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const stateAttr = require(`${__dirname}/lib/state_attr.js`); // Load attribute library
const irDeviceButtons = require(`${__dirname}/lib/irRemoteDevices.js`); // Load irRemote Button definitions
const crypto = require("crypto");
const https = require("https");
const { TextDecoder } = require("util");

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
	SmartLock: 30 * 60000,
	SmartLockUltra: 30 * 60000,
	WaterDetector: 7 * 60000,
	Relay: 7 * 60000,
	Bot: 7 * 60000,
};

const API_REQUEST_TIMEOUT_MS = 15000;

class SwitchbotHub extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "switchbot-hub",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("unload", this.onUnload.bind(this));

		// Constructors keeping relevant information for data processing
		this.devices = {};
		this.createdStatesDetails = {};
		this.isUnloading = false;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {

		// Reset the connection indicator during startup
		this.setState("info.connection", false, true);

		// Global manual-refresh trigger (see onStateChange()) - not created
		// via stateSetCreate() like the per-device states, so it needs its
		// own explicit subscription.
		this.subscribeStates("info.refresh");

		// Check if token is provided
		if (!this.config.openToken) {
			this.log.error("*** No token provided, Please enter your token in adapter settings !!!  ***");
		}

		// Load intervall settings
		intervallSettings.all = this.config.intervallAll != null ? this.config.intervallAll * 60000 || intervallSettings.all : intervallSettings.all;
		intervallSettings.Curtain = this.config.intervallCurtain != null ? this.config.intervallCurtain * 60000 || intervallSettings.Curtain : intervallSettings.Curtain;
		intervallSettings.Humidifier = this.config.intervallHumidifier != null ? this.config.intervallHumidifier * 60000 || intervallSettings.Humidifier : intervallSettings.Humidifier;
		intervallSettings.Meter = this.config.intervallMeter != null ? this.config.intervallMeter * 60000 || intervallSettings.Meter : intervallSettings.Meter;
		intervallSettings.Plug = this.config.intervallPlug != null ? this.config.intervallPlug * 60000 || intervallSettings.Plug : intervallSettings.Plug;
		intervallSettings.SmartFan = this.config.intervallSmartFan != null ? this.config.intervallSmartFan * 60000 || intervallSettings.SmartFan : intervallSettings.SmartFan;
		intervallSettings.SmartLock = this.config.intervallSmartLock != null ? this.config.intervallSmartLock * 60000 || intervallSettings.SmartLock : intervallSettings.SmartLock;
		intervallSettings.SmartLockUltra = this.config.intervallSmartLockUltra != null ? this.config.intervallSmartLockUltra * 60000 || intervallSettings.SmartLockUltra : intervallSettings.SmartLockUltra;
		intervallSettings.WaterDetector = this.config.intervallWaterDetector != null ? this.config.intervallWaterDetector * 60000 || intervallSettings.WaterDetector : intervallSettings.WaterDetector;
		intervallSettings.Relay = this.config.intervallRelay != null ? this.config.intervallRelay * 60000 || intervallSettings.Relay : intervallSettings.Relay;
		intervallSettings.Bot = this.config.intervallBot != null ? this.config.intervallBot * 60000 || intervallSettings.Bot : intervallSettings.Bot;

		// Request devices, create related objects and get all values
		try {
			await this.loadDevices();
		} catch (error) {
			this.log.error(`Init Error ${error}`);
		}

		// Start interval to refresh all devices and data
		await this.dataRefresh("all");

	}

	/**
	 * Get & refresh all values for specific device by interval setting.
	 *
	 * Important:
	 * - The next timer is always planned in finally.
	 * - API failures therefore do not stop the polling loop.
	 * - During unload no new timer is scheduled.
	 *
	 * @param {string} [deviceId] - deviceId of SwitchBot device
	 */
	async dataRefresh(deviceId) {

		if (this.isUnloading) return;

		let intervallTimer = intervallSettings.all;

		if (this.devices[deviceId] && this.devices[deviceId].intervallTimer) {
			intervallTimer = this.devices[deviceId].intervallTimer;
		}

		// Reset timer if already running
		if (dataRefreshTimer[deviceId]) {
			clearTimeout(dataRefreshTimer[deviceId]);
			dataRefreshTimer[deviceId] = null;
		}

		dataRefreshTimer[deviceId] = setTimeout(async () => {
			try {
				if (deviceId !== "all") {
					await this.deviceStatus(deviceId);
				} else {
					await this.loadDevices();
				}
			} catch (error) {
				this.sendSentry("[dataRefresh]", `${error}`);
			} finally {
				if (!this.isUnloading) {
					await this.dataRefresh(deviceId);
				}
			}
		}, intervallTimer);
	}

	/**
	 * Define proper interval time for selected device type
	 *
	 * @param {string} [deviceId] - deviceId of SwitchBot device
	 */
	defineIntervallTime(deviceId) {

		try {
			let timeInMs = intervallSettings.all;

			if (!this.devices[deviceId] || !this.devices[deviceId].deviceType) return;

			switch (this.devices[deviceId].deviceType) {
				case "Plug":
					timeInMs = intervallSettings.Plug;
					break;
				case "Curtain":
					timeInMs = intervallSettings.Curtain;
					break;
				case "Meter":
					timeInMs = intervallSettings.Meter;
					break;
				case "Humidifier":
					timeInMs = intervallSettings.Humidifier;
					break;
				case "Smart Fan":
					timeInMs = intervallSettings.SmartFan;
					break;
				case "Smart Lock":
					timeInMs = intervallSettings.SmartLock;
					break;
				case "Smart Lock Ultra":
					timeInMs = intervallSettings.SmartLockUltra;
					break;
				case "Water Detector":
					timeInMs = intervallSettings.WaterDetector;
					break;
				case "Relay Switch 1PM":
				case "Relay Switch 1":
				case "Relay Switch 2PM":
					timeInMs = intervallSettings.Relay;
					break;
				case "Bot":
					timeInMs = intervallSettings.Bot;
					break;
				default:
					timeInMs = intervallSettings.all;
					break;
			}
			this.devices[deviceId].intervallTimer = timeInMs;

		} catch (error) {

			this.sendSentry("[defineIntervallTime]", `${error}`);

		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.isUnloading = true;

			for (const device in dataRefreshTimer) {
				if (dataRefreshTimer[device]) {
					clearTimeout(dataRefreshTimer[device]);
					delete dataRefreshTimer[device];
				}
			}

			this.setState("info.connection", false, true);

			callback();
		} catch (e) {
			this.sendSentry("[onUnload]", `${e}`);
			callback();
		}
	}

	/**
	 * Make API call to SwitchBot API and return response.
	 * See documentation at https://github.com/OpenWonderLabs/SwitchBotAPI
	 *
	 * Important:
	 * - Requests have a timeout.
	 * - A hanging SwitchBot API request no longer blocks the refresh loop forever.
	 *
	 * @param {string} [url] - Endpoint to handle API call, like `/v1.1/devices`
	 * @param {object|string} [data] - Data for api post calls, if empty get will be executed
	 */
	apiCall(url, data) {
		if (!url) throw new Error("No URL provided, cannot make API call");

		const ti = Date.now();
		const dataIn = this.config.openToken + ti;
		const signTerm = crypto.createHmac("sha256", this.config.secretKey)
			.update(Buffer.from(dataIn, "utf-8"))
			.digest();
		const sign = signTerm.toString("base64");
		const methodSend = data ? "POST" : "GET";

		const options = {
			hostname: "api.switch-bot.com",
			port: 443,
			path: url,
			method: methodSend,
			timeout: API_REQUEST_TIMEOUT_MS,
			headers: {
				Authorization: this.config.openToken,
				sign,
				nonce: "",
				t: ti,
				"Content-Type": "application/json; charset=utf8"
			}
		};

		return new Promise((resolve, reject) => {
			const req = https.request(options, res => {
				const chunks = [];

				res.on("data", d => {
					chunks.push(d);
				});

				res.on("end", () => {
					const dataArray = Buffer.concat(chunks);
					const out = new TextDecoder().decode(new Uint8Array(dataArray));

					try {
						resolve(JSON.parse(out));
					} catch (err) {
						reject(new Error(`Invalid JSON response from SwitchBot API: ${out}`));
					}
				});
			});

			req.on("timeout", () => {
				req.destroy(new Error(`SwitchBot API request timed out after ${API_REQUEST_TIMEOUT_MS}ms: ${url}`));
			});

			req.on("error", error => {
				reject(error);
			});

			if (data) {
				req.write(typeof data === "string" ? data : JSON.stringify(data));
			}

			req.end();
		});
	}

	// Load all device and their related states & values
	async loadDevices() {
		try {

			// Call API and get all devices
			const apiResponse = await this.apiCall("/v1.1/devices");
			this.log.debug(`[getDevices API response]: ${JSON.stringify(apiResponse)}`);
			if (!apiResponse) {
				this.log.error("Empty device list received, cannot process");
				return;
			}
			this.setState("info.connection", true, true);

			const arrayHandler = async (deviceArray) => {
				for (const device in deviceArray) {
					this.devices[deviceArray[device].deviceId] = deviceArray[device];
					await this.extendObjectAsync(deviceArray[device].deviceId, {
						type: "device",
						common: {
							name: deviceArray[device].deviceName
						},
						native: {},
					});

					await this.extendObjectAsync(`${deviceArray[device].deviceId}._info`, {
						type: "channel",
						common: {
							name: "Device Information"
						},
						native: {},
					});

					// ToDo: consider to remove this channel or make optional
					// Write info data of device to states
					for (const infoState in deviceArray[device]) {
						await this.stateSetCreate(`${deviceArray[device].deviceId}._info.${infoState}`, infoState, deviceArray[device][infoState]);
					}

					// Create states not provided by API (no get, post only)
					switch (deviceArray[device].deviceType) {

						case "Bot":
							await this.stateSetCreate(`${deviceArray[device].deviceId}.press`, "press", null);
							await this.stateSetCreate(`${deviceArray[device].deviceId}.state`, "ON/OFF", null);
							break;

						case "Smart Lock":
						case "Smart Lock Ultra":
							await this.stateSetCreate(`${deviceArray[device].deviceId}.lock`, "lock", null);
							break;

					}

					// Request device values
					this.log.debug(`[deviceStatus for ]: ${JSON.stringify(this.devices[deviceArray[device].deviceId].deviceName)}`);
					await this.deviceStatus(deviceArray[device].deviceId);

					// Define interval time if possible.
					// Even if no states are available, keep a sane default instead of falling back unexpectedly.
					try {
						await this.defineIntervallTime(deviceArray[device].deviceId);
					} catch (e) {
						this.log.error(`Cannot process interval timer definition ${e}`);
					}

					// Start polling interval for specific device
					await this.dataRefresh(deviceArray[device].deviceId);

				}
			};

			const deviceList = apiResponse.body && apiResponse.body.deviceList ? apiResponse.body.deviceList : [];
			const infraredRemoteList = apiResponse.body && apiResponse.body.infraredRemoteList ? apiResponse.body.infraredRemoteList : [];

			this.log.info(`Connected to SwitchBot API found ${deviceList.length} devices`);

			try {
				if (deviceList) {
					await arrayHandler(deviceList);
				} else {
					this.log.error("Can not handle device list from SwitchBot API");
				}

				if (infraredRemoteList != null) {
					await this.infraredRemoteDevices(infraredRemoteList);
				} else {
					this.log.error("Can not handle infrared remote list from SwitchBot API");
				}

			} catch (error) {
				this.sendSentry("[arrayHandler]", `${error}`);
			}

			this.log.info("All devices and values loaded, adapter ready");
			this.log.debug(`All devices configuration data : ${JSON.stringify(this.devices)}`);

		} catch (error) {
			this.sendSentry("[loadDevices]", `${error}`);
			this.setState("info.connection", false, true);
		}
	}

	/**
	 * Get all values for specific device
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
				let statusValue = devicesValues[statusState];
				const deviceType = this.devices[deviceId] && this.devices[deviceId].deviceType;

				// Relay Switch 2PM channels use "switch1Status"/"switch2Status" for
				// on/off and "switch1Power"/"switch2Power" for wattage - no bare
				// "power" field, so nothing to normalize here for that type.
				if (
					statusState === "power"
					&& deviceType === "Relay Switch 2PM"
				) {
					statusValue = this.normalizePowerValue(statusValue);
				}

				// Relay Switch 1PM/1 report ACTUAL POWER DRAW IN WATT under the
				// field name "power" - unlike every other device type, this is NOT
				// an on/off indicator despite the name (confirmed live:
				// switchStatus:1 i.e. genuinely on, power:26.6 i.e. 26.6 Watt
				// draw). The previous code applied normalizePowerValue() to this
				// wattage number, which only returns true for exactly 1 (=1 Watt) -
				// in practice this silently corrupted the ".power" control/display
				// state back to false on every single poll, even right after a
				// correct manual/app toggle (root cause of "Status ändert sich
				// nicht"/"kann nicht mehr schalten"). The real on/off state for
				// these devices is "switchStatus" instead (handled below, mirrored
				// into ".power"). Keep the wattage reading under its own state
				// instead of discarding it.
				if (statusState === "power" && ["Relay Switch 1PM", "Relay Switch 1"].includes(deviceType)) {
					const watt = Number(statusValue) || 0;
					await this.stateSetCreate(`${deviceId}.powerWatt`, "powerWatt", watt);
					this.devices[deviceId].states.powerWatt = watt;
					continue;
				}

				// Bot devices report their real current state via "power"
				// ("on"/"off") - this reflects manual presses on the physical
				// device itself, not just commands sent from ioBroker. The
				// actual control/display state for a Bot is ".state" (created
				// in loadDevices() as "ON/OFF", written from onStateChange()
				// on turnOn/turnOff). Without this redirect, "power" would end
				// up in its own, nowhere-wired ".power" state and ".state"
				// would only ever reflect the last command sent from
				// ioBroker, never a manual press on the Bot itself.
				if (statusState === "power" && deviceType === "Bot") {
					const boolValue = this.normalizePowerValue(statusValue);
					await this.stateSetCreate(`${deviceId}.state`, "ON/OFF", boolValue);
					this.devices[deviceId].states.state = boolValue;
					continue;
				}

				if (statusState === "switch1Status" || statusState === "switch2Status" || statusState === "switchStatus") {
					statusValue = this.normalizeSwitchValue(statusValue);

					// Relay Switch 1PM/1: "switchStatus" is the real on/off state -
					// mirror it into ".power" too, the actual control/display state
					// used by onStateChange()/Lovelace (see redirect above, which
					// stopped the wattage reading from corrupting ".power").
					if (statusState === "switchStatus" && ["Relay Switch 1PM", "Relay Switch 1"].includes(deviceType)) {
						await this.stateSetCreate(`${deviceId}.power`, "power", statusValue);
						this.devices[deviceId].states.power = statusValue;
					}
				}

				await this.stateSetCreate(`${deviceId}.${statusState}`, statusState, statusValue);
				this.devices[deviceId].states[statusState] = statusValue;
			}

		} catch (error) {
			this.sendSentry("[deviceStatus]", `${error}`);
			throw error;
		}
	}

	async infraredRemoteDevices(remoteArray) {
		try {
			for (const remoteControl in remoteArray) {
				this.devices[remoteArray[remoteControl].deviceId] = remoteArray[remoteControl];
				await this.extendObjectAsync(remoteArray[remoteControl].deviceId, {
					type: "device",
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
				if (!irDeviceButtons[remoteArray[remoteControl].remoteType]) {
					this.log.error(`IR Remote Type ${[remoteArray[remoteControl].remoteType]} not yet implemented`);
					continue;
				}

				const allIrButtons = irDeviceButtons[remoteArray[remoteControl].remoteType];

				// Add default buttons if IR type !== Others
				if (remoteArray[remoteControl].remoteType !== "Others") {
					allIrButtons.turnOn = {name: "Turn device On"};
					allIrButtons.turnOff = {name: "Turn device Off"};
				}

				// Create IR specific channels
				for (const irButton in allIrButtons) {

					const common = {
						name: allIrButtons[irButton].name,
						type: allIrButtons[irButton] !== undefined ? allIrButtons[irButton].type || "number" : "number",
						role: allIrButtons[irButton] !== undefined ? allIrButtons[irButton].type || "button" : "button",
						write: true,
					};

					if (allIrButtons[irButton].states) {
						common.states = allIrButtons[irButton].states;
					}
					if (allIrButtons[irButton].def) {
						common.def = allIrButtons[irButton].def;
					}
					const stateName = irButton.replace(" ", "_");
					await this.extendObjectAsync(`${remoteArray[remoteControl].deviceId}.${stateName}`, {
						type: "state",
						common
					});
					this.subscribeStates(`${remoteArray[remoteControl].deviceId}.${stateName}`);
				}
			}
		} catch (error) {
			this.sendSentry("[infraredRemoteDevices]", `${error}`);
		}
	}

	/**
	 * State create and value update handler
	 * @param {string} stateName ID of state to create
	 * @param {string} name Name of object
	 * @param {object} value Value
	 */
	async stateSetCreate(stateName, name, value) {
		this.log.debug("Create_state called for : " + stateName + " with value : " + value);

		try {

			// Try to get details from state lib, if not use defaults. throw warning is states is not known in attribute list
			const common = {};
			if (!stateAttr[name]) {
				let warnMessage = `State attribute definition missing for : ${name}`;
				if (warnMessages[name] !== warnMessage) {
					warnMessages[name] = warnMessage;

					// Send information to Sentry with value
					warnMessage = `State attribute definition missing for : ${name} with value : ${value} `;
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
			common.role = stateAttr[name] !== undefined ? stateAttr[name].role || "state" : "state";
			common.read = true;
			common.unit = stateAttr[name] !== undefined ? stateAttr[name].unit || "" : "";
			common.write = stateAttr[name] !== undefined ? stateAttr[name].write || false : false;

			if ((!this.createdStatesDetails[stateName])
				|| (this.createdStatesDetails[stateName]
					&& (
						common.name !== this.createdStatesDetails[stateName].name
						|| common.type !== this.createdStatesDetails[stateName].type
						|| common.role !== this.createdStatesDetails[stateName].role
						|| common.read !== this.createdStatesDetails[stateName].read
						|| common.unit !== this.createdStatesDetails[stateName].unit
						|| common.write !== this.createdStatesDetails[stateName].write
					)
				)) {

				this.log.debug(`An attribute has changed : ${stateName} | old ${this.createdStatesDetails[stateName]} | new ${JSON.stringify(common)}`);

				await this.extendObjectAsync(stateName, {
					type: "state",
					common
				});

			}

			// Set value to state
			if (value !== null) {
				await this.setStateChangedAsync(stateName, {
					val: typeof value === "object" ? JSON.stringify(value) : value, // real objects are not allowed
					ack: true,
				});
			}

			// Store current object definition to memory
			this.createdStatesDetails[stateName] = common;

			// Subscribe on state changes if writable
			common.write && this.subscribeStates(stateName);

		} catch (error) {
			this.sendSentry("[stateSetCreate]", `${error}`);
		}
	}


	/**
	 * Convert ioBroker power values to a boolean.
	 * Accepts boolean values and common string/number variants.
	 *
	 * @param {any} value
	 * @returns {boolean}
	 */
	normalizePowerValue(value) {
		if (typeof value === "boolean") return value;
		if (typeof value === "number") return value === 1;

		if (typeof value === "string") {
			const normalized = value.trim().toLowerCase();
			if (["true", "1", "on", "turnon"].includes(normalized)) return true;
			if (["false", "0", "off", "turnoff"].includes(normalized)) return false;
		}

		return Boolean(value);
	}


	/**
	 * Convert ioBroker switch values to a boolean.
	 * Accepts boolean values and common string/number variants.
	 *
	 * @param {any} value
	 * @returns {boolean}
	 */
	normalizeSwitchValue(value) {
		if (typeof value === "boolean") return value;
		if (typeof value === "number") return value === 1;

		if (typeof value === "string") {
			const normalized = value.trim().toLowerCase();
			if (["true", "1", "on", "turnon"].includes(normalized)) return true;
			if (["false", "0", "off", "turnoff"].includes(normalized)) return false;
		}

		return Boolean(value);
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
				const deviceArray = id.split(".");
				const deviceId = deviceArray[2];

				// Global refresh trigger (info.refresh): force an immediate
				// re-poll of all devices instead of waiting for the next
				// scheduled interval (up to 60 minutes for "all", or the
				// per-device-type interval). Useful e.g. after manually/
				// physically changing a device, to resync ioBroker right
				// away instead of waiting.
				if (deviceId === "info" && deviceArray[3] === "refresh") {
					this.log.info("Manual refresh requested - reloading all devices now.");
					this.setState(id, false, true);
					try {
						await this.loadDevices();
					} catch (error) {
						this.sendSentry("[manual refresh]", `${error}`);
					}
					return;
				}

				if (!this.devices[deviceId]) {
					this.log.error(`Unknown device for state change: ${id}`);
					return;
				}

				const deviceType = this.devices[deviceId].deviceType;

				// Default configuration for SmartBot POST api
				const apiURL = `/v1.1/devices/${deviceId}/commands`;
				const apiData = {
					command: "setAll",
					parameter: state.val,
					commandType: "command"
				};

				// Prepare data to submit API call
				if (deviceType) { // State change regular device detected
					switch (deviceType) {

						case "Bot":

							if (deviceArray[3] === "press") {
								apiData.command = "press";
								apiData.parameter = "default";
							} else if (deviceArray[3] === "state") {
								if (state.val) {
									apiData.command = "turnOn";
									apiData.parameter = "default";
								} else {
									apiData.command = "turnOff";
									apiData.parameter = "default";
								}
							}

							break;


						case "Relay Switch 1PM":
						case "Relay Switch 1":
							if (deviceArray[3] === "power") {
								const switchOn = this.normalizeSwitchValue(state.val);
								apiData.command = switchOn ? "turnOn" : "turnOff";
								apiData.parameter = "default";
							}
							break;

						case "Relay Switch 2PM":
							if (deviceArray[3] === "switch1Status") {
								const switchOn = this.normalizeSwitchValue(state.val);
								apiData.command = switchOn ? "turnOn" : "turnOff";
								apiData.parameter = "1";
							} else if (deviceArray[3] === "switch2Status") {
								const switchOn = this.normalizeSwitchValue(state.val);
								apiData.command = switchOn ? "turnOn" : "turnOff";
								apiData.parameter = "2";
							} else if (deviceArray[3] === "power") {
								const switchOn = this.normalizeSwitchValue(state.val);
								apiData.command = switchOn ? "turnOn" : "turnOff";
								apiData.parameter = "default";
							}
							break;

						case "Curtain":
							apiData.command = "setPosition";
							apiData.parameter = `0,ff,${state.val}`;
							break;

						case "Humidifier":
							// ToDo: add proper definitions and values
							break;

						case "Plug":
							// ToDo: add proper definitions and values
							break;

						case "Smart Fan":
							// ToDo: add proper definitions and values
							break;

						case "Smart Lock":
						case "Smart Lock Ultra":
							if (deviceArray[3] === "lock") {
								apiData.command = "lock";
								apiData.parameter = "default";
							}
							break;

						default:

					}
				} else { // State change of IR Remote detected
					apiData.parameter = "default";
					switch (deviceArray[3]) {

						case "turnOn":
							apiData.command = "turnOn";
							break;

						case "turnOff":
							apiData.command = "turnOff";
							break;

					}

					if (deviceArray[3] === "temperature"
						|| deviceArray[3] === "mode"
						|| deviceArray[3] === "fan_speed"
						|| deviceArray[3] === "power_state"
					) {
						this.log.error(`Command ${deviceArray[3]} not (yet) implemented`);
						return;
					}
				}

				// Make API call
				try {
					this.log.debug(`[sendState] ${JSON.stringify(this.devices[deviceId])}: ${JSON.stringify(apiData)}`);
					const apiResponse = await this.apiCall(apiURL, apiData);
					this.log.debug(`[sendState apiResponse]: ${JSON.stringify(apiResponse)}`);

					// Set ACK to true if API post command successfully
					if (apiResponse.statusCode === 100) {
						this.setState(id, {val: state.val, ack: true});
					} else {
						this.log.error(`Unable to send command : ${apiResponse.message}`);
					}
				} catch (e) {
					this.log.error(`Cannot send command to API : ${e}`);
				}
			}
		} catch (error) {
			this.sendSentry("[onStateChange]", `${error}`);
		}
	}

	/**
	 * Sentry error message handler
	 * @param {string} msg Message to send
	 * @param {object|string} error Error message to handle exceptions
	 */
	sendSentry(msg, error) {

		let sentryMessage = msg;
		if (error) sentryMessage = `${msg} | Error : ${error}`;

		if (!disableSentry) {
			if (this.supportsFeature && this.supportsFeature("PLUGINS")) {
				const sentryInstance = this.getPluginInstance("sentry");
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
