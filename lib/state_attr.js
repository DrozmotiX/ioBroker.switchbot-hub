// VE.Direct Protocol Version 3.26 from 27 November 2018
// Classification of all state attributes possible

const state_attrb = {
	'auto': {
		name: 'Determines if a Humidifier is in Auto Mode or not',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '%',
		// write: true,
		// blacklist: false
	},
	'calibrate': {
		name: 'Determines if a Curtain has been calibrated or not',
		// type: 'number',
		// role: 'value.temperature', ?????
		// write: false,
		// blacklist: false
	},
	'childLock': {
		name: "Determines if a Humidifier's safety lock is on or not",
		// type: 'number',
		// role: 'value.temperature',
		// unit: '°C',
		// write: true,
		// blacklist: false
	},
	'curtainDevicesIds': {
		name: 'A list of Curtain device IDs such that the Curtain devices are being paired',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: false,
		// blacklist: false
	},
	'deviceId': {
		name: ' device ID',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: false,
		// blacklist: false
	},
	'deviceList': {
		name: 'a list of physical devices',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: false,
		// blacklist: false
	},
	'deviceName': {
		name: 'device name',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: false
	},
	'deviceType': {
		name: 'device type',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: true
	},
	'enableCloudService': {
		name: 'Determines if Cloud Service is enabled or not for the current device',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: false,
		// blacklist: false
	},

	'group': {
		name: 'Determines if a Curtain is paired with or grouped with another Curtain or not',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: true
	},
	'hubDeviceId': {
		name: "remote device's parent Hub ID",
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: true ???
	},
	'humidity': {
		name: 'Humidity percentage',
		// type: 'number',
		// role: 'value.temperature',
		unit: '%',
		// write: true,
		// blacklist: false
	},
	'infraredRemoteList': {
		name: 'List of virtual infrared remote devices ',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: false
	},
	'master': {
		name: 'Determines if a Curtain is the master device or not when paired with or grouped with another Curtain',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: false,
		// blacklist: true ???
	},
	'mode': {
		name: 'Fan mode',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: false
	},
	'moving': {
		name: 'Determines if a Curtain is moving or not',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: false,
		// blacklist: false
	},
	'nebulizationEfficiency': {
		name: 'Atomization efficiency %',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '%',
		// write: true,
		// blacklist: false
	},
	'openDirection': {
		name: 'Opening direction of a Curtain',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: false
	},
	'power': {
		name: 'ON/OFF state',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: false
	},
	'remoteType': {
		name: 'device type',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: false
	},
	'sceneId': {
		name: "a scene's ID",
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: true ???
	},
	'sceneName': {
		name: "a scene's name",
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: false
	},
	'shakeCenter': {
		name: "Fan's swing direction",
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: false
	},
	'shakeRange': {
		name: "Fan's swing range, 0~120°",
		// type: 'number',
		// role: 'value.temperature',
		// unit: '°',
		// write: true,
		// blacklist: false
	},
	'shaking': {
		name: 'only available for Smart Fan devices. determines if the fan is swinging or not',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: true
	},
	'slidePosition': {
		name: 'only available for Curtain devices. the percentage of the distance between the calibrated open position and close position that a Curtain has moved to',
		// type: 'number',
		// role: 'value.temperature',
		unit: '%',
		write: true,
		// blacklist: true
	},
	'sound': {
		name: 'only available for Humidifier devices. determines if a Humidifier is muted or not',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: true
	},
	'speed': {
		name: 'only available for Smart Fan devices. the fan speed',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: true
	},
	'temperature': {
		name: 'only available for Meter/Humidifier devices. temperature in celsius',
		// type: 'number',
		// role: 'value.temperature',
		unit: '°C',
		// write: false,
		// blacklist: true
	},
	'press': {
		name: 'Trigger press',
		type: 'number',
		role: 'button',
		write: true,
	},
	'ON/OFF': {
		name: 'Set switch to On/Off',
		type: 'boolean',
		role: 'switch.power',
		def: false,
		write: true,
	},
	'version': {
		name: 'Version',
		// type: 'number',
		// role: 'value.temperature',
		// unit: '',
		// write: true,
		// blacklist: true
	},
	'battery': {
		name: 'Battery',
		type: 'number',
		role: 'value.battery',
		unit: '%',
		// write: true,
		// blacklist: false
	},
	'deviceMode': {
		name: 'deviceMode',
		//type: 'number',
		//role: 'value.battery',
		//unit: '%',
		// write: true,
		// blacklist: false
	},
};

module.exports = state_attrb;
