// VE.Direct Protocol Version 3.26 from 27 November 2018
// Classification of all state attributes possible

const state_attrb = {
	'auto': {
		name: 'Determines if a Humidifier is in Auto Mode or not',
	},
	'calibrate': {
		name: 'Determines if a Curtain has been calibrated or not',
	},
	'childLock': {
		name: "Determines if a Humidifier's safety lock is on or not",
	},
	'curtainDevicesIds': {
		name: 'A list of Curtain device IDs such that the Curtain devices are being paired',
	},
	'deviceId': {
		name: ' device ID',
	},
	'deviceList': {
		name: 'a list of physical devices',
	},
	'deviceName': {
		name: 'device name',
	},
	'deviceType': {
		name: 'device type',
	},
	'enableCloudService': {
		name: 'Determines if Cloud Service is enabled or not for the current device',
	},
	'group': {
		name: 'Determines if a Curtain is paired with or grouped with another Curtain or not',
	},
	'hubDeviceId': {
		name: "remote device's parent Hub ID",
	},
	'humidity': {
		name: 'Humidity percentage',
		unit: '%',
	},
	'infraredRemoteList': {
		name: 'List of virtual infrared remote devices ',
	},
	'lightLevel': {
		name: 'only available for Motion/Contact Sensor devices. ambient light level (1 = dark, 2 = bright)',
		type: 'number',
		role: 'value',
		read: true,
		write: false,
	},
	'master': {
		name: 'Determines if a Curtain is the master device or not when paired with or grouped with another Curtain',
	},
	'mode': {
		name: 'Fan mode',
	},
	'moving': {
		name: 'Determines if a Curtain is moving or not',
	},
	'nebulizationEfficiency': {
		name: 'Atomization efficiency %',
	},
	'openDirection': {
		name: 'Opening direction of a Curtain',
	},
	'power': {
		name: 'Power',
		type: 'boolean',
		role: 'switch.power',
		read: true,
		write: true
	},

	// Relay Switch 2PM - channel 1
	'switch1Status': {
		name: 'Switch 1',
		type: 'boolean',
		role: 'switch.power',
		read: true,
		write: true
	},
	'switch1Power': {
		name: 'Switch 1 Power',
		type: 'number',
		role: 'value.power',
		read: true,
		write: false,
		unit: 'W'
	},
	'switch1Voltage': {
		name: 'Switch 1 Voltage',
		type: 'number',
		role: 'value.voltage',
		read: true,
		write: false,
		unit: 'V'
	},
	'switch1ElectricCurrent': {
		name: 'Switch 1 Electric Current',
		type: 'number',
		role: 'value.current',
		read: true,
		write: false,
		unit: 'A'
	},
	'switch1UsedElectricity': {
		name: 'Switch 1 Used Electricity',
		type: 'number',
		role: 'value.energy',
		read: true,
		write: false,
		unit: 'Wh'
	},

	// Relay Switch 2PM - channel 2
	'switch2Status': {
		name: 'Switch 2',
		type: 'boolean',
		role: 'switch.power',
		read: true,
		write: true
	},
	'switch2Power': {
		name: 'Switch 2 Power',
		type: 'number',
		role: 'value.power',
		read: true,
		write: false,
		unit: 'W'
	},
	'switch2Voltage': {
		name: 'Switch 2 Voltage',
		type: 'number',
		role: 'value.voltage',
		read: true,
		write: false,
		unit: 'V'
	},
	'switch2ElectricCurrent': {
		name: 'Switch 2 Electric Current',
		type: 'number',
		role: 'value.current',
		read: true,
		write: false,
		unit: 'A'
	},
	'switch2UsedElectricity': {
		name: 'Switch 2 Used Electricity',
		type: 'number',
		role: 'value.energy',
		read: true,
		write: false,
		unit: 'Wh'
	},

	// Single-channel relay/plug devices (no switch-number prefix)
	'switchStatus': {
		name: 'Switch status',
		type: 'boolean',
		role: 'switch.power',
		read: true,
		write: false,
	},
	'voltage': {
		name: 'Voltage',
		type: 'number',
		role: 'value.voltage',
		read: true,
		write: false,
		unit: 'V'
	},
	'electricCurrent': {
		name: 'Electric Current',
		type: 'number',
		role: 'value.current',
		read: true,
		write: false,
		unit: 'A'
	},
	'usedElectricity': {
		name: 'Used Electricity',
		type: 'number',
		role: 'value.energy',
		read: true,
		write: false,
		unit: 'Wh'
	},

	'remoteType': {
		name: 'device type',
	},
	'sceneId': {
		name: "a scene's ID",
	},
	'sceneName': {
		name: "a scene's name",
	},
	'shakeCenter': {
		name: "Fan's swing direction",
	},
	'shakeRange': {
		name: "Fan's swing range, 0~120°",
	},
	'shaking': {
		name: 'only available for Smart Fan devices. determines if the fan is swinging or not',
	},
	'slidePosition': {
		name: 'only available for Curtain devices. the percentage of the distance between the calibrated open position and close position that a Curtain has moved to',
		unit: '%',
		write: true,
	},
	'sound': {
		name: 'only available for Humidifier devices. determines if a Humidifier is muted or not',
	},
	'speed': {
		name: 'only available for Smart Fan devices. the fan speed',
	},
	'temperature': {
		name: 'only available for Meter/Humidifier devices. temperature in celsius',
		unit: '°C',
	},
	'status': {
		name: 'only available for Water Detector devices. leak detection status (0 = dry, 1 = leak detected)',
		type: 'number',
		role: 'indicator.alarm',
		read: true,
		write: false,
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
	},
	'battery': {
		name: 'Battery',
		type: 'number',
		role: 'value.battery',
		unit: '%',
	},
	'deviceMode': {
		name: 'deviceMode',
	},
	'online': {
		name: 'online',
		type: 'boolean',
		role: 'indicator.reachable',
		read: true,
		write: false
	},
};

module.exports = state_attrb;
