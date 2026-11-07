import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { FlipperZeroInstance } from './main'

export function GetFeedbacks(self: FlipperZeroInstance): CompanionFeedbackDefinitions {
	return {
		cursor_highlight: {
			type: 'boolean',
			name: 'Cursor Mode: Button is Highlighted by Flipper Cursor',
			description: 'Highlights a Companion button when the Flipper Zero is in Cursor Mode and pointing at this Row/Column',
			defaultStyle: {
				bgcolor: combineRgb(255, 130, 0), // Flipper Orange!
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					type: 'number',
					id: 'row',
					label: 'Button Row (0-indexed)',
					default: 0,
					min: 0,
					max: 15,
				},
				{
					type: 'number',
					id: 'col',
					label: 'Button Column (0-indexed)',
					default: 0,
					min: 0,
					max: 15,
				},
				{
					type: 'checkbox',
					id: 'onlyCursorMode',
					label: 'Only highlight when in Cursor Mode',
					default: true,
				},
			],
			callback: (feedback) => {
				if (feedback.options.onlyCursorMode && self.state.mode !== 'cursor') {
					return false
				}
				return (
					self.state.cursorRow === Number(feedback.options.row) &&
					self.state.cursorCol === Number(feedback.options.col)
				)
			},
		},
		button_held: {
			type: 'boolean',
			name: 'Flipper Button is Currently Held Down',
			description: 'Changes style while a physical button on the Flipper Zero is pressed',
			defaultStyle: {
				bgcolor: combineRgb(0, 200, 80),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					type: 'dropdown',
					id: 'button',
					label: 'Flipper Button',
					default: 'ok',
					choices: [
						{ id: 'up', label: 'UP' },
						{ id: 'down', label: 'DOWN' },
						{ id: 'left', label: 'LEFT' },
						{ id: 'right', label: 'RIGHT' },
						{ id: 'ok', label: 'OK (Center)' },
						{ id: 'back', label: 'BACK' },
					],
				},
			],
			callback: (feedback) => {
				const btn = feedback.options.button as keyof typeof self.state.buttonsHeld
				return !!self.state.buttonsHeld[btn]
			},
		},
		active_mode: {
			type: 'boolean',
			name: 'Navigation Mode State (Direct vs Cursor)',
			description: 'True when Flipper is in the selected navigation mode',
			defaultStyle: {
				bgcolor: combineRgb(255, 130, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Mode',
					default: 'cursor',
					choices: [
						{ id: 'direct', label: 'Direct Mode' },
						{ id: 'cursor', label: 'Cursor Mode' },
					],
				},
			],
			callback: (feedback) => {
				return self.state.mode === feedback.options.mode
			},
		},
	}
}

