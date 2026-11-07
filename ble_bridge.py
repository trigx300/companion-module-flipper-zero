"""
Flipper Zero <-> Bitfocus Companion Automatic Bluetooth LE (BLE) Bridge
=======================================================================
Connects wirelessly to Flipper Zero over Bluetooth Low Energy (BLE Serial GATT)
and forwards live button events + battery/connection status to the Companion
module UDP listener on 127.0.0.1:16625, while also forwarding haptic/LED
commands from Companion back to the Flipper Zero over BLE.
"""

import asyncio
import socket
import sys

from bleak import BleakClient, BleakScanner

# Flipper Zero BLE Serial Service & Characteristic UUIDs
FLIPPER_SERIAL_SERVICE_UUID = "8fe5b3d5-2e7f-4a98-2a48-7acc60fe0000"
FLIPPER_TX_CHAR_UUID = "19ed82ae-ed21-4c9d-4145-228e61fe0000"  # Indicate: Flipper -> PC
FLIPPER_RX_CHAR_UUID = "19ed82ae-ed21-4c9d-4145-228e62fe0000"  # Write: PC -> Flipper
BATTERY_CHAR_UUID = "00002a19-0000-1000-8000-00805f9b34fb"

KNOWN_FLIPPER_ADDRESSES = [
    "80:E1:27:FF:E2:53",  # Flipper Alt1nk (BLE Serial)
    "80:E1:27:00:E2:53",  # Control Alt1nk
]

COMPANION_UDP_HOST = "127.0.0.1"
COMPANION_UDP_PORT = 16625
BRIDGE_LISTEN_PORT = 16626


class UdpCommandReceiver(asyncio.DatagramProtocol):
    def __init__(self, tx_queue: asyncio.Queue):
        self.tx_queue = tx_queue

    def datagram_received(self, data: bytes, addr):
        cmd = data.decode("utf-8", errors="ignore").strip()
        if cmd:
            self.tx_queue.put_nowait(cmd)


async def find_flipper_address() -> tuple[str, str]:
    # 1. Try known Flipper Zero MAC address directly (works even when Windows already holds the BLE link)
    for addr in KNOWN_FLIPPER_ADDRESSES:
        try:
            client = BleakClient(addr, timeout=4.0)
            await client.connect()
            await client.disconnect()
            return addr, "Flipper Alt1nk"
        except Exception:
            pass

    # 2. Fall back to BLE advertisement scan
    devices = await BleakScanner.discover(timeout=4.0, return_adv=True)
    for d, adv in devices.values():
        name = d.name or adv.local_name or ""
        if "Flipper" in name or "80:E1:27" in d.address.upper():
            return d.address, (name or d.address)

    return "", ""


async def connect_and_stream(udp_sock: socket.socket, tx_queue: asyncio.Queue):
    while True:
        try:
            print("Connecting to Flipper Zero over Bluetooth LE...", flush=True)
            target_addr = KNOWN_FLIPPER_ADDRESSES[0]
            dev_name = "Flipper Alt1nk"

            buffer = ""

            def notification_handler(sender, data: bytearray):
                nonlocal buffer
                text = data.decode("utf-8", errors="ignore")
                buffer += text
                lines = buffer.split("\n")
                buffer = lines.pop()
                for line in lines:
                    clean = line.strip()
                    if clean:
                        print(f"[Flipper BLE] {clean}", flush=True)
                        udp_sock.sendto(clean.encode("utf-8"), (COMPANION_UDP_HOST, COMPANION_UDP_PORT))

            try:
                async with BleakClient(target_addr, timeout=6.0) as client:
                    print(f"Connected to {dev_name} [{target_addr}]!", flush=True)
                    await client.start_notify(FLIPPER_TX_CHAR_UUID, notification_handler)

                    batt_str = ""
                    try:
                        batt_bytes = await client.read_gatt_char(BATTERY_CHAR_UUID)
                        if batt_bytes:
                            batt_str = f":{int(batt_bytes[0])}%"
                    except Exception:
                        pass

                    udp_sock.sendto(
                        f"status:connected:{dev_name}{batt_str}".encode("utf-8"),
                        (COMPANION_UDP_HOST, COMPANION_UDP_PORT),
                    )

                    while client.is_connected:
                        try:
                            cmd = await asyncio.wait_for(tx_queue.get(), timeout=2.0)
                            await client.write_gatt_char(
                                FLIPPER_RX_CHAR_UUID, (cmd + "\r\n").encode("utf-8"), response=False
                            )
                        except asyncio.TimeoutError:
                            udp_sock.sendto(
                                f"status:connected:{dev_name}{batt_str}".encode("utf-8"),
                                (COMPANION_UDP_HOST, COMPANION_UDP_PORT),
                            )
            except Exception as inner_e:
                print(f"Direct connect attempt: {inner_e}. Scanning...", flush=True)
                found_addr, found_name = await find_flipper_address()
                if found_addr:
                    KNOWN_FLIPPER_ADDRESSES[0] = found_addr

            udp_sock.sendto(b"status:disconnected", (COMPANION_UDP_HOST, COMPANION_UDP_PORT))
            await asyncio.sleep(1.5)
        except Exception as e:
            print(f"BLE Bridge error: {e}", flush=True)
            await asyncio.sleep(2.0)


async def main():
    udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    tx_queue: asyncio.Queue = asyncio.Queue()

    loop = asyncio.get_running_loop()
    try:
        await loop.create_datagram_endpoint(
            lambda: UdpCommandReceiver(tx_queue),
            local_addr=("127.0.0.1", BRIDGE_LISTEN_PORT),
        )
    except Exception as e:
        print(f"Warning: could not bind reverse command port {BRIDGE_LISTEN_PORT}: {e}", flush=True)

    await connect_and_stream(udp_sock, tx_queue)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
