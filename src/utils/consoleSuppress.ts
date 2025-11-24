// Console log suppression utility
// Suppresses console.log and console.warn until explicitly enabled

let isSuppressing = true;
const suppressedLogs: Array<{
  type: "log" | "warn";
  args: any[];
  timestamp: number;
}> = [];

const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);

// Override console.log
console.log = (...args: any[]) => {
  if (isSuppressing) {
    suppressedLogs.push({ type: "log", args, timestamp: Date.now() });
  } else {
    originalLog(...args);
  }
};

// Override console.warn
console.warn = (...args: any[]) => {
  if (isSuppressing) {
    suppressedLogs.push({ type: "warn", args, timestamp: Date.now() });
  } else {
    originalWarn(...args);
  }
};

export function enableConsoleLogs() {
  if (!isSuppressing) return;

  isSuppressing = false;

  // Release all suppressed logs
  if (suppressedLogs.length > 0) {
    suppressedLogs.forEach(({ type, args }) => {
      if (type === "log") {
        originalLog(...args);
      } else {
        originalWarn(...args);
      }
    });
    suppressedLogs.length = 0; // Clear the buffer
  }
}

export function suppressConsoleLogs() {
  isSuppressing = true;
}

export function getSuppressedLogsCount(): number {
  return suppressedLogs.length;
}
