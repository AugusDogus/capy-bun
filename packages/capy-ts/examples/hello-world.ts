import { deinit, init, Label, runEventLoop, Window } from "../src";

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
  // Silently handle errors (no console output to avoid showing console window)
} finally {
  await deinit();
}
