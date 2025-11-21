import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

// Polyfills for Node.js modules
import assert from 'assert';
import { Readable } from 'stream-browserify';
import * as util from 'util';

// Polyfill for CommonJS 'exports' and 'module' (used by some libraries like monero-ts)
// This is a minimal polyfill - full CommonJS support would require a more complex solution
if (typeof (globalThis as any).exports === 'undefined') {
  const exportsObj: any = {};
  (globalThis as any).exports = exportsObj;
  // Some modules also check for module.exports
  if (typeof (globalThis as any).module === 'undefined') {
    (globalThis as any).module = { exports: exportsObj };
  }
}

// Make them available globally for libraries that expect them
if (typeof globalThis.assert === 'undefined') {
  (globalThis as any).assert = assert;
}
if (typeof globalThis.stream === 'undefined') {
  (globalThis as any).stream = { Readable };
}
if (typeof globalThis.util === 'undefined') {
  (globalThis as any).util = util;
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
