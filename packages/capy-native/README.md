# Capy Native

A Zig wrapper library that exposes the [Capy UI framework](https://capy-ui.org/) through a C ABI for FFI consumption.

## Overview

This package provides a native shared library (`.dll`, `.dylib`, or `.so`) that wraps Capy UI's functionality, making it accessible from other languages via FFI. It's specifically designed to be consumed by the `capy-ts` TypeScript package.

## Building

### Prerequisites

- [Zig](https://ziglang.org/) 0.14.1

### Build Commands

```bash
# Debug build (with logging and debug symbols)
zig build

# Release build (optimized, no logging)
zig build -Doptimize=ReleaseFast
```

The compiled library will be in `zig-out/bin/`:
- Windows: `capy-native.dll`
- macOS: `libcapy-native.dylib`
- Linux: `libcapy-native.so`

## Architecture

This wrapper provides a C ABI interface to Capy, handling:

- **Memory Management**: Uses `c_allocator` for optimal performance
- **Lifecycle Management**: Tracks windows and widgets for proper cleanup
- **Callback Bridging**: Enables FFI callbacks for interactive widgets
- **Type Safety**: Opaque pointers prevent direct memory manipulation from FFI

## API Overview

The library exposes the following categories of functions:

### Initialization
- `capy_init()` - Initialize Capy
- `capy_deinit()` - Clean up resources
- `capy_run_event_loop()` - Run the UI event loop

### Window Management
- `capy_window_create()` - Create a window
- `capy_window_set_title()` - Set window title
- `capy_window_set_preferred_size()` - Set window size
- `capy_window_show()` - Display the window
- `capy_window_set_child()` - Set the root widget

### Widgets
- `capy_label_create()` - Create a text label with optional alignment
- `capy_button_create()` - Create a button with callback support
- `capy_textfield_create()` - Create a text input field

### Layout
- `capy_column_create()` - Vertical layout container
- `capy_row_create()` - Horizontal layout container
- `capy_alignment_create()` - Alignment wrapper for positioning

## Memory Management

This library uses `std.heap.c_allocator` for all allocations:

**Why c_allocator?**
- Fastest general-purpose allocator in Zig
- Wraps the system's highly-optimized malloc/free
- Well-tested and reliable

**Trade-offs:**
- ✅ Best performance for GUI applications
- ✅ Stable and predictable behavior
- ❌ Requires linking libc (~50-100KB binary size increase)
- ❌ No built-in leak detection (use external tools if needed)

The wrapper correctly manages all allocations:
- Windows and widgets are tracked in `std.ArrayList`
- Button callbacks are stored in `std.AutoHashMap`
- All resources are cleaned up in `capy_deinit()`

## Platform Support

This library supports the same platforms as Capy:

- **Windows**: Win32 backend
- **macOS**: AppKit/Cocoa backend
- **Linux**: GTK4 backend

## Development Notes

### Debug vs Release

- **Debug builds** (`zig build`): Include debug symbols and Capy's internal logging
- **Release builds** (`zig build -Doptimize=ReleaseFast`): Optimized, no logging, smaller binary

### Extending the API

To add new widgets or functionality:

1. Add the Zig function with C ABI (`pub export fn`)
2. Use opaque pointers for type safety
3. Handle errors gracefully (return error codes or null)
4. Track allocated resources for cleanup
5. Update the corresponding FFI bindings in `capy-ts`

## License

See the LICENSE file in the repository root.

## Resources

- [Capy UI Documentation](https://capy-ui.org/docs)
- [Capy GitHub Repository](https://github.com/capy-ui/capy)
- [Zig Documentation](https://ziglang.org/documentation/master/)

