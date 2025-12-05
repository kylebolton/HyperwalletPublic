// Process polyfill for renderer process when contextIsolation is enabled
// This must be loaded before any code that uses process

if (typeof process === 'undefined') {
  (globalThis as any).process = {
    env: {} as NodeJS.ProcessEnv,
    versions: {
      node: '20.0.0',
    },
    nextTick: (callback: Function, ...args: any[]) => {
      setTimeout(() => callback(...args), 0);
    },
    browser: true,
    platform: 'browser' as NodeJS.Platform,
    argv: [],
    cwd: () => '/',
    exit: (code?: number) => {
      if (code !== undefined && code !== 0) {
        console.error(`Process exit requested with code ${code}`);
      }
    },
    version: 'v20.0.0',
    pid: 1,
    ppid: 0,
    title: 'browser',
    arch: 'x64',
    memoryUsage: () => ({
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0,
    }),
    uptime: () => 0,
    hrtime: () => [0, 0],
    hrtimeBigInt: () => BigInt(0),
    send: () => {},
    disconnect: () => {},
    on: () => {},
    once: () => {},
    off: () => {},
    emit: () => false,
    addListener: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
    setMaxListeners: () => {},
    getMaxListeners: () => 0,
    listeners: () => [],
    rawListeners: () => [],
    listenerCount: () => 0,
    eventNames: () => [],
    prependListener: () => {},
    prependOnceListener: () => {},
  };
}

export {};

