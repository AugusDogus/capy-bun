# Cross-Platform Building

This document explains how to build Capy-TS executables for different platforms.

## TL;DR

**Build on the target platform.** While Capy supports cross-compilation in theory, practical limitations make it easier to build natively on each platform.

## Current Approach: Native Builds

The recommended approach is to build on each target platform:

### On Windows
```bash
bun run build:exe
# Produces: dist-exe/capy-hello.exe
```

### On macOS
```bash
bun run build:exe
# Produces: dist-exe/capy-hello
```

### On Linux
```bash
bun run build:exe
# Produces: dist-exe/capy-hello
```

## Why Not Cross-Compile?

While Capy's README claims cross-compilation support, there are practical limitations:

### 1. System Library Dependencies

Each platform requires platform-specific system libraries:
- **Windows**: Win32 API (comctl32, gdi32, gdiplus)
- **Linux**: GTK4
- **macOS**: AppKit/Cocoa (via zig-objc)

Cross-compiling requires these libraries to be available on the build machine, which is complex to set up.

### 2. Bun's Cross-Compilation Limitations

Bun's `--target` flag exists but has limitations:
- May not work for all target platforms from all hosts
- The embedded file system may not handle cross-platform builds well

### 3. Import Resolution

The `lib-loader.ts` imports the native library with `{ type: "file" }`. This requires the library to exist at build time, which means you need to build the native library for the target platform first.

## Recommended: Use CI/CD

The best approach for multi-platform distribution is to use CI/CD (like GitHub Actions):

```yaml
name: Build

on: [push]

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - uses: goto-bus-stop/setup-zig@v2
      - run: cd packages/typescript && bun run build:exe
      - uses: actions/upload-artifact@v4
        with:
          name: capy-hello-windows
          path: packages/typescript/dist-exe/capy-hello.exe

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - uses: goto-bus-stop/setup-zig@v2
      - run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-4-dev
      - run: cd packages/typescript && bun run build:exe
      - uses: actions/upload-artifact@v4
        with:
          name: capy-hello-linux
          path: packages/typescript/dist-exe/capy-hello

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - uses: goto-bus-stop/setup-zig@v2
      - run: cd packages/typescript && bun run build:exe
      - uses: actions/upload-artifact@v4
        with:
          name: capy-hello-macos
          path: packages/typescript/dist-exe/capy-hello
```

## Future: True Cross-Compilation

If you want to set up true cross-compilation, you would need to:

1. **Install cross-compilation toolchains** for each target platform
2. **Install target platform system libraries** (GTK4 for Linux, etc.)
3. **Update `lib-loader.ts`** to import all platform libraries conditionally
4. **Update `build.zig`** to handle cross-compilation properly
5. **Test thoroughly** on each target platform

This is a significant undertaking and not recommended unless you have specific requirements.

## Platform-Specific Notes

### Windows
- PE header patching is applied automatically to hide the console window
- Requires no additional dependencies

### Linux
- Requires GTK4 development libraries: `sudo apt-get install libgtk-4-dev`
- May require additional dependencies depending on your distribution

### macOS
- Requires Xcode Command Line Tools
- May require additional setup for code signing

## Summary

**For most users**: Build on each platform natively or use CI/CD.

**For advanced users**: Cross-compilation is theoretically possible but requires significant setup and is not officially supported by this project.

