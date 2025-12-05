// Browser-safe stubs for Node core modules that are not available in this environment.
// Only minimal surface area is provided to satisfy imports; functionality is not supported.

export const isIP = () => 0;
export const connect = () => {
  throw new Error("Network sockets are not available in the browser/Electron renderer");
};
export const createConnection = connect;

export default {
  isIP,
  connect,
  createConnection,
};
