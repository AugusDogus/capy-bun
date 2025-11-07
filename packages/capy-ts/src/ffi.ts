import { dlopen, FFIType, type Pointer } from "bun:ffi";
import { loadNativeLibrary } from "./lib-loader";

// Define callback type for button clicks
export type CapyCallback = (data: Pointer) => void;

// Load the native library (async)
const libPath = await loadNativeLibrary();

export const lib = dlopen(libPath, {
  // Initialization
  capy_init: {
    args: [],
    returns: FFIType.i32,
  },
  capy_deinit: {
    args: [],
    returns: FFIType.void,
  },
  capy_run_event_loop: {
    args: [],
    returns: FFIType.void,
  },

  // Window management
  capy_window_create: {
    args: [],
    returns: FFIType.pointer,
  },
  capy_window_set_title: {
    args: [FFIType.pointer, FFIType.cstring],
    returns: FFIType.void,
  },
  capy_window_set_preferred_size: {
    args: [FFIType.pointer, FFIType.u32, FFIType.u32],
    returns: FFIType.void,
  },
  capy_window_show: {
    args: [FFIType.pointer],
    returns: FFIType.void,
  },
  capy_window_set_child: {
    args: [FFIType.pointer, FFIType.pointer],
    returns: FFIType.i32,
  },

  // Widget creation - Label
  capy_label_create: {
    args: [FFIType.cstring, FFIType.u8],
    returns: FFIType.pointer,
  },

  // Widget creation - Button
  capy_button_create: {
    args: [FFIType.cstring, FFIType.pointer],
    returns: FFIType.pointer,
  },

  // Widget creation - TextField
  capy_textfield_create: {
    args: [FFIType.cstring, FFIType.bool],
    returns: FFIType.pointer,
  },

  // Layout widgets
  capy_column_create: {
    args: [FFIType.pointer, FFIType.u64],
    returns: FFIType.pointer,
  },
  capy_row_create: {
    args: [FFIType.pointer, FFIType.u64],
    returns: FFIType.pointer,
  },

  // Alignment
  capy_alignment_create: {
    args: [FFIType.pointer, FFIType.f32, FFIType.f32],
    returns: FFIType.pointer,
  },
});

export const { symbols } = lib;

