// VE.Direct Protocol Version 3.26 from 27 November 2018
// Classification of all state attributes possible

const irDeviceButtons = {
	'Air Conditioner': {
		'temperature': {
			name: 'temperature',
			type: 'number',
			role: 'level.temperature',
		},
		'Set mode': {
			name: 'Set mode',
			type: 'number',
			role: 'state',
			states: {
				1 : 'auto',
				2 : 'cool',
				3 : 'dry',
				4 : 'fan',
				5 : 'heat'
			},
		},
		'fan Speed': {
			name: 'fan speed mode',
			type: 'number',
			role: 'state',
			states: {
				1 : 'auto',
				2 : 'low',
				3 :'medium',
				4 : 'high'
			},
			def: 1
		},
		'power State': {
			name: 'Turn device On',
			type: 'string',
			role: 'state',
			states: {
				on : 'On',
				off : 'Off',
			},
			def: 'off'
		},
	},
};

module.exports = irDeviceButtons;
