import { getWorkerClient } from "./worker-client";
import type { Size } from "./types";
import type { Widget } from "./widgets";

/**
 * A window that can display widgets
 */
export class Window {
  private handleId: number | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const client = getWorkerClient();
    this.handleId = await client.createWindow();
  }

  private async ensureInitialized(): Promise<number> {
    await this.initPromise;
    if (this.handleId === null) {
      throw new Error("Window not initialized");
    }
    return this.handleId;
  }

  /**
   * Set the window title
   */
  async setTitle(title: string): Promise<void> {
    const handleId = await this.ensureInitialized();
    const client = getWorkerClient();
    await client.setWindowTitle(handleId, title);
  }

  /**
   * Set the preferred size of the window
   */
  async setPreferredSize(width: number, height: number): Promise<void>;
  async setPreferredSize(size: Size): Promise<void>;
  async setPreferredSize(widthOrSize: number | Size, height?: number): Promise<void> {
    const handleId = await this.ensureInitialized();
    const client = getWorkerClient();
    
    if (typeof widthOrSize === "object") {
      await client.setWindowPreferredSize(handleId, widthOrSize.width, widthOrSize.height);
    } else {
      await client.setWindowPreferredSize(handleId, widthOrSize, height!);
    }
  }

  /**
   * Set the child widget to display in the window
   */
  async setChild(widget: Widget): Promise<void> {
    const handleId = await this.ensureInitialized();
    const widgetHandleId = await widget.getHandleId();
    const client = getWorkerClient();
    await client.setWindowChild(handleId, widgetHandleId);
  }

  /**
   * Show the window
   */
  async show(): Promise<void> {
    const handleId = await this.ensureInitialized();
    const client = getWorkerClient();
    await client.showWindow(handleId);
  }
}
