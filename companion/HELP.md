## Flipper Zero Module for Bitfocus Companion

This module integrates a **Flipper Zero** with Bitfocus Companion as a wireless Bluetooth (or USB Serial) button control surface and interactive device.

### Features
- **Dual Navigation Modes** (Toggle by holding the **Back** button):
  - **Direct Mode**: Up, Down, Left, Right, and OK directly trigger 5 configurable Companion buttons on the current page. Short-pressing Back cycles through pages.
  - **Cursor Mode**: Up, Down, Left, Right move an active selection cursor across your Companion button grid (rows & columns). Short-pressing OK triggers the highlighted button.
- **Variables & Triggers**: Exposes the state of all 6 physical Flipper buttons (`Up`, `Down`, `Left`, `Right`, `OK`, `Back`), last pressed button, current mode (`direct` or `cursor`), active page, and cursor coordinates (`row`, `column`) so you can use Companion **Triggers** or **Feedbacks**.
- **Flipper Hardware Feedback Actions**: Send haptic vibration pulses, RGB backlight LED color changes, and piezo speaker beeps back to the Flipper Zero from Companion buttons!

### Connection Modes
1. **Bluetooth LE (BLE Serial / GATT)**: Connects wirelessly via the Flipper Zero's built-in Bluetooth Serial service or BLE HID events.
2. **Bluetooth Virtual COM Port / USB Serial CLI**: Connects to the Flipper Zero's RPC/CLI serial port (over Bluetooth SPP/BLE-Serial bridge or USB cable) to read live input events (`input dump`) and control LED/vibro/speaker hardware.
3. **UDP / TCP Listener**: Allows external scripts or BLE bridges to forward key events over local network sockets.

