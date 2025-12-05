// Minimal stubs for child_process in browser/Electron renderer contexts.
// Any attempt to spawn should fail fast with a clear message.

const notSupported = () => {
  throw new Error("child_process is not available in this environment");
};

export const spawn = notSupported;
export const exec = notSupported;
export const execFile = notSupported;
export const fork = notSupported;

export default {
  spawn,
  exec,
  execFile,
  fork,
};
