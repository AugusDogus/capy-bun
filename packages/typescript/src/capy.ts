import { getWorkerClient } from "./worker-client";

/**
 * Initialize the Capy UI framework.
 * This starts the UI worker thread. The worker is created lazily on first use,
 * so calling this function is optional.
 */
export async function init(): Promise<void> {
  const client = getWorkerClient();
  await client.waitForReady();
}

/**
 * Run the Capy event loop on a separate worker thread.
 * Returns a promise that resolves when all windows are closed.
 * 
 * Your main JavaScript thread remains fully responsive - you can continue
 * executing other code while the UI runs.
 */
export async function runEventLoop(): Promise<void> {
  const client = getWorkerClient();
  await client.runEventLoop();
}

/**
 * Deinitialize the Capy UI framework and clean up resources.
 * Should be called when the application is shutting down.
 */
export async function deinit(): Promise<void> {
  const client = getWorkerClient();
  await client.shutdown();
}
