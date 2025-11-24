import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enableConsoleLogs,
  suppressConsoleLogs,
  getSuppressedLogsCount,
} from "./consoleSuppress";

describe("Console Suppression Utility", () => {
  const originalLog = console.log;
  const originalWarn = console.warn;

  beforeEach(() => {
    // Reset to default state (suppressing)
    suppressConsoleLogs();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalLog;
    console.warn = originalWarn;
    enableConsoleLogs();
  });

  it("should suppress console.log when suppression is active", () => {
    suppressConsoleLogs();

    // Clear any existing suppressed logs
    enableConsoleLogs();
    suppressConsoleLogs();

    console.log("Test message");

    // Should have suppressed the log
    expect(getSuppressedLogsCount()).toBeGreaterThan(0);
  });

  it("should suppress console.warn when suppression is active", () => {
    suppressConsoleLogs();

    // Clear any existing suppressed logs
    enableConsoleLogs();
    suppressConsoleLogs();

    console.warn("Test warning");

    // Should have suppressed the warning
    expect(getSuppressedLogsCount()).toBeGreaterThan(0);
  });

  it("should enable console.log when suppression is disabled", () => {
    suppressConsoleLogs();
    console.log("Suppressed message");

    const suppressedCount = getSuppressedLogsCount();
    expect(suppressedCount).toBeGreaterThan(0);

    enableConsoleLogs();

    // After enabling, suppression count should be 0 (logs released)
    expect(getSuppressedLogsCount()).toBe(0);
  });

  it("should release suppressed logs when enabled", () => {
    suppressConsoleLogs();
    console.log("Message 1");
    console.warn("Warning 1");
    console.log("Message 2");

    const suppressedCount = getSuppressedLogsCount();
    expect(suppressedCount).toBeGreaterThan(0);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    enableConsoleLogs();

    // Suppressed logs should be released
    expect(getSuppressedLogsCount()).toBe(0);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should allow console.error to always work", () => {
    suppressConsoleLogs();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    console.error("Error message");

    // console.error should always work
    expect(errorSpy).toHaveBeenCalledWith("Error message");

    errorSpy.mockRestore();
  });
});
