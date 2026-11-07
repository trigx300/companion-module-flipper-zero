"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetActions = GetActions;
function GetActions(self) {
    return {
        set_mode: {
            name: 'Surface: Set Navigation Mode (Direct / Cursor / Toggle)',
            options: [
                {
                    type: 'dropdown',
                    id: 'mode',
                    label: 'Mode',
                    default: 'toggle',
                    choices: [
                        { id: 'toggle', label: 'Toggle (Direct <-> Cursor)' },
                        { id: 'direct', label: 'Direct Mode' },
                        { id: 'cursor', label: 'Cursor Mode' },
                    ],
                },
            ],
            callback: async (event) => {
                const modeOpt = event.options.mode;
                if (modeOpt === 'toggle') {
                    self.toggleMode();
                }
                else {
                    self.setMode(modeOpt);
                }
            },
        },
        set_page: {
            name: 'Surface: Set Active Page',
            options: [
                {
                    type: 'number',
                    id: 'page',
                    label: 'Page Number',
                    default: 1,
                    min: 1,
                    max: 99,
                },
            ],
            callback: async (event) => {
                self.setPage(Number(event.options.page));
            },
        },
        set_cursor: {
            name: 'Surface: Move Cursor to Row/Column',
            options: [
                {
                    type: 'number',
                    id: 'row',
                    label: 'Row (0-indexed)',
                    default: 0,
                    min: 0,
                    max: 15,
                },
                {
                    type: 'number',
                    id: 'col',
                    label: 'Column (0-indexed)',
                    default: 0,
                    min: 0,
                    max: 15,
                },
            ],
            callback: async (event) => {
                self.setCursor(Number(event.options.row), Number(event.options.col));
            },
        },
        vibrate: {
            name: 'Flipper Hardware: Vibrate (Haptic Pulse)',
            options: [
                {
                    type: 'number',
                    id: 'duration',
                    label: 'Duration (ms)',
                    default: 150,
                    min: 30,
                    max: 3000,
                },
            ],
            callback: async (event) => {
                await self.pulseVibro(Number(event.options.duration));
            },
        },
        set_led: {
            name: 'Flipper Hardware: Set Backlight / Status LED Color',
            options: [
                {
                    type: 'dropdown',
                    id: 'channel',
                    label: 'LED Channel',
                    default: 'r',
                    choices: [
                        { id: 'r', label: 'Red (r)' },
                        { id: 'g', label: 'Green (g)' },
                        { id: 'b', label: 'Blue (b)' },
                        { id: 'bl', label: 'Screen Backlight (bl)' },
                    ],
                },
                {
                    type: 'number',
                    id: 'intensity',
                    label: 'Intensity (0 - 255)',
                    default: 255,
                    min: 0,
                    max: 255,
                },
            ],
            callback: async (event) => {
                const ch = event.options.channel;
                const val = Number(event.options.intensity);
                await self.sendFlipperCommand(`led ${ch} ${val}`);
            },
        },
    };
}
//# sourceMappingURL=actions.js.map