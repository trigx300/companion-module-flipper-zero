import { combineRgb, CompanionPresetDefinitions } from '@companion-module/base'

export function GetPresets(): CompanionPresetDefinitions {
	return {
		mode_toggle: {
			type: 'button',
			category: 'Flipper Zero Controls',
			name: 'Flipper Mode Status & Toggle',
			style: {
				text: 'FLIPPER\\n$(flipper:mode)\\nP:$(flipper:page)',
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(40, 40, 40),
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_mode',
							options: { mode: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'active_mode',
					options: { mode: 'cursor' },
					style: {
						bgcolor: combineRgb(255, 130, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		},
		cursor_readout: {
			type: 'button',
			category: 'Flipper Zero Controls',
			name: 'Cursor Position Readout',
			style: {
				text: 'CURSOR\\nR:$(flipper:cursor_row) C:$(flipper:cursor_col)\\nLast: $(flipper:last_button)',
				size: '14',
				color: combineRgb(255, 130, 0),
				bgcolor: combineRgb(20, 20, 20),
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_cursor',
							options: { row: 0, col: 0 },
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		},
		vibrate_flipper: {
			type: 'button',
			category: 'Flipper Zero Controls',
			name: 'Buzz Flipper (Haptic Alert)',
			style: {
				text: 'BUZZ\\nFLIPPER',
				size: '18',
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(255, 130, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'vibrate',
							options: { duration: 250 },
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		},
	}
}

