import { Alignment, Button, deinit, init, Label, Row, runEventLoop, Window } from "../src";

try {
  await init();

  const window = new Window();
  await window.setTitle("Capy Button Example");
  await window.setPreferredSize(400, 150);

  const label = new Label({ text: "Click the button:" });
  const button = new Button({
    label: "My Button",
    onclick: () => {
      console.log("Button clicked!");
    },
  });

  const row = new Row([label, button]);
  const alignedContent = new Alignment(row, { x: 0.5, y: 0.5 }); // Center the row

  await window.setChild(alignedContent);
  await window.show();

  // Run the event loop on worker thread
  await runEventLoop();
  
  console.log("Window closed!");
} catch (e) {
  console.error("Capy application error:", e);
} finally {
  await deinit();
}
