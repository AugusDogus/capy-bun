import { getWorkerClient } from "./worker-client";
import type {
  LabelOptions,
  ButtonOptions,
  TextFieldOptions,
  RowOptions,
  ColumnOptions,
  Alignment as AlignmentOptions,
} from "./types";

/**
 * Base class for all Capy widgets
 */
export class Widget {
  protected handleId: number | null = null;
  protected initPromise: Promise<void>;

  constructor(initPromise: Promise<void>) {
    this.initPromise = initPromise;
  }

  async getHandleId(): Promise<number> {
    await this.initPromise;
    if (this.handleId === null) {
      throw new Error("Widget not initialized");
    }
    return this.handleId;
  }
}

/**
 * A text label widget
 */
export class Label extends Widget {
  constructor(options: LabelOptions) {
    let resolveInit!: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    super(initPromise);

    (async () => {
      const client = getWorkerClient();
      // Map alignment string to numeric value
      // 0 = none, 1 = Left, 2 = Center, 3 = Right
      let alignmentValue = 0; // none
      if (options.alignment === "Left") alignmentValue = 1;
      else if (options.alignment === "Center") alignmentValue = 2;
      else if (options.alignment === "Right") alignmentValue = 3;
      
      this.handleId = await client.createLabel(options.text, alignmentValue);
      resolveInit();
    })();
  }
}

/**
 * A clickable button widget
 */
export class Button extends Widget {
  constructor(options: ButtonOptions) {
    let resolveInit!: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    super(initPromise);

    (async () => {
      const client = getWorkerClient();
      this.handleId = await client.createButton(options.label, options.onclick);
      resolveInit();
    })();
  }
}

/**
 * A text input field widget
 */
export class TextField extends Widget {
  constructor(options: TextFieldOptions = {}) {
    let resolveInit!: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    super(initPromise);

    (async () => {
      const client = getWorkerClient();
      const text = options.text || "";
      const readOnly = options.readOnly || false;
      this.handleId = await client.createTextField(text, readOnly);
      resolveInit();
    })();
  }
}

/**
 * A container that arranges widgets in a column (vertical layout)
 */
export class Column extends Widget {
  constructor(children: Widget[], _options: ColumnOptions = {}) {
    if (children.length === 0) {
      throw new Error("Column must have at least one child");
    }
    if (children.length > 10) {
      throw new Error("Column supports maximum 10 children");
    }

    let resolveInit!: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    super(initPromise);

    (async () => {
      const client = getWorkerClient();
      // Wait for all children to be initialized
      const childHandleIds = await Promise.all(children.map((w) => w.getHandleId()));
      this.handleId = await client.createColumn(childHandleIds);
      resolveInit();
    })();
  }
}

/**
 * A container that arranges widgets in a row (horizontal layout)
 */
export class Row extends Widget {
  constructor(children: Widget[], _options: RowOptions = {}) {
    if (children.length === 0) {
      throw new Error("Row must have at least one child");
    }
    if (children.length > 10) {
      throw new Error("Row supports maximum 10 children");
    }

    let resolveInit!: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    super(initPromise);

    (async () => {
      const client = getWorkerClient();
      // Wait for all children to be initialized
      const childHandleIds = await Promise.all(children.map((w) => w.getHandleId()));
      this.handleId = await client.createRow(childHandleIds);
      resolveInit();
    })();
  }
}

/**
 * A container that aligns a single child widget
 */
export class Alignment extends Widget {
  constructor(child: Widget, options: AlignmentOptions = {}) {
    let resolveInit!: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    super(initPromise);

    (async () => {
      const client = getWorkerClient();
      const childHandleId = await child.getHandleId();
      const x = options.x ?? 0.5; // Default to center
      const y = options.y ?? 0.5; // Default to center
      this.handleId = await client.createAlignment(childHandleId, x, y);
      resolveInit();
    })();
  }
}
