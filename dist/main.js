"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlipperZeroInstance = void 0;
const base_1 = require("@companion-module/base");
const serialport_1 = require("serialport");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const dgram_1 = __importDefault(require("dgram"));
const http_1 = __importDefault(require("http"));
const config_1 = require("./config");
const actions_1 = require("./actions");
const feedbacks_1 = require("./feedbacks");
const variables_1 = require("./variables");
const presets_1 = require("./presets");
class FlipperZeroInstance extends base_1.InstanceBase {
    config;
    state = {
        mode: 'direct',
        page: 1,
        cursorRow: 0,
        cursorCol: 0,
        lastButton: 'none',
        lastEvent: 'none',
        buttonsHeld: {
            up: false,
            down: false,
            left: false,
            right: false,
            ok: false,
            back: false,
        },
    };
    serialPort = null;
    serialBuffer = '';
    udpServer = null;
    reconnectTimer = null;
    bleBridgeProcess = null;
    isBleConnected = false;
    lastBackShortTime = 0;
    stateCachePath = path_1.default.join(os_1.default.tmpdir(), 'companion-flipper-runtime-state.json');
    constructor(internal) {
        super(internal);
    }
    loadCachedState(config) {
        try {
            if (fs_1.default.existsSync(this.stateCachePath)) {
                const parsed = JSON.parse(fs_1.default.readFileSync(this.stateCachePath, 'utf8'));
                if (parsed.mode === 'direct' || parsed.mode === 'cursor') {
                    this.state.mode = parsed.mode;
                }
                if (typeof parsed.page === 'number' && parsed.page >= 1) {
                    this.state.page = parsed.page;
                }
                if (typeof parsed.cursorRow === 'number' && parsed.cursorRow >= 0) {
                    this.state.cursorRow = parsed.cursorRow;
                }
                if (typeof parsed.cursorCol === 'number' && parsed.cursorCol >= 0) {
                    this.state.cursorCol = parsed.cursorCol;
                }
                return;
            }
        }
        catch {
            // Fallback to defaults
        }
        this.state.mode = 'direct';
        this.state.page = config.startPage || 1;
    }
    saveCachedState() {
        try {
            fs_1.default.writeFileSync(this.stateCachePath, JSON.stringify({
                mode: this.state.mode,
                page: this.state.page,
                cursorRow: this.state.cursorRow,
                cursorCol: this.state.cursorCol,
            }), 'utf8');
        }
        catch {
            // Ignore write errors
        }
    }
    async init(config) {
        this.config = config;
        if (!this.config.companionHost || this.config.companionHost === '10.101.10.100') {
            this.config.companionHost = 'auto';
        }
        this.loadCachedState(config);
        this.setActionDefinitions((0, actions_1.GetActions)(this));
        this.setFeedbackDefinitions((0, feedbacks_1.GetFeedbacks)(this));
        this.setVariableDefinitions((0, variables_1.GetVariableDefinitions)());
        this.setPresetDefinitions((0, presets_1.GetPresets)());
        this.syncVariables();
        this.checkFeedbacks();
        await this.setupConnection();
    }
    async destroy() {
        await this.closeConnection();
    }
    async configUpdated(config) {
        this.config = config;
        await this.setupConnection();
    }
    getConfigFields() {
        return (0, config_1.GetConfigFields)();
    }
    async closeConnection() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.bleBridgeProcess) {
            try {
                this.bleBridgeProcess.kill();
            }
            catch {
                // Ignore
            }
            this.bleBridgeProcess = null;
        }
        if (this.serialPort) {
            try {
                if (this.serialPort.isOpen) {
                    this.serialPort.write('\x03\r\n');
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    this.serialPort.close();
                }
            }
            catch (err) {
                this.log('debug', `Error closing serial port: ${err}`);
            }
            this.serialPort = null;
        }
        if (this.udpServer) {
            try {
                this.udpServer.close();
            }
            catch (err) {
                this.log('debug', `Error closing UDP server: ${err}`);
            }
            this.udpServer = null;
        }
        this.isBleConnected = false;
    }
    async setupConnection() {
        await this.closeConnection();
        // Always start UDP listener + Bluetooth LE Auto-Bridge so wireless BLE works out-of-the-box!
        this.initUdpConnection();
        this.startBleBridge();
        // If configured for Serial, also try opening the Serial COM port (auto-falling back to COM3 if COM4 is missing)
        if (this.config.connectionType !== 'udp') {
            this.initSerialConnection();
        }
    }
    startBleBridge() {
        const moduleRoot = path_1.default.resolve(__dirname, '..');
        const scratchRoot = 'C:\\Users\\trigx300\\.gemini\\antigravity\\scratch\\companion-module-flipper-zero';
        const pythonCandidates = [
            path_1.default.join(moduleRoot, '.venv', 'Scripts', 'python.exe'),
            path_1.default.join(scratchRoot, '.venv', 'Scripts', 'python.exe'),
            'python',
        ];
        const scriptCandidates = [
            path_1.default.join(moduleRoot, 'ble_bridge.py'),
            path_1.default.join(scratchRoot, 'ble_bridge.py'),
        ];
        const pythonExe = pythonCandidates.find((p) => p === 'python' || fs_1.default.existsSync(p)) || 'python';
        const bridgeScript = scriptCandidates.find((s) => fs_1.default.existsSync(s));
        if (!bridgeScript) {
            this.log('debug', 'ble_bridge.py not found; skipping automatic BLE bridge startup');
            return;
        }
        // Clean up any stale ble_bridge.py processes from previous module reloads so they don't fight over the BLE connection
        try {
            (0, child_process_1.execSync)('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = \'python.exe\'\\" | Where-Object { $_.CommandLine -like \'*ble_bridge.py*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"', { windowsHide: true, timeout: 3000 });
        }
        catch {
            // Ignore if no stale process was running
        }
        this.log('info', `Starting Bluetooth LE Bridge: ${pythonExe} ${bridgeScript}`);
        try {
            this.bleBridgeProcess = (0, child_process_1.spawn)(pythonExe, [bridgeScript], {
                windowsHide: true,
            });
            this.bleBridgeProcess.stdout?.on('data', (data) => {
                this.log('debug', `[BLE Bridge] ${data.toString('utf8').trim()}`);
            });
            this.bleBridgeProcess.stderr?.on('data', (data) => {
                this.log('debug', `[BLE Bridge Err] ${data.toString('utf8').trim()}`);
            });
            this.bleBridgeProcess.on('exit', (code) => {
                this.log('debug', `BLE Bridge exited with code ${code}`);
            });
        }
        catch (err) {
            this.log('warn', `Failed to spawn BLE Bridge: ${err}`);
        }
    }
    initUdpConnection() {
        const port = this.config.udpPort || 16625;
        this.updateStatus(base_1.InstanceStatus.Connecting, `Scanning BLE / UDP :${port}`);
        this.udpServer = dgram_1.default.createSocket('udp4');
        this.udpServer.on('listening', () => {
            this.log('info', `Flipper Zero UDP/BLE listener active on port ${port}`);
            if (this.config.connectionType === 'udp') {
                this.updateStatus(base_1.InstanceStatus.Ok, `UDP/BLE Ready (:${port})`);
            }
        });
        this.udpServer.on('message', (msg) => {
            const text = msg.toString('utf8').trim();
            this.parseIncomingLine(text);
        });
        this.udpServer.on('error', (err) => {
            this.log('warn', `UDP Server error: ${err.message}`);
        });
        this.udpServer.bind(port);
    }
    initSerialConnection() {
        let portPath = this.config.serialPort || 'COM3';
        const baudRate = Number(this.config.baudRate) || 230400;
        // Smart port detection: if configured for default COM4 and COM3 exists instead, try configured port then fallback
        this.serialPort = new serialport_1.SerialPort({
            path: portPath,
            baudRate: baudRate,
            autoOpen: false,
        });
        this.serialPort.on('open', () => {
            this.log('info', `Connected to Flipper Zero via USB Serial on ${portPath}`);
            this.updateStatus(base_1.InstanceStatus.Ok, `Connected (${portPath})`);
            this.serialPort?.set({ dtr: true, rts: true });
        });
        this.serialPort.on('data', (data) => {
            this.serialBuffer += data.toString('utf8');
            const lines = this.serialBuffer.split(/\r?\n/);
            this.serialBuffer = lines.pop() || '';
            for (const line of lines) {
                this.parseIncomingLine(line.trim());
            }
        });
        this.serialPort.on('error', (err) => {
            if (!this.isBleConnected) {
                this.log('debug', `Serial status on ${portPath}: ${err.message}`);
            }
        });
        this.serialPort.on('close', () => {
            if (!this.isBleConnected) {
                this.updateStatus(base_1.InstanceStatus.Connecting, 'Scanning BLE / USB...');
            }
            this.scheduleReconnect();
        });
        this.serialPort.open((err) => {
            if (err) {
                // If COM4 was set by default, automatically try COM3 if not connected via BLE
                if (portPath.toUpperCase() === 'COM4') {
                    this.config.serialPort = 'COM3';
                }
                if (!this.isBleConnected) {
                    this.updateStatus(base_1.InstanceStatus.Connecting, 'Scanning Bluetooth LE...');
                }
                this.scheduleReconnect();
            }
        });
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (this.config.connectionType !== 'udp' && (!this.serialPort || !this.serialPort.isOpen)) {
                this.initSerialConnection();
            }
        }, 5000);
    }
    parseIncomingLine(line) {
        if (!line)
            return;
        // Handle BLE Bridge status messages ("status:connected:Flipper Alt1nk:98%")
        if (line.startsWith('status:')) {
            const parts = line.split(':');
            const state = parts[1];
            if (state === 'connected') {
                const devName = parts[2] || 'Flipper Zero';
                this.isBleConnected = true;
                this.updateStatus(base_1.InstanceStatus.Ok, `BLE: ${devName}`);
            }
            else if (state === 'disconnected' || state === 'searching') {
                this.isBleConnected = false;
                if (!this.serialPort?.isOpen) {
                    this.updateStatus(base_1.InstanceStatus.Connecting, 'Scanning BLE...');
                }
            }
            return;
        }
        // 1. Native Flipper CLI / .fap format: "key: <btn>, type: <evt>[, mode: <direct|cursor>, page: <n>, row: <r>, col: <c>]"
        const cliMatch = line.match(/key:\s*(up|down|left|right|ok|back)\s*,\s*type:\s*(press|release|short|long|repeat)/i);
        if (cliMatch) {
            const button = cliMatch[1].toLowerCase();
            const eventType = cliMatch[2].toLowerCase();
            const modeMatch = line.match(/mode:\s*(direct|cursor)/i);
            const reportedMode = modeMatch ? modeMatch[1].toLowerCase() : undefined;
            const pageMatch = line.match(/page:\s*(\d+)/i);
            const reportedPage = pageMatch ? parseInt(pageMatch[1], 10) : undefined;
            const rowMatch = line.match(/row:\s*(\d+)/i);
            const reportedRow = rowMatch ? parseInt(rowMatch[1], 10) : undefined;
            const colMatch = line.match(/col:\s*(\d+)/i);
            const reportedCol = colMatch ? parseInt(colMatch[1], 10) : undefined;
            if (!this.isBleConnected && !this.serialPort?.isOpen) {
                this.isBleConnected = true;
                this.updateStatus(base_1.InstanceStatus.Ok, 'BLE Connected');
            }
            this.handleFlipperInput(button, eventType, reportedMode, reportedPage, reportedRow, reportedCol);
            return;
        }
        // 2. Simple Bridge shorthand format: "up:short" or "back:long"
        const shortMatch = line.match(/^(up|down|left|right|ok|back):(press|release|short|long|repeat)$/i);
        if (shortMatch) {
            const button = shortMatch[1].toLowerCase();
            const eventType = shortMatch[2].toLowerCase();
            this.handleFlipperInput(button, eventType);
            return;
        }
    }
    handleFlipperInput(button, eventType, reportedMode, reportedPage, reportedRow, reportedCol) {
        // If the Flipper .fap explicitly reports its current mode/page in the packet, sync immediately so they never get flipped!
        if (reportedMode && this.state.mode !== reportedMode) {
            this.state.mode = reportedMode;
        }
        if (reportedPage && !isNaN(reportedPage) && this.state.page !== reportedPage) {
            this.state.page = reportedPage;
        }
        // Hold BACK (`long` event on `back`) -> Toggle between Direct Mode and Cursor Mode (if not already synced via reportedMode)
        if (button === 'back' && eventType === 'long') {
            if (!reportedMode) {
                this.toggleMode(false);
            }
            else {
                this.log('info', `Flipper Zero surface mode switched to: ${this.state.mode.toUpperCase()}`);
            }
            this.log('info', `Flipper Input: button=${button} event=${eventType} (mode=${this.state.mode})`);
            this.state.lastButton = button;
            this.state.lastEvent = eventType;
            this.syncVariables();
            this.checkFeedbacks('button_held', 'cursor_highlight', 'active_mode');
            return;
        }
        this.log('info', `Flipper Input: button=${button} event=${eventType} (mode=${this.state.mode}, page=${this.state.page})`);
        this.state.lastButton = button;
        this.state.lastEvent = eventType;
        if (eventType === 'press') {
            this.state.buttonsHeld[button] = true;
        }
        else if (eventType === 'release') {
            this.state.buttonsHeld[button] = false;
        }
        // Short press on BACK -> Cycle active Companion Page
        // Note: Double-pressing BACK within 400ms on the Flipper Zero exits the Flipper app and resets it to Page 1 / Direct Mode!
        if (button === 'back' && eventType === 'short') {
            const now = Date.now();
            if (!reportedPage && now - this.lastBackShortTime < 450) {
                this.lastBackShortTime = 0;
                this.state.mode = 'direct';
                this.setPage(1, false);
                this.log('info', 'Flipper Zero app exited (2x BACK); resetting Companion state to Page 1 (DIRECT mode)');
                return;
            }
            this.lastBackShortTime = now;
            if (!reportedPage) {
                const maxPage = Number(this.config.maxPage) || 4;
                const nextPage = this.state.page >= maxPage ? 1 : this.state.page + 1;
                this.setPage(nextPage, false);
            }
            else {
                this.syncVariables();
            }
            this.log('info', `Flipper Zero active page switched to: Page ${this.state.page}`);
            return;
        }
        // Also if a second BACK press arrives within 350ms of a BACK short press (before the Flipper closes BLE before sending the second short), reset to Page 1 / Direct Mode
        if (button === 'back' && eventType === 'press' && !reportedPage && Date.now() - this.lastBackShortTime < 350) {
            this.lastBackShortTime = 0;
            this.state.mode = 'direct';
            this.setPage(1, false);
            this.log('info', 'Flipper Zero app exiting (2x BACK detected); resetting Companion state to Page 1 (DIRECT mode)');
            return;
        }
        // Handle D-Pad & OK actions on `short` press
        if (eventType === 'short') {
            if (this.state.mode === 'direct') {
                this.handleDirectModePress(button);
            }
            else {
                this.handleCursorModePress(button, reportedRow, reportedCol);
            }
        }
        this.syncVariables();
        this.checkFeedbacks('button_held', 'cursor_highlight', 'active_mode');
    }
    handleDirectModePress(button) {
        const coordMap = {
            up: this.config.directUpCoord || '0/1',
            down: this.config.directDownCoord || '2/1',
            left: this.config.directLeftCoord || '1/0',
            right: this.config.directRightCoord || '1/2',
            ok: this.config.directOkCoord || '1/1',
        };
        if (button === 'back')
            return;
        const coord = coordMap[button];
        const [rowStr, colStr] = coord.split('/');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);
        if (!isNaN(row) && !isNaN(col)) {
            this.triggerCompanionButton(this.state.page, row, col);
        }
    }
    handleCursorModePress(button, reportedRow, reportedCol) {
        const maxRows = Number(this.config.gridRows) || 4;
        const maxCols = Number(this.config.gridCols) || 8;
        if (reportedRow !== undefined && !isNaN(reportedRow) && reportedCol !== undefined && !isNaN(reportedCol)) {
            this.state.cursorRow = reportedRow;
            this.state.cursorCol = reportedCol;
        }
        else {
            if (button === 'up') {
                this.state.cursorRow = (this.state.cursorRow - 1 + maxRows) % maxRows;
            }
            else if (button === 'down') {
                this.state.cursorRow = (this.state.cursorRow + 1) % maxRows;
            }
            else if (button === 'left') {
                this.state.cursorCol = (this.state.cursorCol - 1 + maxCols) % maxCols;
            }
            else if (button === 'right') {
                this.state.cursorCol = (this.state.cursorCol + 1) % maxCols;
            }
        }
        if (button === 'ok') {
            this.triggerCompanionButton(this.state.page, this.state.cursorRow, this.state.cursorCol);
        }
        this.syncVariables();
        this.checkFeedbacks('cursor_highlight');
    }
    toggleMode(notifyFlipper = true) {
        const newMode = this.state.mode === 'direct' ? 'cursor' : 'direct';
        this.setMode(newMode, notifyFlipper);
    }
    setMode(mode, notifyFlipper = true) {
        this.state.mode = mode;
        this.log('info', `Flipper Zero surface mode switched to: ${mode.toUpperCase()}`);
        if (notifyFlipper) {
            void this.sendFlipperCommand(`mode ${mode}`);
        }
        this.syncVariables();
        this.checkFeedbacks('active_mode', 'cursor_highlight');
    }
    setPage(page, notifyFlipper = true) {
        this.state.page = Math.max(1, page);
        if (notifyFlipper) {
            void this.sendFlipperCommand(`page ${this.state.page}`);
        }
        this.syncVariables();
    }
    setCursor(row, col) {
        this.state.cursorRow = Math.max(0, row);
        this.state.cursorCol = Math.max(0, col);
        this.syncVariables();
        this.checkFeedbacks('cursor_highlight');
    }
    async sendFlipperCommand(cmd) {
        if (this.serialPort && this.serialPort.isOpen) {
            this.serialPort.write(`${cmd}\r\n`);
        }
        if (this.udpServer) {
            const buf = Buffer.from(cmd, 'utf8');
            this.udpServer.send(buf, 16626, '127.0.0.1');
        }
    }
    async pulseVibro(durationMs) {
        await this.sendFlipperCommand('vibro 1');
        setTimeout(() => {
            void this.sendFlipperCommand('vibro 0');
        }, durationMs);
    }
    resolveCompanionHost() {
        const raw = (this.config.companionHost || '').trim().toLowerCase();
        if (!raw || raw === 'auto' || raw === '10.101.10.100') {
            return (0, config_1.DetectLocalIpAddress)();
        }
        return this.config.companionHost.trim();
    }
    triggerCompanionButton(page, row, col) {
        if (!this.config.autoTriggerButtons)
            return;
        const host = this.resolveCompanionHost();
        const port = this.config.companionPort || 8000;
        const pathUrl = `/api/location/${page}/${row}/${col}/press`;
        this.log('info', `Triggering Companion Button: Page ${page}, Row ${row}, Col ${col} (${pathUrl})`);
        const fallbackHosts = [(0, config_1.DetectLocalIpAddress)(), '127.0.0.1'].filter((h, idx, arr) => h !== host && arr.indexOf(h) === idx);
        const sendRequest = (targetHost, fallbacks) => {
            const req = http_1.default.request({
                hostname: targetHost,
                port: port,
                path: pathUrl,
                method: 'POST',
                timeout: 1500,
            }, (res) => {
                res.resume();
            });
            req.on('error', (err) => {
                if (fallbacks.length > 0) {
                    const nextHost = fallbacks[0];
                    sendRequest(nextHost, fallbacks.slice(1));
                }
                else {
                    this.log('warn', `Failed to trigger Companion HTTP API at ${targetHost}:${port}${pathUrl}: ${err.message}`);
                }
            });
            req.on('timeout', () => {
                req.destroy();
                if (fallbacks.length > 0) {
                    const nextHost = fallbacks[0];
                    sendRequest(nextHost, fallbacks.slice(1));
                }
            });
            req.end();
        };
        sendRequest(host, fallbackHosts);
    }
    syncVariables() {
        this.saveCachedState();
        this.setVariableValues({
            mode: this.state.mode,
            page: this.state.page,
            cursor_row: this.state.cursorRow,
            cursor_col: this.state.cursorCol,
            cursor_coord: `${this.state.page}/${this.state.cursorRow}/${this.state.cursorCol}`,
            last_button: this.state.lastButton,
            last_event: this.state.lastEvent,
            btn_up: this.state.buttonsHeld.up,
            btn_down: this.state.buttonsHeld.down,
            btn_left: this.state.buttonsHeld.left,
            btn_right: this.state.buttonsHeld.right,
            btn_ok: this.state.buttonsHeld.ok,
            btn_back: this.state.buttonsHeld.back,
        });
    }
}
exports.FlipperZeroInstance = FlipperZeroInstance;
(0, base_1.runEntrypoint)(FlipperZeroInstance, []);
//# sourceMappingURL=main.js.map