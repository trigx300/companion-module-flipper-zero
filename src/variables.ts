import { CompanionVariableDefinition } from '@companion-module/base'

export function GetVariableDefinitions(): CompanionVariableDefinition[] {
	return [
		{
			variableId: 'mode',
			name: 'Current Navigation Mode (direct / cursor)',
		},
		{
			variableId: 'page',
			name: 'Active Companion Page',
		},
		{
			variableId: 'cursor_row',
			name: 'Cursor Row (0-indexed)',
		},
		{
			variableId: 'cursor_col',
			name: 'Cursor Column (0-indexed)',
		},
		{
			variableId: 'cursor_coord',
			name: 'Cursor Location (page/row/col)',
		},
		{
			variableId: 'last_button',
			name: 'Last Flipper Button Pressed (up, down, left, right, ok, back)',
		},
		{
			variableId: 'last_event',
			name: 'Last Flipper Input Event (press, release, short, long)',
		},
		{
			variableId: 'btn_up',
			name: 'Flipper UP Button Held (true/false)',
		},
		{
			variableId: 'btn_down',
			name: 'Flipper DOWN Button Held (true/false)',
		},
		{
			variableId: 'btn_left',
			name: 'Flipper LEFT Button Held (true/false)',
		},
		{
			variableId: 'btn_right',
			name: 'Flipper RIGHT Button Held (true/false)',
		},
		{
			variableId: 'btn_ok',
			name: 'Flipper OK Button Held (true/false)',
		},
		{
			variableId: 'btn_back',
			name: 'Flipper BACK Button Held (true/false)',
		},
	]
}

