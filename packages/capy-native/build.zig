const std = @import("std");

pub fn build(b: *std.Build) !void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const capy_dep = b.dependency("capy", .{
        .target = target,
        .optimize = optimize,
    });
    const capy = capy_dep.module("capy");

    // Build as a shared library with debug symbols
    const lib = b.addSharedLibrary(.{
        .name = "capy-native",
        .root_source_file = b.path("src/wrapper.zig"),
        .target = target,
        .optimize = optimize,
    });
    lib.root_module.addImport("capy", capy);
    
    // Link libc for c_allocator (fastest general-purpose allocator)
    lib.linkLibC();
    
    // Enable debug symbols for better stack traces
    lib.root_module.strip = false;
    
    // Install the library
    b.installArtifact(lib);

    // Create a build step
    const build_step = b.step("build", "Build the shared library");
    build_step.dependOn(&lib.step);
}

