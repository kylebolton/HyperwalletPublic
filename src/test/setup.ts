import { Buffer } from 'buffer';
// @ts-ignore
globalThis.Buffer = Buffer;

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Monero WASM
vi.mock('monero-ts', () => {
  return {
      default: {
          createWalletFull: vi.fn(),
          MoneroNetworkType: { MAINNET: 'mainnet' }
      },
      createWalletFull: vi.fn(),
      MoneroNetworkType: { MAINNET: 'mainnet' }
  }
});

// Mock ChainManager to avoid real Ethers/BTC/SOL instantiation during shallow App tests
// This prevents the "invalid BytesLike" error which comes from Ethers interacting with a potentially mismatched Buffer environment in JSDOM
vi.mock('../services/chains/manager', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/chains/manager')>();
    return {
        ...actual,
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
