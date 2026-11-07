# companion-module-flipper-zero

A **Bitfocus Companion** connection module (and companion Flipper Zero `.fap` application) that turns a **Flipper Zero** into a wireless Bluetooth LE or USB Serial button surface with **Direct Hotkey Mode**, **Grid Cursor Mode**, automatic Companion Host IP discovery, live Companion Variables, Feedbacks, Presets, and two-way hardware actions (Vibration & RGB LED control).

---

## Included Components

1. **Bitfocus Companion Module (`src/`, `dist/`, `companion/`)**:
   - Full TypeScript Companion module (`@companion-module/base` v1.14.0).
   - Automatic network interface discovery (`auto` Companion Host IP) for zero-config HTTP button triggering.
   - Automatic background Bluetooth LE GATT bridge (`ble_bridge.py`) + USB Serial CLI listener.
2. **Flipper Zero Native App (`flipper_app/companion_remote.c` & `flipper_app/dist/companion_remote.fap`)**:
   - Ready-to-install `.fap` application (`companion_remote.fap` -> `/ext/apps/Bluetooth/companion_remote.fap`) with an interactive on-screen D-Pad HUD, active mode indicator (`[DIR]` / `[CUR]`), active page counter (`P:1`..`P:4`), grid coordinate readout, and haptic/LED feedback.

---

## Key Features

### 1. Dual Surface Navigation Modes (Hold `BACK` on Flipper to Toggle)
- **Direct Mode (`[DIR]`)**:
  - Pressing `Up`, `Down`, `Left`, `Right`, or `OK` immediately triggers 5 configurable Companion buttons on your active page.
  - Short-pressing `BACK` cycles to the next Companion page (`1 -> 2 -> ... -> MaxPage`).
- **Cursor Mode (`[CUR]`)**:
  - `Up`, `Down`, `Left`, `Right` move an active selection cursor (`row`, `col`) across your Companion button grid.
  - Add the **"Cursor Mode: Button is Highlighted by Flipper Cursor"** feedback to your Companion buttons so they light up in **Flipper Orange** when targeted.
  - Short-pressing `OK` presses the highlighted Companion button.
  - Short-pressing `BACK` cycles to the next Companion page.
- **Exiting the Flipper App**:
  - Double-pressing `BACK` (`2x BACK`) exits the Flipper Zero app and automatically resets Companion back to Page 1 (`DIRECT` mode).

### 2. Companion Variables
- `$(flipper:mode)` — Current navigation mode (`direct` or `cursor`)
- `$(flipper:page)` — Active Companion page number
- `$(flipper:cursor_row)` / `$(flipper:cursor_col)` / `$(flipper:cursor_coord)` — Current cursor grid coordinates
- `$(flipper:last_button)` — Last physical button pressed (`up`, `down`, `left`, `right`, `ok`, `back`)
- `$(flipper:last_event)` — Last event type (`press`, `release`, `short`, `long`, `repeat`)
- `$(flipper:btn_up)`, `$(flipper:btn_down)`, `$(flipper:btn_left)`, `$(flipper:btn_right)`, `$(flipper:btn_ok)`, `$(flipper:btn_back)` — Live held states (`true` / `false`)

### 3. Flipper Hardware Actions & Feedbacks
- **Vibrate (Haptic Pulse)**: Trigger the Flipper Zero's vibration motor from any Companion button or trigger.
- **Set LED / Backlight**: Control the Flipper's RGB LED (`r`, `g`, `b`) and screen backlight (`bl`).
- **Set Navigation Mode / Page / Cursor**: Programmatically switch modes, jump to a page, or move the Flipper cursor from Companion.
- **Feedbacks & Presets**: Ready-to-drop button presets for D-Pad monitors, Mode Toggles, Cursor Highlighting, and Haptic Triggers.

---

## Installation

### Installing the Flipper Zero App (`.fap`)
Copy [`flipper_app/dist/companion_remote.fap`](flipper_app/dist/companion_remote.fap) to your Flipper Zero SD card under:
```text
/ext/apps/Bluetooth/companion_remote.fap
```
Or build and launch directly via `ufbt`:
```bash
cd flipper_app
ufbt launch
```

### Installing the Bitfocus Companion Module
1. Download `flipper-zero-1.0.0.tgz` (or `.zip`) from the [Releases](https://github.com/trigx300/companion-module-flipper-zero/releases) page, or clone and build from source:
   ```bash
   npm install
   npm run build
   ```
2. In **Bitfocus Companion**, add **Flipper Devices: Flipper Zero** under **Connections**.
3. Leave **Companion Host IP** set to `auto` (the module automatically detects your Companion server's active IP).

---

## License
MIT
