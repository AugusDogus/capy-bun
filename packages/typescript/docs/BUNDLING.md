# Bundling Native Libraries in Bun Executables

This document explains how `capy-ts` achieves single-file distribution by embedding the native library.

## The Challenge

When using Bun's FFI (`dlopen`), the operating system requires the native library (`.dll`, `.so`, `.dylib`) to exist as a file on disk. You cannot load a library directly from memory or from within an executable bundle.

## The Solution

We use a hybrid approach:

1. **Embed the library** in the Bun executable using `import ... with { type: "file" }`
2. **Extract on first run** to a cache directory
3. **Reuse the cached version** on subsequent runs

## Implementation

### 1. Import as Embedded Asset

In `src/lib-loader.ts`, we statically import the native library:

```typescript
// This import tells Bun to embed the file in the executable
import embeddedLib from "../../native/zig-out/bin/native.dll" with { type: "file" };
```

### 2. Extract to Cache

On first run, we extract the embedded library:

```typescript
const cacheDir = join(tmpdir(), "capy-bun-cache");
const extractedPath = join(cacheDir, libName);

const libData = await Bun.file(embeddedLib).arrayBuffer();
writeFileSync(extractedPath, new Uint8Array(libData));
```

### 3. Version Tracking

We use a simple version file to track when re-extraction is needed:

```typescript
const versionFile = join(cacheDir, "version.txt");
const currentVersion = "1.0.0"; // Increment when DLL changes

if (cachedVersion !== currentVersion) {
  // Re-extract
}
```

## Build Process

The build script (`build-exe.ts`) handles everything:

```bash
bun run build:exe
```

This:
1. Compiles the native library with Zig
2. Bundles the TypeScript code, worker, and native library into a single executable
3. Adds `--windows-hide-console` flag on Windows to create a pure GUI application
4. Creates `dist-exe/capy-hello.exe` - ready to distribute!

The resulting executable opens without a console window, making it perfect for end-user distribution.

## Cache Location

The native library is extracted to:
- **Windows**: `%TEMP%\capy-bun-cache\native.dll`
- **macOS**: `/tmp/capy-bun-cache/libnative.dylib`
- **Linux**: `/tmp/capy-bun-cache/libnative.so`

## Development vs Production

The loader automatically detects the environment:

- **Development**: Uses the library directly from `packages/native/zig-out/bin/`
- **Production**: Extracts from the embedded bundle

## Trade-offs

### Pros ✅
- Single-file distribution
- User-friendly (just one `.exe`)
- Automatic cache management
- Works across platforms

### Cons ❌
- First-run extraction overhead (~50ms)
- Requires write access to temp directory
- Library exists in two places (exe + cache)
- May trigger antivirus on first run (self-extracting behavior)

## Alternative Approaches

### 1. Two-File Distribution (Not Used)
Ship the `.exe` and `.dll` together. Simpler but requires users to keep files together.

### 2. Custom Installer (Not Used)
Use an installer to place files. More complex, requires admin rights.

### 3. Static Linking (Not Possible)
Bun's FFI requires dynamic libraries via `dlopen`.

## References

- [Bun Issue #11598](https://github.com/oven-sh/bun/issues/11598) - Discussion on FFI library bundling
- [Bun File Embedding](https://bun.sh/docs/bundler/executables#embed-assets--files) - Official documentation
- `src/lib-loader.ts` - Implementation details

