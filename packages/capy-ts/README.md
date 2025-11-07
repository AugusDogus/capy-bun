# Capy TypeScript

A TypeScript wrapper for the [Capy UI framework](https://capy-ui.org/) using Bun's FFI. Build native, cross-platform UIs with TypeScript!

## Features

- Native UI controls with TypeScript
- Declarative API for building interfaces
- Fast FFI bindings powered by Bun
- Type-safe widget creation
- Simple layout system (rows, columns, alignment)
- Non-blocking: UI runs on a separate worker thread, keeping your main JavaScript thread responsive

## Requirements

- [Bun](https://bun.sh/) v1.0.0 or higher
- [Zig](https://ziglang.org/) (for building the native library)
- Windows, macOS, or Linux

## Installation

This package is part of a monorepo. To use it:

1. Build the native library:
```bash
cd packages/capy-native
zig build
```

2. Install dependencies:
```bash
cd packages/capy-ts
bun install
```

## Quick Start

```typescript
import { init, deinit, runEventLoop, Window, Label } from "capy-ts";

try {
  // Initialize the UI worker (optional - happens automatically on first use)
  await init();

  // Create window and widgets
  const window = new Window();
  await window.setTitle("Hello Capy!");
  await window.setPreferredSize(250, 100);

  const label = new Label({ text: "Hello, World!", alignment: "Center" });

  await window.setChild(label);
  await window.show();

  // Run the event loop on a worker thread
  // Returns when all windows are closed
  await runEventLoop();
} catch (e) {
  // Handle errors
} finally {
  await deinit();
}
```

## API Reference

### Core Functions

#### `async init()`
Initialize the Capy UI framework and start the UI worker thread. This is optional - the worker starts automatically on first use. Returns a promise that resolves when the worker is ready.

#### `async deinit()`
Clean up and deinitialize the framework, terminating the UI worker thread. Should be called when the application is shutting down. Returns a promise that resolves when cleanup is complete.

#### `async runEventLoop()`
Run the event loop on the worker thread. This function returns a promise that resolves when all windows are closed. While the UI event loop blocks the worker thread, **your main JavaScript thread remains fully responsive** and can continue executing other code.

### Window

#### `new Window()`
Create a new window. The window is created asynchronously on the worker thread.

#### `async window.setTitle(title: string)`
Set the window title. Returns a promise that resolves when the title is set.

#### `async window.setPreferredSize(width: number, height: number)`
Set the preferred size of the window in pixels. Returns a promise that resolves when the size is set.

#### `async window.setChild(widget: Widget)`
Set the child widget to display in the window. Returns a promise that resolves when the child is set.

#### `async window.show()`
Show the window. Returns a promise that resolves when the window is shown.

### Widgets

#### Label
Display text with optional alignment.

```typescript
// Simple label
const label = new Label({ text: "Hello!" });

// Centered label (no wrapper needed!)
const centered = new Label({ text: "Centered", alignment: "Center" });

// Left-aligned label
const leftAligned = new Label({ text: "Left", alignment: "Left" });

// Right-aligned label
const rightAligned = new Label({ text: "Right", alignment: "Right" });
```

**Options:**
- `text`: The text to display
- `alignment`: Optional text alignment - `"Left"`, `"Center"`, or `"Right"`

#### Button
A clickable button with callback support.

```typescript
const button = new Button({
  label: "Click Me",
  onclick: () => console.log("Button clicked!")
});
```

**Options:**
- `label`: The button text
- `onclick`: Optional callback function invoked when the button is clicked

#### TextField
A text input field.

```typescript
const textField = new TextField({
  text: "Initial text",
  readOnly: false
});
```

**Options:**
- `text`: Initial text value
- `readOnly`: Whether the field is read-only (default: `false`)

### Layout Widgets

#### Row
Arrange widgets horizontally.

```typescript
const row = new Row([widget1, widget2, widget3]);
```

#### Column
Arrange widgets vertically.

```typescript
const column = new Column([widget1, widget2, widget3]);
```

#### Alignment
Align a widget within its available space.

```typescript
// Center a widget
const centered = new Alignment(widget, { x: 0.5, y: 0.5 });

// Align to top-left
const topLeft = new Alignment(widget, { x: 0.0, y: 0.0 });

// Align to bottom-right
const bottomRight = new Alignment(widget, { x: 1.0, y: 1.0 });
```

Alignment values:
- `x`: 0.0 (left) to 1.0 (right), default 0.5 (center)
- `y`: 0.0 (top) to 1.0 (bottom), default 0.5 (center)

## Examples

### Hello World
See `examples/hello-world.ts` for a simple example.

```bash
bun run examples/hello-world.ts
```

### Button Example
See `examples/button-example.ts` for an example with a button and row layout.

```bash
bun run examples/button-example.ts
```

## Limitations

- Maximum 5 children per Row/Column container (can be extended if needed)
- Limited widget types (labels, buttons, text fields - more to be added)
- No dynamic property updates (can't change text/properties after widget creation)
- Single callback per button (no multiple event handlers)

## Known Issues

### Memory Management
This library uses the C allocator (`std.heap.c_allocator`) for memory management.

**Why c_allocator?**

The C allocator is the fastest general-purpose allocator available in Zig. It wraps the system's malloc/free, which are highly optimized by the platform.

**Trade-offs:**
- Best performance for general-purpose allocation
- Well-tested and reliable
- Must link libc (increases binary size ~50-100KB)
- No built-in leak detection

For a GUI library, the binary size increase from linking libc is acceptable. The wrapper correctly manages all its own allocations (windows, widgets, callbacks).

See: [Zig's allocator documentation](https://ziglang.org/documentation/master/#Choosing-an-Allocator)

## Architecture

This library uses a multi-threaded architecture to keep your JavaScript responsive:

```
┌─────────────────────────────────┐
│   Main JavaScript Thread        │
│ (Your application code here)    │
│                                 │
│  ┌──────────────────────────┐  │
│  │  TypeScript API Layer    │  │
│  │  (Window, Label, Button) │  │
│  └──────────┬───────────────┘  │
│             │ postMessage       │
└─────────────┼───────────────────┘
              │
┌─────────────┼───────────────────┐
│             ↓                   │
│  ┌──────────────────────────┐  │
│  │   UI Worker Thread       │  │
│  │ (Runs Capy event loop)   │  │
│  │                          │  │
│  │  ┌────────────────────┐  │  │
│  │  │ FFI Layer (bun:ffi)│  │  │
│  │  └────────┬───────────┘  │  │
│  │           ↓              │  │
│  │  ┌────────────────────┐  │  │
│  │  │ Zig Wrapper (C ABI)│  │  │
│  │  └────────┬───────────┘  │  │
│  │           ↓              │  │
│  │  ┌────────────────────┐  │  │
│  │  │ Capy UI (Native)   │  │  │
│  │  └────────────────────┘  │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

**Key Benefits:**
- **Non-blocking**: UI operations don't block your main JavaScript thread
- **Responsive**: Your app can handle other tasks while UI runs
- **Simple**: All async communication is handled automatically
- **Type-safe**: Full TypeScript support with proper types

## Development

### Type Checking
```bash
bun run typecheck
```

### Build
```bash
bun run build
```

### Build Standalone Executable
Create a single-file executable with everything embedded:

```bash
bun run build:exe
```

This creates `dist-exe/capy-hello.exe` - a single file that includes:
- Your application code
- The UI worker thread
- The native Capy library (extracted to cache on first run)
- No console window

**Distribution:** Just ship the `.exe` file! On first run, the native library will be automatically extracted to a cache directory (`%TEMP%\capy-ts-cache` on Windows).

**Note:** The executable opens as a pure GUI application without a console window. Perfect for distributing to end users!

## Contributing

Contributions are welcome! This is a proof-of-concept wrapper with room for expansion:

- Add more widget types (checkboxes, sliders, dropdowns, etc.)
- Add dynamic property updates (updating text, colors, properties after creation)
- Improve error handling and validation
- Add more layout options (margins, padding, sizing)
- Add support for custom widgets and styling
- Support multiple event handlers per widget
- Add support for images and icons
- Implement data binding and state management

## License

See the LICENSE file in the repository root.

## Resources

- [Capy UI Documentation](https://capy-ui.org/docs)
- [Bun FFI Documentation](https://bun.com/docs/runtime/ffi)
- [Capy GitHub Repository](https://github.com/capy-ui/capy)

