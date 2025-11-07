/**
 * Load the native library, extracting it from the bundle if necessary
 */

import { suffix } from "bun:ffi";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

// Import the native library as an embedded file (static import for bundling)
// We conditionally import based on what exists at build time
// @ts-ignore - This will be resolved by Bun during bundling
import embeddedLib from "../../capy-native/zig-out/bin/capy-native.dll" with { type: "file" };

const libName = `capy-native.${suffix}`;

export async function loadNativeLibrary(): Promise<string> {
  // Check if we're in development mode (source files exist)
  const devPath = join(import.meta.dir, "../../capy-native/zig-out/bin", libName);
  if (existsSync(devPath)) {
    // Development mode: use the library directly from the filesystem
    return devPath;
  }
  
  // Production mode: extract from embedded bundle
  // Check if the embedded library is available
  if (!embeddedLib || typeof embeddedLib !== "string") {
    // Fallback: try next to executable
    const execDir = dirname(Bun.main);
    const execPath = join(execDir, libName);
    if (existsSync(execPath)) {
      return execPath;
    }
    
    throw new Error(
      `Could not find native library ${libName}. ` +
      `Tried:\n  - ${devPath}\n  - ${execPath}\n  - embedded bundle (not found)`
    );
  }
  
  // Production mode: extract from bundle
  // Create a persistent cache directory instead of using temp
  const cacheDir = join(tmpdir(), "capy-ts-cache");
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  
  const extractedPath = join(cacheDir, libName);
  
  // Only extract if it doesn't exist or is outdated
  // We use a simple version file to track if we need to re-extract
  const versionFile = join(cacheDir, "version.txt");
  const currentVersion = "1.0.0"; // Increment this when the DLL changes
  
  let needsExtraction = !existsSync(extractedPath);
  if (existsSync(versionFile)) {
    const cachedVersion = await Bun.file(versionFile).text();
    if (cachedVersion !== currentVersion) {
      needsExtraction = true;
    }
  } else {
    needsExtraction = true;
  }
  
  if (needsExtraction) {
    const libData = await Bun.file(embeddedLib).arrayBuffer();
    writeFileSync(extractedPath, new Uint8Array(libData));
    writeFileSync(versionFile, currentVersion);
  }
  
  return extractedPath;
}

