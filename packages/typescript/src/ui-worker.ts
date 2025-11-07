/// <reference lib="webworker" />

/**
 * UI Worker - Runs the Capy event loop on a separate thread
 * This prevents blocking the main JavaScript thread
 */

import { FFIType, JSCallback, ptr, type Pointer } from "bun:ffi";
import { symbols } from "./ffi";

declare var self: Worker;

// Store handles for widgets and windows created in this worker
const handles = new Map<number, Pointer>();
let nextHandleId = 1;

// Store callback IDs for buttons
// Map from widget handle to callback ID
const widgetToCallback = new Map<number, number>();
// Map from button pointer (from Capy onclick) to callback ID
const buttonPtrToCallback = new Map<number, number>();

// Helper function to convert string to null-terminated buffer
function toCString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  const buffer = new Uint8Array(encoded.length + 1);
  buffer.set(encoded);
  buffer[encoded.length] = 0; // null terminator
  return buffer;
}

// Create a C callback function that will be called when a button is clicked
// The button pointer is passed from Zig
const buttonClickCallback = new JSCallback(
  (buttonPtr: Pointer) => {
    const buttonNum = Number(buttonPtr);
    
    // Check if we already have a mapping for this button pointer
    let callbackId = buttonPtrToCallback.get(buttonNum);
    
    if (callbackId === undefined) {
      // First click - we need to find which widget this button belongs to
      // The button pointer from Capy is different from the widget handle we stored
      // We need to find the callback ID from our widget mapping
      // For now, since we only have one button, just use the first callback
      // TODO: Properly map button pointer to widget handle
      for (const id of widgetToCallback.values()) {
        callbackId = id;
        buttonPtrToCallback.set(buttonNum, id);
        break;
      }
    }
    
    if (callbackId !== undefined) {
      self.postMessage({ type: "callback", callbackId });
    }
  },
  {
    args: [FFIType.pointer],
    returns: FFIType.void,
  }
);

// Initialize Capy when worker starts
const initResult = symbols.capy_init();
if (initResult !== 0) {
  self.postMessage({ type: "error", error: "Failed to initialize Capy" });
  process.exit(1);
}

// Message handler for commands from main thread
self.onmessage = (event: MessageEvent) => {
  const { type, id, ...params } = event.data;

  try {
    switch (type) {
      case "window_create": {
        const handle = symbols.capy_window_create();
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Failed to create window" });
          return;
        }
        const handleId = nextHandleId++;
        handles.set(handleId, handle);
        self.postMessage({ type: "window_created", id, handleId });
        break;
      }

      case "window_set_title": {
        const handle = handles.get(params.handleId);
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Invalid window handle" });
          return;
        }
        const titleBuf = toCString(params.title);
        symbols.capy_window_set_title(handle, ptr(titleBuf));
        self.postMessage({ type: "success", id });
        break;
      }

      case "window_set_preferred_size": {
        const handle = handles.get(params.handleId);
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Invalid window handle" });
          return;
        }
        symbols.capy_window_set_preferred_size(handle, params.width, params.height);
        self.postMessage({ type: "success", id });
        break;
      }

      case "window_set_child": {
        const windowHandle = handles.get(params.windowHandleId);
        const widgetHandle = handles.get(params.widgetHandleId);
        if (!windowHandle || !widgetHandle) {
          self.postMessage({ type: "error", id, error: "Invalid handle" });
          return;
        }
        const result = symbols.capy_window_set_child(windowHandle, widgetHandle);
        if (result !== 0) {
          self.postMessage({ type: "error", id, error: "Failed to set window child" });
          return;
        }
        self.postMessage({ type: "success", id });
        break;
      }

      case "window_show": {
        const handle = handles.get(params.handleId);
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Invalid window handle" });
          return;
        }
        symbols.capy_window_show(handle);
        self.postMessage({ type: "success", id });
        break;
      }

      case "label_create": {
        const textBuf = toCString(params.text);
        const alignment = params.alignment ?? 0;
        const handle = symbols.capy_label_create(ptr(textBuf), alignment);
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Failed to create label" });
          return;
        }
        const handleId = nextHandleId++;
        handles.set(handleId, handle);
        self.postMessage({ type: "widget_created", id, handleId });
        break;
      }

      case "button_create": {
        const labelBuf = toCString(params.label);
        // Pass the callback function pointer if a callback ID was provided
        const callbackPtr = params.callbackId !== undefined ? buttonClickCallback.ptr : null;
        const handle = symbols.capy_button_create(ptr(labelBuf), callbackPtr);
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Failed to create button" });
          return;
        }
        const handleId = nextHandleId++;
        handles.set(handleId, handle);
        
        // Store the callback ID associated with this widget handle
        // Note: The actual button pointer (what Capy passes to onclick) is different
        // We'll map it when the button is first clicked
        if (params.callbackId !== undefined) {
          const widgetNum = Number(handle);
          widgetToCallback.set(widgetNum, params.callbackId);
        }
        
        self.postMessage({ type: "widget_created", id, handleId });
        break;
      }

      case "textfield_create": {
        const textBuf = toCString(params.text || "");
        const handle = symbols.capy_textfield_create(ptr(textBuf), params.readOnly || false);
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Failed to create text field" });
          return;
        }
        const handleId = nextHandleId++;
        handles.set(handleId, handle);
        self.postMessage({ type: "widget_created", id, handleId });
        break;
      }

      case "column_create": {
        const childHandles = params.childHandleIds.map((id: number) => handles.get(id));
        if (childHandles.some((h: Pointer | undefined) => !h)) {
          self.postMessage({ type: "error", id, error: "Invalid child handle" });
          return;
        }
        const handlesArray = new BigUint64Array(childHandles.length);
        for (let i = 0; i < childHandles.length; i++) {
          // Convert Pointer to BigInt - Pointer is already a number/bigint
          handlesArray[i] = BigInt(childHandles[i] as number);
        }
        const handle = symbols.capy_column_create(ptr(handlesArray), BigInt(childHandles.length));
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Failed to create column" });
          return;
        }
        const handleId = nextHandleId++;
        handles.set(handleId, handle);
        self.postMessage({ type: "widget_created", id, handleId });
        break;
      }

      case "row_create": {
        const childHandles = params.childHandleIds.map((id: number) => handles.get(id));
        if (childHandles.some((h: Pointer | undefined) => !h)) {
          self.postMessage({ type: "error", id, error: "Invalid child handle" });
          return;
        }
        const handlesArray = new BigUint64Array(childHandles.length);
        for (let i = 0; i < childHandles.length; i++) {
          // Convert Pointer to BigInt - Pointer is already a number/bigint
          handlesArray[i] = BigInt(childHandles[i] as number);
        }
        const handle = symbols.capy_row_create(ptr(handlesArray), BigInt(childHandles.length));
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Failed to create row" });
          return;
        }
        const handleId = nextHandleId++;
        handles.set(handleId, handle);
        self.postMessage({ type: "widget_created", id, handleId });
        break;
      }

      case "alignment_create": {
        const childHandle = handles.get(params.childHandleId);
        if (!childHandle) {
          self.postMessage({ type: "error", id, error: "Invalid child handle" });
          return;
        }
        const handle = symbols.capy_alignment_create(childHandle, params.x, params.y);
        if (!handle) {
          self.postMessage({ type: "error", id, error: "Failed to create alignment" });
          return;
        }
        const handleId = nextHandleId++;
        handles.set(handleId, handle);
        self.postMessage({ type: "widget_created", id, handleId });
        break;
      }

      case "run_event_loop": {
        self.postMessage({ type: "event_loop_starting", id });
        // This will block the worker thread until all windows are closed
        symbols.capy_run_event_loop();
        self.postMessage({ type: "event_loop_ended", id });
        break;
      }

      case "shutdown": {
        symbols.capy_deinit();
        self.postMessage({ type: "shutdown_complete", id });
        process.exit(0);
        break;
      }

      default:
        self.postMessage({ type: "error", id, error: `Unknown command: ${type}` });
    }
  } catch (error) {
    self.postMessage({ 
      type: "error", 
      id, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

// Notify main thread that worker is ready
self.postMessage({ type: "ready" });

