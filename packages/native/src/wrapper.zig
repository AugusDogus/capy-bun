const std = @import("std");
const capy = @import("capy");
const builtin = @import("builtin");

// This is required for cross-platform support
pub usingnamespace capy.cross_platform;

// On Windows, suppress stderr output to prevent console window from appearing
// This must be done before any initialization
const suppress_stderr = if (builtin.os.tag == .windows) blk: {
    const win32 = std.os.windows;
    const kernel32 = win32.kernel32;
    
    // Close stderr handle to suppress error messages
    _ = kernel32.CloseHandle(win32.GetStdHandle(win32.STD_ERROR_HANDLE) catch break :blk {});
    
    break :blk {};
} else {};

// Global allocator for capy
// We use c_allocator because it's the fastest general-purpose allocator available.
// It wraps the system's malloc/free, which are highly optimized.
//
// Trade-off: We must link libc, which increases binary size (~50-100KB) and adds
// a dependency. For a GUI library, this is acceptable.
//
// See: https://ziglang.org/documentation/master/#Choosing-an-Allocator
pub const capy_allocator = std.heap.c_allocator;

// Opaque pointer types for FFI
pub const CapyWindow = opaque {};
pub const CapyWidget = opaque {};
pub const CapyCallback = ?*const fn (?*anyopaque) callconv(.C) void;

// Store windows to manage their lifetime
var windows = std.ArrayList(*capy.Window).init(capy_allocator);
var initialized = false;

// ============================================================================
// Initialization and Cleanup
// ============================================================================

pub export fn capy_init() c_int {
    if (initialized) return 0;
    
    capy.init() catch |err| {
        std.log.err("Failed to initialize capy: {}", .{err});
        return -1;
    };
    initialized = true;
    return 0;
}

pub export fn capy_deinit() void {
    if (!initialized) return;

    // Clean up button callbacks
    button_callbacks.deinit();
    
    // Clean up all windows (this will clean up their child widgets)
    for (windows.items) |window| {
        window.deinit();
        capy_allocator.destroy(window);
    }
    windows.deinit();
    
    // Deinit capy
    capy.deinit();
    
    initialized = false;
}

pub export fn capy_run_event_loop() void {
    capy.runEventLoop();
}

// ============================================================================
// Window Management
// ============================================================================

pub export fn capy_window_create() ?*CapyWindow {
    const window = capy_allocator.create(capy.Window) catch return null;
    window.* = capy.Window.init() catch {
        capy_allocator.destroy(window);
        return null;
    };
    
    windows.append(window) catch {
        window.deinit();
        capy_allocator.destroy(window);
        return null;
    };
    
    return @ptrCast(window);
}

pub export fn capy_window_set_title(window: ?*CapyWindow, title: [*:0]const u8) void {
    if (window == null) return;
    const win: *capy.Window = @ptrCast(@alignCast(window));
    const title_slice = std.mem.span(title);
    win.setTitle(title_slice);
}

pub export fn capy_window_set_preferred_size(window: ?*CapyWindow, width: u32, height: u32) void {
    if (window == null) return;
    const win: *capy.Window = @ptrCast(@alignCast(window));
    win.setPreferredSize(width, height);
}

pub export fn capy_window_show(window: ?*CapyWindow) void {
    if (window == null) return;
    const win: *capy.Window = @ptrCast(@alignCast(window));
    win.show();
}

pub export fn capy_window_set_child(window: ?*CapyWindow, widget: ?*CapyWidget) c_int {
    if (window == null or widget == null) return -1;
    const win: *capy.Window = @ptrCast(@alignCast(window));
    const child: *capy.Widget = @ptrCast(@alignCast(widget));
    
    win.set(child) catch return -1;
    return 0;
}

// ============================================================================
// Widget Creation - Label
// ============================================================================

pub export fn capy_label_create(text: [*:0]const u8, alignment: u8) ?*CapyWidget {
    const text_slice = std.mem.span(text);
    
    // alignment: 0 = none, 1 = Left, 2 = Center, 3 = Right
    const label = if (alignment == 0) 
        capy.label(.{ .text = text_slice })
    else if (alignment == 1)
        capy.label(.{ .text = text_slice, .layout = .{ .alignment = .Left } })
    else if (alignment == 2)
        capy.label(.{ .text = text_slice, .layout = .{ .alignment = .Center } })
    else if (alignment == 3)
        capy.label(.{ .text = text_slice, .layout = .{ .alignment = .Right } })
    else
        capy.label(.{ .text = text_slice });
    
    const widget = label.asWidget();
    return @ptrCast(widget);
}

// ============================================================================
// Widget Creation - Button
// ============================================================================

// Map from button pointer to callback
var button_callbacks = std.AutoHashMap(usize, CapyCallback).init(capy_allocator);

fn button_click_handler(button_ptr: *anyopaque) !void {
    const key = @intFromPtr(button_ptr);
    
    if (button_callbacks.get(key)) |cb| {
        if (cb) |callback_fn| {
            // Pass the button pointer as a usize (will be converted to callback ID in TypeScript)
            const ptr_as_opaque: *anyopaque = @ptrFromInt(key);
            callback_fn(ptr_as_opaque);
        }
    }
}

pub export fn capy_button_create(label_text: [*:0]const u8, callback: CapyCallback) ?*CapyWidget {
    const label_slice = std.mem.span(label_text);
    
    const button = capy.button(.{ 
        .label = label_slice, 
        .onclick = if (callback != null) button_click_handler else null
    });
    
    // Store callback with button pointer
    if (callback) |cb| {
        const button_ptr = @intFromPtr(button);
        button_callbacks.put(button_ptr, cb) catch return null;
    }
    
    const widget = button.asWidget();
    return @ptrCast(widget);
}

// ============================================================================
// Widget Creation - TextField
// ============================================================================

pub export fn capy_textfield_create(text: [*:0]const u8, read_only: bool) ?*CapyWidget {
    const text_slice = std.mem.span(text);
    
    const textfield = capy.textField(.{ 
        .text = text_slice,
        .readOnly = read_only 
    });
    
    const widget = textfield.asWidget();
    return @ptrCast(widget);
}

// ============================================================================
// Layout Widgets
// ============================================================================

pub export fn capy_column_create(widgets_array: [*]?*CapyWidget, count: usize) ?*CapyWidget {
    if (count == 0) return null;
    if (count > 10) return null;
    
    // Build the column based on count
    const widget: *capy.Widget = blk: {
        switch (count) {
            1 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const column = capy.column(.{}, .{w1}) catch return null;
                break :blk column.asWidget();
            },
            2 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const w2: *capy.Widget = @ptrCast(@alignCast(widgets_array[1]));
                const column = capy.column(.{}, .{ w1, w2 }) catch return null;
                break :blk column.asWidget();
            },
            3 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const w2: *capy.Widget = @ptrCast(@alignCast(widgets_array[1]));
                const w3: *capy.Widget = @ptrCast(@alignCast(widgets_array[2]));
                const column = capy.column(.{}, .{ w1, w2, w3 }) catch return null;
                break :blk column.asWidget();
            },
            4 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const w2: *capy.Widget = @ptrCast(@alignCast(widgets_array[1]));
                const w3: *capy.Widget = @ptrCast(@alignCast(widgets_array[2]));
                const w4: *capy.Widget = @ptrCast(@alignCast(widgets_array[3]));
                const column = capy.column(.{}, .{ w1, w2, w3, w4 }) catch return null;
                break :blk column.asWidget();
            },
            5 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const w2: *capy.Widget = @ptrCast(@alignCast(widgets_array[1]));
                const w3: *capy.Widget = @ptrCast(@alignCast(widgets_array[2]));
                const w4: *capy.Widget = @ptrCast(@alignCast(widgets_array[3]));
                const w5: *capy.Widget = @ptrCast(@alignCast(widgets_array[4]));
                const column = capy.column(.{}, .{ w1, w2, w3, w4, w5 }) catch return null;
                break :blk column.asWidget();
            },
            else => {
                return null;
            },
        }
    };
    
    return @ptrCast(widget);
}

pub export fn capy_row_create(widgets_array: [*]?*CapyWidget, count: usize) ?*CapyWidget {
    if (count == 0) return null;
    if (count > 10) return null;
    
    // Build the row based on count
    const widget: *capy.Widget = blk: {
        switch (count) {
            1 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const row = capy.row(.{}, .{w1}) catch return null;
                break :blk row.asWidget();
            },
            2 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const w2: *capy.Widget = @ptrCast(@alignCast(widgets_array[1]));
                const row = capy.row(.{}, .{ w1, w2 }) catch return null;
                break :blk row.asWidget();
            },
            3 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const w2: *capy.Widget = @ptrCast(@alignCast(widgets_array[1]));
                const w3: *capy.Widget = @ptrCast(@alignCast(widgets_array[2]));
                const row = capy.row(.{}, .{ w1, w2, w3 }) catch return null;
                break :blk row.asWidget();
            },
            4 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const w2: *capy.Widget = @ptrCast(@alignCast(widgets_array[1]));
                const w3: *capy.Widget = @ptrCast(@alignCast(widgets_array[2]));
                const w4: *capy.Widget = @ptrCast(@alignCast(widgets_array[3]));
                const row = capy.row(.{}, .{ w1, w2, w3, w4 }) catch return null;
                break :blk row.asWidget();
            },
            5 => {
                const w1: *capy.Widget = @ptrCast(@alignCast(widgets_array[0]));
                const w2: *capy.Widget = @ptrCast(@alignCast(widgets_array[1]));
                const w3: *capy.Widget = @ptrCast(@alignCast(widgets_array[2]));
                const w4: *capy.Widget = @ptrCast(@alignCast(widgets_array[3]));
                const w5: *capy.Widget = @ptrCast(@alignCast(widgets_array[4]));
                const row = capy.row(.{}, .{ w1, w2, w3, w4, w5 }) catch return null;
                break :blk row.asWidget();
            },
            else => {
                return null;
            },
        }
    };
    
    return @ptrCast(widget);
}

// ============================================================================
// Alignment wrapper
// ============================================================================

pub export fn capy_alignment_create(widget: ?*CapyWidget, x_align: f32, y_align: f32) ?*CapyWidget {
    if (widget == null) return null;
    
    const child: *capy.Widget = @ptrCast(@alignCast(widget));
    
    const alignment = capy.alignment(.{ 
        .x = x_align, 
        .y = y_align
    }, child) catch return null;
    
    const alignment_widget = alignment.asWidget();
    return @ptrCast(alignment_widget);
}
