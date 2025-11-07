import type { Pointer } from "bun:ffi";

export type CapyWindowHandle = Pointer;
export type CapyWidgetHandle = Pointer;

export interface Size {
  width: number;
  height: number;
}

export interface Alignment {
  x?: number; // 0.0 (left) to 1.0 (right), default 0.5 (center)
  y?: number; // 0.0 (top) to 1.0 (bottom), default 0.5 (center)
}

export interface LabelOptions {
  text: string;
  alignment?: "Left" | "Center" | "Right";
}

export interface ButtonOptions {
  label: string;
  onclick?: () => void;
}

export interface TextFieldOptions {
  text?: string;
  readOnly?: boolean;
}

export interface RowOptions {
  spacing?: number; // Not yet implemented in wrapper
}

export interface ColumnOptions {
  spacing?: number; // Not yet implemented in wrapper
}

