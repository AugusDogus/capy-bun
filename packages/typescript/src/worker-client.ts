/**
 * Worker Client - Manages communication with the UI worker thread
 */

import type { Pointer } from "bun:ffi";

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

export class WorkerClient {
  private worker: Worker;
  private nextRequestId = 1;
  private pendingRequests = new Map<number, PendingRequest>();
  private callbacks = new Map<number, () => void>();
  private nextCallbackId = 1;
  private ready = false;
  private readyPromise: Promise<void>;

  constructor() {
    // Create worker from the ui-worker file
    // When compiled with: bun build --compile examples/hello-world.ts src/ui-worker.ts
    // We need to use the exact path that was passed to the build command
    // In development, this resolves to the actual file
    // In production, Bun finds it in the embedded bundle
    this.worker = new Worker("./src/ui-worker.ts");

    // Setup ready promise
    this.readyPromise = new Promise<void>((resolve) => {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === "ready") {
          this.ready = true;
          this.worker.removeEventListener("message", handleMessage);
          resolve();
        }
      };
      this.worker.addEventListener("message", handleMessage);
    });

    // Setup message handler for responses
    this.worker.addEventListener("message", (event: MessageEvent) => {
      const { type, id, error, ...data } = event.data;

      // Handle callback invocations from worker
      if (type === "callback") {
        const { callbackId } = event.data;
        const callback = this.callbacks.get(callbackId);
        if (callback) {
          callback();
        }
        return;
      }

      // Handle special event loop messages
      if (type === "event_loop_starting" || type === "event_loop_ended") {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          if (type === "event_loop_ended") {
            pending.resolve(undefined);
            this.pendingRequests.delete(id);
          }
        }
        return;
      }

      // Handle regular responses
      const pending = this.pendingRequests.get(id);
      if (!pending) return;

      if (type === "error") {
        pending.reject(new Error(String(error || "Unknown worker error")));
      } else {
        pending.resolve(data);
      }
      this.pendingRequests.delete(id);
    });

    // Handle worker errors
    this.worker.addEventListener("error", (event) => {
      console.error("Worker error:", event);
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        pending.reject(new Error("Worker error"));
        this.pendingRequests.delete(id);
      }
    });
  }

  /**
   * Wait for the worker to be ready
   */
  async waitForReady(): Promise<void> {
    await this.readyPromise;
  }

  /**
   * Send a command to the worker and wait for response
   */
  private async sendCommand<T = any>(type: string, params: Record<string, any> = {}): Promise<T> {
    await this.waitForReady();

    const id = this.nextRequestId++;
    
    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type, id, ...params });
    });
  }

  // Window operations
  async createWindow(): Promise<number> {
    const result = await this.sendCommand<{ handleId: number }>("window_create");
    return result.handleId;
  }

  async setWindowTitle(handleId: number, title: string): Promise<void> {
    await this.sendCommand("window_set_title", { handleId, title });
  }

  async setWindowPreferredSize(handleId: number, width: number, height: number): Promise<void> {
    await this.sendCommand("window_set_preferred_size", { handleId, width, height });
  }

  async setWindowChild(windowHandleId: number, widgetHandleId: number): Promise<void> {
    await this.sendCommand("window_set_child", { windowHandleId, widgetHandleId });
  }

  async showWindow(handleId: number): Promise<void> {
    await this.sendCommand("window_show", { handleId });
  }

  // Widget creation
  async createLabel(text: string, alignment: number = 0): Promise<number> {
    const result = await this.sendCommand<{ handleId: number }>("label_create", { text, alignment });
    return result.handleId;
  }

  async createButton(label: string, callback?: () => void): Promise<number> {
    let callbackId: number | undefined;
    if (callback) {
      callbackId = this.nextCallbackId++;
      this.callbacks.set(callbackId, callback);
    }
    const result = await this.sendCommand<{ handleId: number }>("button_create", { label, callbackId });
    return result.handleId;
  }

  async createTextField(text: string, readOnly: boolean): Promise<number> {
    const result = await this.sendCommand<{ handleId: number }>("textfield_create", { text, readOnly });
    return result.handleId;
  }

  // Layout widgets
  async createColumn(childHandleIds: number[]): Promise<number> {
    const result = await this.sendCommand<{ handleId: number }>("column_create", { childHandleIds });
    return result.handleId;
  }

  async createRow(childHandleIds: number[]): Promise<number> {
    const result = await this.sendCommand<{ handleId: number }>("row_create", { childHandleIds });
    return result.handleId;
  }

  async createAlignment(childHandleId: number, x: number, y: number): Promise<number> {
    const result = await this.sendCommand<{ handleId: number }>("alignment_create", { childHandleId, x, y });
    return result.handleId;
  }

  // Event loop
  async runEventLoop(): Promise<void> {
    await this.sendCommand("run_event_loop");
  }

  // Cleanup
  async shutdown(): Promise<void> {
    await this.sendCommand("shutdown");
    this.worker.terminate();
  }
}

// Singleton instance
let clientInstance: WorkerClient | null = null;

export function getWorkerClient(): WorkerClient {
  if (!clientInstance) {
    clientInstance = new WorkerClient();
  }
  return clientInstance;
}

