import { Buffer } from 'buffer';
// @ts-ignore
globalThis.Buffer = Buffer;

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Monero WASM
vi.mock('monero-ts', async () => {
  const actual = await vi.importActual('monero-ts');
  return {
      ...actual,
      default: {
          ...(actual as any).default,
          createWalletFull: vi.fn().mockResolvedValue({
              getAddress: vi.fn().mockResolvedValue('4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzT'.padEnd(95, 'A')),
              getBalance: vi.fn().mockResolvedValue(0),
              startSyncing: vi.fn(),
          }),
          MoneroNetworkType: { MAINNET: 'mainnet' }
      },
      createWalletFull: vi.fn().mockResolvedValue({
          getAddress: vi.fn().mockResolvedValue('4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzT'.padEnd(95, 'A')),
          getBalance: vi.fn().mockResolvedValue(0),
          startSyncing: vi.fn(),
      }),
      MoneroNetworkType: { MAINNET: 'mainnet' }
  };
});

// Mock ChainManager to avoid real Ethers/BTC/SOL instantiation during shallow App tests
// This prevents the "invalid BytesLike" error which comes from Ethers interacting with a potentially mismatched Buffer environment in JSDOM
// IMPORTANT: We preserve SupportedChain enum so it's available to other modules
vi.mock('../services/chains/manager', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/chains/manager')>();
    return {
        ...actual, // This preserves SupportedChain enum
        ChainManager: class {
            getAllServices() {
                return [
                    { symbol: 'HYPE', getBalance: async () => '100.00', getAddress: async () => '0x...' },
                    { symbol: 'BTC', getBalance: async () => '0.5', getAddress: async () => 'bc1...' },
                    { symbol: 'ETH', getBalance: async () => '10.0', getAddress: async () => '0x...' },
                    { symbol: 'SOL', getBalance: async () => '50.0', getAddress: async () => 'Sol...' },
                    { symbol: 'XMR', getBalance: async () => '5.0', getAddress: async () => '4...' },
                ];
            }
        }
    }
});


// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
