#include <furi.h>
#include <furi_hal.h>
#include <gui/gui.h>
#include <input/input.h>
#include <notification/notification.h>
#include <notification/notification_messages.h>
#include <bt/bt_service/bt.h>
#include <targets/f7/ble_glue/profiles/serial_profile.h>
#include <stdio.h>
#include <string.h>

typedef enum {
    CompanionModeDirect = 0,
    CompanionModeCursor = 1,
} CompanionMode;

typedef struct {
    Gui* gui;
    ViewPort* view_port;
    FuriMessageQueue* event_queue;
    NotificationApp* notifications;
    Bt* bt;
    FuriHalBleProfileBase* ble_serial;

    CompanionMode mode;
    uint8_t page;
    uint8_t max_page;
    uint8_t cursor_row;
    uint8_t cursor_col;
    uint8_t grid_rows;
    uint8_t grid_cols;

    bool held_up;
    bool held_down;
    bool held_left;
    bool held_right;
    bool held_ok;
    bool held_back;

    const char* last_key;
    const char* last_type;
    uint32_t last_back_short_tick;
    bool running;
} CompanionApp;

static const char* key_to_str(InputKey key) {
    switch(key) {
    case InputKeyUp:
        return "up";
    case InputKeyDown:
        return "down";
    case InputKeyLeft:
        return "left";
    case InputKeyRight:
        return "right";
    case InputKeyOk:
        return "ok";
    case InputKeyBack:
        return "back";
    default:
        return "unknown";
    }
}

static const char* type_to_str(InputType type) {
    switch(type) {
    case InputTypePress:
        return "press";
    case InputTypeRelease:
        return "release";
    case InputTypeShort:
        return "short";
    case InputTypeLong:
        return "long";
    case InputTypeRepeat:
        return "repeat";
    default:
        return "unknown";
    }
}

static void send_companion_event(CompanionApp* app, InputKey key, InputType type) {
    char buf[128];
    const char* mode_str = (app->mode == CompanionModeDirect) ? "direct" : "cursor";
    int len = snprintf(
        buf,
        sizeof(buf),
        "key: %s, type: %s, mode: %s, page: %u, row: %u, col: %u\r\n",
        key_to_str(key),
        type_to_str(type),
        mode_str,
        app->page,
        app->cursor_row,
        app->cursor_col);

    if(len > 0) {
        // Send over BLE Serial GATT characteristic
        if(app->ble_serial) {
            ble_profile_serial_tx(app->ble_serial, (uint8_t*)buf, (uint16_t)len);
        }
        // Also print to stdout for USB Serial CLI sessions
        printf("%s", buf);
    }
}

static uint16_t bt_serial_rx_callback(SerialServiceEvent event, void* context) {
    CompanionApp* app = (CompanionApp*)context;
    if(event.event == SerialServiceEventTypeDataReceived && event.data.buffer && event.data.size > 0) {
        char rx_buf[64];
        size_t copy_len = event.data.size < (sizeof(rx_buf) - 1) ? event.data.size : (sizeof(rx_buf) - 1);
        memcpy(rx_buf, event.data.buffer, copy_len);
        rx_buf[copy_len] = '\0';

        if(strstr(rx_buf, "mode direct") != NULL) {
            app->mode = CompanionModeDirect;
            notification_message(app->notifications, &sequence_double_vibro);
            notification_message(app->notifications, &sequence_blink_cyan_100);
            if(app->view_port) view_port_update(app->view_port);
        } else if(strstr(rx_buf, "mode cursor") != NULL) {
            app->mode = CompanionModeCursor;
            notification_message(app->notifications, &sequence_double_vibro);
            notification_message(app->notifications, &sequence_blink_magenta_100);
            if(app->view_port) view_port_update(app->view_port);
        } else if(strstr(rx_buf, "page ") != NULL) {
            int p = atoi(strstr(rx_buf, "page ") + 5);
            if(p >= 1 && p <= 99) {
                app->page = (uint8_t)p;
                if(app->view_port) view_port_update(app->view_port);
            }
        } else if(strstr(rx_buf, "vibro 1") != NULL) {
            notification_message(app->notifications, &sequence_single_vibro);
        } else if(strstr(rx_buf, "led r") != NULL) {
            notification_message(app->notifications, &sequence_blink_red_100);
        } else if(strstr(rx_buf, "led g") != NULL) {
            notification_message(app->notifications, &sequence_blink_green_100);
        } else if(strstr(rx_buf, "led b") != NULL) {
            notification_message(app->notifications, &sequence_blink_blue_100);
        }
        if(app->ble_serial) {
            ble_profile_serial_notify_buffer_is_empty(app->ble_serial);
        }
    }
    return 0;
}

static void draw_dpad_box(Canvas* canvas, uint8_t x, uint8_t y, const char* label, bool held) {
    if(held) {
        canvas_set_color(canvas, ColorBlack);
        canvas_draw_rbox(canvas, x, y, 13, 11, 2);
        canvas_set_color(canvas, ColorWhite);
        canvas_draw_str_aligned(canvas, x + 6, y + 6, AlignCenter, AlignCenter, label);
        canvas_set_color(canvas, ColorBlack);
    } else {
        canvas_draw_rframe(canvas, x, y, 13, 11, 2);
        canvas_draw_str_aligned(canvas, x + 6, y + 6, AlignCenter, AlignCenter, label);
    }
}

static void companion_draw_callback(Canvas* canvas, void* ctx) {
    CompanionApp* app = (CompanionApp*)ctx;
    canvas_clear(canvas);

    // Top Header Bar
    canvas_set_color(canvas, ColorBlack);
    canvas_draw_box(canvas, 0, 0, 128, 13);
    canvas_set_color(canvas, ColorWhite);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 3, 10, "COMPANION");

    char header_right[24];
    snprintf(
        header_right,
        sizeof(header_right),
        "%s P:%u",
        (app->mode == CompanionModeDirect) ? "[DIR]" : "[CUR]",
        app->page);
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str_aligned(canvas, 125, 9, AlignRight, AlignBottom, header_right);

    canvas_set_color(canvas, ColorBlack);

    // Left D-Pad visual widget
    draw_dpad_box(canvas, 18, 16, "U", app->held_up);
    draw_dpad_box(canvas, 4, 28, "L", app->held_left);
    draw_dpad_box(canvas, 18, 28, "OK", app->held_ok);
    draw_dpad_box(canvas, 32, 28, "R", app->held_right);
    draw_dpad_box(canvas, 18, 40, "D", app->held_down);

    // Right status panel
    canvas_set_font(canvas, FontPrimary);
    if(app->mode == CompanionModeDirect) {
        canvas_draw_str(canvas, 52, 25, "DIRECT MODE");
        canvas_set_font(canvas, FontSecondary);
        canvas_draw_str(canvas, 52, 35, "D-Pad = 5 Hotkeys");
    } else {
        canvas_draw_str(canvas, 52, 25, "CURSOR MODE");
        canvas_set_font(canvas, FontSecondary);
        char coord_str[32];
        snprintf(coord_str, sizeof(coord_str), "Grid: R%u / C%u", app->cursor_row, app->cursor_col);
        canvas_draw_str(canvas, 52, 35, coord_str);
    }

    char last_str[32];
    snprintf(last_str, sizeof(last_str), "Last: %s (%s)", app->last_key, app->last_type);
    canvas_draw_str(canvas, 52, 46, last_str);

    // Bottom Footer Hint
    canvas_draw_line(canvas, 0, 53, 128, 53);
    canvas_draw_str(canvas, 2, 62, "Hold BACK:Mode | 2x BACK:Exit");
}

static void companion_input_callback(InputEvent* input_event, void* ctx) {
    FuriMessageQueue* event_queue = (FuriMessageQueue*)ctx;
    furi_message_queue_put(event_queue, input_event, FuriWaitForever);
}

int32_t companion_remote_app(void* p) {
    UNUSED(p);

    CompanionApp* app = malloc(sizeof(CompanionApp));
    memset(app, 0, sizeof(CompanionApp));

    app->mode = CompanionModeDirect;
    app->page = 1;
    app->max_page = 4;
    app->cursor_row = 0;
    app->cursor_col = 0;
    app->grid_rows = 4;
    app->grid_cols = 8;
    app->last_key = "none";
    app->last_type = "ready";
    app->running = true;

    app->event_queue = furi_message_queue_alloc(16, sizeof(InputEvent));
    app->gui = furi_record_open(RECORD_GUI);
    app->notifications = furi_record_open(RECORD_NOTIFICATION);
    app->bt = furi_record_open(RECORD_BT);

    // Switch Bluetooth to BLE Serial profile so PC `ble_bridge.py` can connect reliably
    bt_disconnect(app->bt);
    furi_delay_ms(100);
    app->ble_serial = bt_profile_start(app->bt, ble_profile_serial, NULL);
    if(app->ble_serial) {
        ble_profile_serial_set_event_callback(app->ble_serial, 128, bt_serial_rx_callback, app);
        ble_profile_serial_set_rpc_active(app->ble_serial, true);
    }

    app->view_port = view_port_alloc();
    view_port_draw_callback_set(app->view_port, companion_draw_callback, app);
    view_port_input_callback_set(app->view_port, companion_input_callback, app->event_queue);
    gui_add_view_port(app->gui, app->view_port, GuiLayerFullscreen);

    // Welcome buzz + cyan blink
    notification_message(app->notifications, &sequence_single_vibro);
    notification_message(app->notifications, &sequence_blink_cyan_100);

    InputEvent event;
    while(app->running) {
        if(furi_message_queue_get(app->event_queue, &event, 100) == FuriStatusOk) {
            app->last_key = key_to_str(event.key);
            app->last_type = type_to_str(event.type);

            // Track held state for live D-pad UI
            bool is_held = (event.type == InputTypePress || event.type == InputTypeRepeat);
            if(event.type == InputTypePress || event.type == InputTypeRelease) {
                switch(event.key) {
                case InputKeyUp:
                    app->held_up = is_held;
                    break;
                case InputKeyDown:
                    app->held_down = is_held;
                    break;
                case InputKeyLeft:
                    app->held_left = is_held;
                    break;
                case InputKeyRight:
                    app->held_right = is_held;
                    break;
                case InputKeyOk:
                    app->held_ok = is_held;
                    break;
                case InputKeyBack:
                    app->held_back = is_held;
                    break;
                default:
                    break;
                }
            }

            // Double-press BACK within 400ms exits the app
            if(event.key == InputKeyBack && event.type == InputTypeShort) {
                uint32_t now = furi_get_tick();
                if(now - app->last_back_short_tick < furi_ms_to_ticks(400)) {
                    app->running = false;
                    break;
                }
                app->last_back_short_tick = now;

                // Single short BACK cycles active page
                app->page = (app->page >= app->max_page) ? 1 : (app->page + 1);
                notification_message(app->notifications, &sequence_blink_cyan_100);
            }

            // Long-press BACK toggles Direct Mode <-> Cursor Mode
            if(event.key == InputKeyBack && event.type == InputTypeLong) {
                app->mode = (app->mode == CompanionModeDirect) ? CompanionModeCursor : CompanionModeDirect;
                notification_message(app->notifications, &sequence_double_vibro);
                notification_message(app->notifications, &sequence_blink_magenta_100);
            }

            // Local cursor preview + haptic click on D-pad / OK short press
            if(event.type == InputTypeShort && event.key != InputKeyBack) {
                if(app->mode == CompanionModeCursor) {
                    if(event.key == InputKeyUp) {
                        app->cursor_row = (app->cursor_row + app->grid_rows - 1) % app->grid_rows;
                    } else if(event.key == InputKeyDown) {
                        app->cursor_row = (app->cursor_row + 1) % app->grid_rows;
                    } else if(event.key == InputKeyLeft) {
                        app->cursor_col = (app->cursor_col + app->grid_cols - 1) % app->grid_cols;
                    } else if(event.key == InputKeyRight) {
                        app->cursor_col = (app->cursor_col + 1) % app->grid_cols;
                    } else if(event.key == InputKeyOk) {
                        notification_message(app->notifications, &sequence_single_vibro);
                        notification_message(app->notifications, &sequence_blink_green_100);
                    }
                } else {
                    notification_message(app->notifications, &sequence_single_vibro);
                    notification_message(app->notifications, &sequence_blink_cyan_100);
                }
            }

            // Send every event over BLE Serial + USB Serial to Bitfocus Companion
            send_companion_event(app, event.key, event.type);

            view_port_update(app->view_port);
        }
    }

    // Restore default Bluetooth profile before exiting
    if(app->ble_serial) {
        ble_profile_serial_set_event_callback(app->ble_serial, 0, NULL, NULL);
    }
    bt_profile_restore_default(app->bt);

    gui_remove_view_port(app->gui, app->view_port);
    view_port_free(app->view_port);
    furi_message_queue_free(app->event_queue);

    furi_record_close(RECORD_BT);
    furi_record_close(RECORD_NOTIFICATION);
    furi_record_close(RECORD_GUI);

    free(app);
    return 0;
}

