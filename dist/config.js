"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetectLocalIpAddress = DetectLocalIpAddress;
exports.GetConfigFields = GetConfigFields;
const os_1 = __importDefault(require("os"));
function DetectLocalIpAddress() {
    const interfaces = os_1.default.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const ifaceList = interfaces[name];
        if (!ifaceList)
            continue;
        for (const iface of ifaceList) {
            if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}
function GetConfigFields() {
    return [
        {
            type: 'static-text',
            id: 'info',
            width: 12,
            label: 'Connection Setup',
            value: 'Connect to your Flipper Zero via Bluetooth Serial (Virtual COM port / BLE Bridge) or USB Serial. Ensure the Flipper is not locked in another serial session.',
        },
        {
            type: 'dropdown',
            id: 'connectionType',
            label: 'Connection Transport',
            width: 6,
            default: 'serial',
            choices: [
                { id: 'serial', label: 'Bluetooth Virtual COM Port / USB Serial (Flipper CLI)' },
                { id: 'udp', label: 'UDP Listener (For BLE GATT / HID Python Bridge)' },
            ],
        },
        {
            type: 'textinput',
            id: 'serialPort',
            label: 'Serial / Bluetooth COM Port (e.g. COM3 or /dev/ttyACM0)',
            width: 6,
            default: 'COM3',
            isVisible: (options) => options.connectionType === 'serial',
        },
        {
            type: 'number',
            id: 'baudRate',
            label: 'Baud Rate',
            width: 4,
            default: 230400,
            min: 9600,
            max: 921600,
            isVisible: (options) => options.connectionType === 'serial',
        },
        {
            type: 'number',
            id: 'udpPort',
            label: 'UDP Listen Port (from BLE Bridge)',
            width: 6,
            default: 16625,
            min: 1024,
            max: 65535,
            isVisible: (options) => options.connectionType === 'udp',
        },
        {
            type: 'static-text',
            id: 'navInfo',
            width: 12,
            label: 'Surface Navigation & Companion Button Triggering',
            value: 'Hold the Flipper BACK button (~0.8s) at any time to toggle between DIRECT MODE and CURSOR MODE.',
        },
        {
            type: 'checkbox',
            id: 'autoTriggerButtons',
            label: 'Directly Trigger Companion Buttons via HTTP API',
            width: 6,
            default: true,
        },
        {
            type: 'dropdown',
            id: 'defaultMode',
            label: 'Initial Navigation Mode',
            width: 6,
            default: 'direct',
            choices: [
                { id: 'direct', label: 'Direct Mode (5 Hotkeys + Page Cycle)' },
                { id: 'cursor', label: 'Cursor Mode (D-Pad Navigates Grid, OK Presses)' },
            ],
        },
        {
            type: 'textinput',
            id: 'companionHost',
            label: `Companion Host IP (Leave blank or "auto" — Detected: ${DetectLocalIpAddress()})`,
            width: 6,
            default: 'auto',
            isVisible: (options) => !!options.autoTriggerButtons,
        },
        {
            type: 'number',
            id: 'companionPort',
            label: 'Companion HTTP Port (Default: 8000)',
            width: 6,
            default: 8000,
            min: 1,
            max: 65535,
            isVisible: (options) => !!options.autoTriggerButtons,
        },
        {
            type: 'number',
            id: 'startPage',
            label: 'Starting Companion Page',
            width: 3,
            default: 1,
            min: 1,
            max: 99,
        },
        {
            type: 'number',
            id: 'maxPage',
            label: 'Max Page (for Back button page cycle)',
            width: 3,
            default: 4,
            min: 1,
            max: 99,
        },
        {
            type: 'number',
            id: 'gridRows',
            label: 'Cursor Grid Rows',
            width: 3,
            default: 4,
            min: 1,
            max: 16,
        },
        {
            type: 'number',
            id: 'gridCols',
            label: 'Cursor Grid Columns',
            width: 3,
            default: 8,
            min: 1,
            max: 16,
        },
        {
            type: 'checkbox',
            id: 'hapticFeedback',
            label: 'Vibrate Flipper Zero on Button Press & Mode Switch',
            width: 12,
            default: true,
        },
        {
            type: 'static-text',
            id: 'directMapInfo',
            width: 12,
            label: 'Direct Mode Button Coordinates (Row/Col on Current Page, 0-indexed)',
            value: 'Format as "row/col" (e.g. "0/1" is Row 0, Column 1). Short-pressing BACK cycles the active page.',
        },
        {
            type: 'textinput',
            id: 'directUpCoord',
            label: 'UP Button Target (row/col)',
            width: 4,
            default: '0/1',
        },
        {
            type: 'textinput',
            id: 'directDownCoord',
            label: 'DOWN Button Target (row/col)',
            width: 4,
            default: '2/1',
        },
        {
            type: 'textinput',
            id: 'directLeftCoord',
            label: 'LEFT Button Target (row/col)',
            width: 4,
            default: '1/0',
        },
        {
            type: 'textinput',
            id: 'directRightCoord',
            label: 'RIGHT Button Target (row/col)',
            width: 4,
            default: '1/2',
        },
        {
            type: 'textinput',
            id: 'directOkCoord',
            label: 'OK Button Target (row/col)',
            width: 4,
            default: '1/1',
        },
    ];
}
//# sourceMappingURL=config.js.map