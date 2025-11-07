/**
 * Build script to create a standalone executable with the native library
 */

import { $ } from "bun";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Windows PE header constants
const GUI_SUBSYSTEM = 0x2;
const CONSOLE_SUBSYSTEM = 0x3;

/**
 * Patch the Windows PE header to change subsystem from Console to GUI
 * This is a workaround for Bun's --windows-hide-console flag not working
 * See: https://github.com/oven-sh/bun/issues/19916#issuecomment-3299059370
 */
function patchWindowsSubsystem(exePath: string): void {
  const buffer = Buffer.from(readFileSync(exePath));
  
  // Read PE header offset from DOS header
  const peOffset = buffer.readUInt32LE(0x3C);
  
  // Subsystem field is at PE header + 0x5C
  const subsystemOffset = peOffset + 0x5C;
  const currentSubsystem = buffer.readUInt16LE(subsystemOffset);
  
  if (currentSubsystem !== CONSOLE_SUBSYSTEM) {
    console.warn(`Warning: Unexpected subsystem value: 0x${currentSubsystem.toString(16)}`);
    return;
  }
  
  // Change to GUI subsystem
  buffer.writeUInt16LE(GUI_SUBSYSTEM, subsystemOffset);
  writeFileSync(exePath, buffer);
  
  console.log("✓ Patched PE header to GUI subsystem (console hidden)\n");
}

const distDir = join(import.meta.dir, "dist-exe");
const nativeLibDir = join(import.meta.dir, "../capy-native/zig-out/bin");

// Determine the native library name based on platform
const suffix = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
const nativeLibName = `capy-native.${suffix}`;

console.log("Building Capy-TS standalone executable...\n");

// Step 1: Build the native library in release mode (disables logging)
console.log("Step 1: Building native library in release mode...");
await $`cd ../capy-native && zig build -Doptimize=ReleaseFast`;
console.log("✓ Native library built\n");

// Step 2: Create dist directory
console.log("Step 2: Creating distribution directory...");
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}
console.log("✓ Directory created\n");

// Step 3: Build the executable with the worker and native library bundled in
console.log("Step 3: Building executable with embedded worker and native library...");
// Note: The native library will be imported with { type: "file" } in lib-loader.ts
// Bun will automatically bundle it when it sees that import
const outfile = join(distDir, "capy-hello");
await $`bun build --compile --outfile ${outfile} examples/hello-world.ts src/ui-worker.ts`;
console.log("✓ Executable built (with embedded worker and native library)\n");

// Step 4: Patch Windows executable to hide console (workaround for Bun bug)
if (process.platform === "win32") {
  console.log("Step 4: Patching Windows PE header to hide console...");
  patchWindowsSubsystem(outfile + ".exe");
}

console.log("\nBuild complete!");
console.log(`\nDistribution files in: ${distDir}`);
console.log(`  - capy-hello${process.platform === "win32" ? ".exe" : ""}`);
console.log("\n✨ Single-file executable!");
console.log("   - Worker thread: embedded");
console.log("   - Native library: embedded (extracted to cache on first run)");
console.log("\nTo run: cd dist-exe && ./capy-hello");
console.log("\nNote: On first run, the native library will be extracted to:");
console.log(`  ${join(tmpdir(), "capy-ts-cache", nativeLibName)}`);

