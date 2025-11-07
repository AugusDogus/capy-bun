/**
 * Capy TypeScript - Native UI framework for Bun
 * 
 * A TypeScript wrapper around the Capy UI framework using Bun's FFI.
 * Provides a declarative API for building cross-platform native UIs.
 */

// Core functionality
export { init, deinit, runEventLoop } from "./capy";

// Window management
export { Window } from "./window";

// Widgets
export {
  Widget,
  Label,
  Button,
  TextField,
  Column,
  Row,
  Alignment,
} from "./widgets";

// Types
export type {
  Size,
  Alignment as AlignmentOptions,
  LabelOptions,
  ButtonOptions,
  TextFieldOptions,
  RowOptions,
  ColumnOptions,
} from "./types";

