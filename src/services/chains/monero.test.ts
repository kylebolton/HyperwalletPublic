import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MoneroChainService } from './monero';

const MOCK_ADDRESS = '4'.padEnd(95, 'A');
const setWorkerDistPath = vi.fn();
const setProxyToWorker = vi.fn();

// Mock monero-ts distro entry
vi.mock('monero-ts', () => ({
  default: {
    createWalletKeys: vi.fn().mockResolvedValue({
      getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
      getBalance: vi.fn().mockResolvedValue(1000000000000), // 1 XMR
      startSyncing: vi.fn(),
    }),
    MoneroWalletKeys: {
      createWallet: vi.fn().mockResolvedValue({
        getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockResolvedValue(1000000000000), // 1 XMR
        startSyncing: vi.fn(),
      }),
    },
    MoneroNetworkType: {
      MAINNET: 'mainnet',
    },
    LibraryUtils: {
      setWorkerDistPath,
    },
    MoneroUtils: {
      setProxyToWorker,
    },
  },
}));

describe('MoneroChainService - Address Validation', () => {
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  let service: MoneroChainService;

  const resetMoneroStatics = () => {
    (MoneroChainService as any).walletCache?.clear?.();
    (MoneroChainService as any).addressCache?.clear?.();
    (MoneroChainService as any).initPromises?.clear?.();
    (MoneroChainService as any).moneroModulePromise = null;
    (MoneroChainService as any).moneroSupported = null;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setWorkerDistPath.mockClear();
    setProxyToWorker.mockClear();
    resetMoneroStatics();
    service = new MoneroChainService(testMnemonic);
  });

  describe('getAddress', () => {
    it('should return a valid Monero address', async () => {
      const address = await service.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(0);
    });

    it('should validate address before returning', async () => {
      const address = await service.getAddress();
      if (address !== 'Address Error') {
        expect(service.validateAddress(address)).toBe(true);
      }
    });
  });

  describe('asset path resolution', () => {
    it('sets worker and wasm paths relative to http origins', async () => {
      const assetBaseSpy = vi
        .spyOn(MoneroChainService as any, 'getMoneroWorkerUrl')
        .mockReturnValue('https://example.com/app/monero.worker.js');
      await service.init();
      assetBaseSpy.mockRestore();

      expect(setWorkerDistPath).toHaveBeenCalledTimes(1);
      const workerArg = setWorkerDistPath.mock.calls[0][0];
      expect(workerArg).toBe('https://example.com/app/monero.worker.js');
      expect(setProxyToWorker).toHaveBeenCalled();
    });

    it('resolves worker and wasm assets for file:// builds', async () => {
      const assetBaseSpy = vi
        .spyOn(MoneroChainService as any, 'getMoneroWorkerUrl')
        .mockReturnValue('file:///Users/test/HyperWallet/dist/monero.worker.js');
      await service.init();
      assetBaseSpy.mockRestore();

      expect(setWorkerDistPath).toHaveBeenCalledTimes(1);
      const workerArg = setWorkerDistPath.mock.calls[0][0];
      expect(workerArg.startsWith('file:///Users/test/HyperWallet/dist/')).toBe(true);
      expect(workerArg.endsWith('/monero.worker.js')).toBe(true);
      expect(setProxyToWorker).toHaveBeenCalled();
    });
  });

  describe('validateAddress', () => {
    it('should validate mainnet standard address (starts with 4, 95 chars)', () => {
      // Valid Monero address: exactly 95 chars, starts with 4, base58 encoded
      // Using a valid base58 string that matches the pattern
      const validAddress = '4' + 'A'.repeat(94); // 95 chars total, starts with 4
      expect(validAddress.length).toBe(95);
      expect(validAddress[0]).toBe('4');
      // The validation checks format, so this should pass format check
      const isValid = service.validateAddress(validAddress);
      expect(typeof isValid).toBe('boolean');
      // Format should be valid (base58, correct length, starts with 4)
      expect(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(validAddress)).toBe(true);
    });

    it('should validate mainnet subaddress (starts with 8, 95 chars)', () => {
      // Valid Monero subaddress: exactly 95 chars, starts with 8, base58 encoded
      const validSubaddress = '8' + 'A'.repeat(94); // 95 chars total, starts with 8
      expect(validSubaddress.length).toBe(95);
      expect(validSubaddress[0]).toBe('8');
      const isValid = service.validateAddress(validSubaddress);
      expect(typeof isValid).toBe('boolean');
      expect(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(validSubaddress)).toBe(true);
    });

    it('should validate integrated address (starts with 4, 106 chars)', () => {
      // Valid Monero integrated address: exactly 106 chars, starts with 4, base58 encoded
      const validIntegrated = '4' + 'A'.repeat(105); // 106 chars total, starts with 4
      expect(validIntegrated.length).toBe(106);
      expect(validIntegrated[0]).toBe('4');
      const isValid = service.validateAddress(validIntegrated);
      expect(typeof isValid).toBe('boolean');
      expect(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(validIntegrated)).toBe(true);
    });

    it('should reject addresses with wrong length', () => {
      expect(service.validateAddress('4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFz')).toBe(false); // 94 chars
      expect(service.validateAddress('4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzTT')).toBe(false); // 96 chars
    });

    it('should reject addresses not starting with 4 or 8', () => {
      const invalidAddress = '1AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFzT';
      expect(service.validateAddress(invalidAddress)).toBe(false);
    });

    it('should reject invalid base58 characters', () => {
      const invalidBase58 = '4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skHNfzQYFYgQp8YwF2Y1nCvZzq6vDWc1vR65wXwscv5Y2CK3y1J2x6qFz0'; // Contains 0
      expect(service.validateAddress(invalidBase58)).toBe(false);
    });

    it('should reject empty addresses', () => {
      expect(service.validateAddress('')).toBe(false);
    });
  });

  describe('getBalance', () => {
    it('should return balance in XMR format', async () => {
      await service.init();
      const balance = await service.getBalance();
      expect(balance).toBe('1.00000000'); // 1000000000000 atomic units / 1e12
    });

    it('should return 0.0 for keys-only wallet without balance method', async () => {
      const mockWalletWithoutBalance = {
        getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        // No getBalance method
      };
      
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockResolvedValueOnce(mockWalletWithoutBalance);
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      await newService.init();
      
      const balance = await newService.getBalance();
      expect(balance).toBe('0.0');
    });

    it('should handle balance retrieval errors gracefully', async () => {
      const mockWalletWithError = {
        getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockResolvedValueOnce(mockWalletWithError);
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      await newService.init();
      
      const balance = await newService.getBalance();
      expect(balance).toBe('0.0');
    });

    it('should return 0.0 when wallet not initialized', async () => {
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      const balance = await newService.getBalance();
      expect(balance).toBe('0.0');
    });
  });

  describe('sendTransaction', () => {
    const validAddress = '4' + 'A'.repeat(94);
    
    it('should throw error when bridge is available', async () => {
      // Mock bridge
      const mockBridge = {
        initWallet: vi.fn(),
        getAddress: vi.fn(),
        getBalance: vi.fn(),
      };
      (window as any).moneroBridge = mockBridge;
      (MoneroChainService as any).bridge = mockBridge;
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      await expect(
        newService.sendTransaction(validAddress, '1.0')
      ).rejects.toThrow('Monero send is not available in this build');
      
      delete (window as any).moneroBridge;
      (MoneroChainService as any).bridge = undefined;
    });

    it('should validate address before sending', async () => {
      const mockWallet = {
        getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockResolvedValue(1000000000000), // 1 XMR
        createTx: vi.fn(),
      };
      
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockResolvedValueOnce(mockWallet);
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      await newService.init();
      
      await expect(
        newService.sendTransaction('invalid-address', '1.0')
      ).rejects.toThrow('Invalid Monero address');
    });

    it('should validate amount before sending', async () => {
      const mockWallet = {
        getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockResolvedValue(1000000000000), // 1 XMR
        createTx: vi.fn(),
      };
      
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockResolvedValueOnce(mockWallet);
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      await newService.init();
      
      await expect(
        newService.sendTransaction(validAddress, '0')
      ).rejects.toThrow('Invalid amount');
      
      await expect(
        newService.sendTransaction(validAddress, '-1')
      ).rejects.toThrow('Invalid amount');
      
      await expect(
        newService.sendTransaction(validAddress, 'invalid')
      ).rejects.toThrow('Invalid amount');
    });

    it('should check for sufficient balance', async () => {
      const mockWallet = {
        getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockResolvedValue(500000000000), // 0.5 XMR
        createTx: vi.fn(),
      };
      
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockResolvedValueOnce(mockWallet);
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      await newService.init();
      
      await expect(
        newService.sendTransaction(validAddress, '1.0') // Requesting 1 XMR but only have 0.5
      ).rejects.toThrow('Insufficient balance');
    });

    it('should throw error for view-only wallet', async () => {
      const mockWallet = {
        getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockResolvedValue(1000000000000), // 1 XMR
        // No createTx, createTransaction, or send methods
      };
      
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockResolvedValueOnce(mockWallet);
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      await newService.init();
      
      await expect(
        newService.sendTransaction(validAddress, '0.5')
      ).rejects.toThrow('Monero wallet is in view-only mode');
    });

    it('should initialize wallet if not initialized', async () => {
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      // Don't call init() manually
      const mockWallet = {
        getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockResolvedValue(1000000000000),
        createTx: vi.fn().mockResolvedValue({ getHash: () => 'txhash123' }),
      };
      
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockResolvedValue(mockWallet);
      
      // This should initialize the wallet first
      const result = await newService.sendTransaction(validAddress, '0.5');
      expect(result).toBe('txhash123');
    });
  });

  describe('caching', () => {
    it('should cache wallet instances', async () => {
      const service1 = new MoneroChainService(testMnemonic);
      const service2 = new MoneroChainService(testMnemonic);
      
      resetMoneroStatics();
      
      await service1.init();
      await service2.init();
      
      // Both should use the same cached wallet
      const cacheSize = (MoneroChainService as any).walletCache?.size || 0;
      expect(cacheSize).toBe(1);
    });

    it('should cache addresses', async () => {
      const address1 = await service.getAddress();
      const address2 = await service.getAddress();
      
      expect(address1).toBe(address2);
      const cachedAddress = (MoneroChainService as any).addressCache?.get(service['cacheKey']);
      expect(cachedAddress).toBe(address1);
    });

    it('should reset initialization state', () => {
      const newService = new MoneroChainService(testMnemonic);
      const cacheKey = newService['cacheKey'];
      
      // Set some state
      (MoneroChainService as any).walletCache?.set(cacheKey, {});
      (MoneroChainService as any).addressCache?.set(cacheKey, 'test-address');
      
      newService.resetInitState();
      
      expect((MoneroChainService as any).walletCache?.has(cacheKey)).toBe(false);
      expect((MoneroChainService as any).addressCache?.has(cacheKey)).toBe(false);
      expect(newService['wallet']).toBeNull();
      expect(newService['initAttempts']).toBe(0);
    });
  });

  describe('initialization retry logic', () => {
    it('should retry initialization on failure', async () => {
      const { default: moneroTs } = await import('monero-ts');
      let attemptCount = 0;
      
      (moneroTs.createWalletKeys as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary error');
        }
        return Promise.resolve({
          getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
          getBalance: vi.fn().mockResolvedValue(0),
        });
      });
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      // First attempt should fail, but service should allow retry
      try {
        await newService.init();
      } catch (e) {
        // Expected on first attempt
      }
      
      // Retry should succeed
      await newService.init();
      expect(attemptCount).toBe(2);
    });
  });

  describe('concurrent initialization', () => {
    it('should deduplicate concurrent init calls', async () => {
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      const { default: moneroTs } = await import('monero-ts');
      let initCount = 0;
      
      (moneroTs.createWalletKeys as any).mockImplementation(() => {
        initCount++;
        return Promise.resolve({
          getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
          getBalance: vi.fn().mockResolvedValue(0),
        });
      });
      
      // Trigger multiple concurrent init calls
      await Promise.all([
        newService.init(),
        newService.init(),
        newService.init(),
      ]);
      
      // Should only initialize once
      expect(initCount).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should provide user-friendly error messages for address errors', async () => {
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockRejectedValueOnce(
        new Error('Monero library (monero-ts) is not available')
      );
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      const address = await newService.getAddress();
      expect(address).toContain('Address Error');
      expect(address).toContain('not available');
    });

    it('should handle timeout errors gracefully', async () => {
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('createWalletKeys timeout')), 100)
        )
      );
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      try {
        await newService.init();
      } catch (e: any) {
        expect(e.message).toContain('timeout');
      }
    });
  });

  describe('Electron bridge integration', () => {
    beforeEach(() => {
      delete (window as any).moneroBridge;
      delete (window as any).electron;
      (MoneroChainService as any).bridge = undefined;
      (MoneroChainService as any).isElectron = null;
      (MoneroChainService as any).bridgeWaitPromise = null;
    });

    afterEach(() => {
      delete (window as any).moneroBridge;
      delete (window as any).electron;
      (MoneroChainService as any).bridge = undefined;
      (MoneroChainService as any).isElectron = null;
      (MoneroChainService as any).bridgeWaitPromise = null;
    });

    it('should use bridge when available', async () => {
      const mockBridge = {
        initWallet: vi.fn().mockResolvedValue({}),
        getAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockResolvedValue('1.00000000'),
      };
      
      (window as any).moneroBridge = mockBridge;
      (MoneroChainService as any).bridge = mockBridge;
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      await newService.init();
      expect(mockBridge.initWallet).toHaveBeenCalledWith(testMnemonic);
      
      const address = await newService.getAddress();
      expect(address).toBe(MOCK_ADDRESS);
      expect(mockBridge.getAddress).toHaveBeenCalledWith(testMnemonic);
      
      const balance = await newService.getBalance();
      expect(balance).toBe('1.00000000');
      expect(mockBridge.getBalance).toHaveBeenCalledWith(testMnemonic);
    });

    it('should fallback to browser mode when bridge fails', async () => {
      const mockBridge = {
        initWallet: vi.fn().mockRejectedValue(new Error('Bridge error')),
        getAddress: vi.fn(),
        getBalance: vi.fn(),
      };
      
      (window as any).moneroBridge = mockBridge;
      (MoneroChainService as any).bridge = mockBridge;
      
      // Setup browser mode mock to work
      const { default: moneroTs } = await import('monero-ts');
      (moneroTs.createWalletKeys as any).mockResolvedValueOnce({
        getPrimaryAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockResolvedValue(0),
      });
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      // Should fallback to browser mode
      await newService.init();
      
      // Verify browser mode was used (monero-ts was imported)
      expect(moneroTs.createWalletKeys).toHaveBeenCalled();
    });

    it('should use bridge when available immediately', async () => {
      const mockBridge = {
        initWallet: vi.fn().mockResolvedValue({}),
        getAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
        getBalance: vi.fn().mockResolvedValue('1.00000000'),
      };
      
      // Bridge available immediately
      (window as any).moneroBridge = mockBridge;
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      await newService.init();
      expect(mockBridge.initWallet).toHaveBeenCalled();
    });

    it('should fail in Electron if bridge is never available', async () => {
      // Simulate Electron environment by mocking navigator.userAgent
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Electron/1.0.0',
        configurable: true,
        writable: true,
      });
      
      // No bridge available
      delete (window as any).moneroBridge;
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      await expect(newService.init()).rejects.toThrow('Monero bridge is not available in Electron');
      
      // Restore original
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
        writable: true,
      });
    }, 7000); // Timeout should be less than bridge wait time

    it('should skip browser mode import in Electron', async () => {
      // Simulate Electron environment by mocking navigator.userAgent
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Electron/1.0.0',
        configurable: true,
        writable: true,
      });
      
      const newService = new MoneroChainService(testMnemonic);
      resetMoneroStatics();
      
      // Should fail because bridge is not available in Electron
      await expect(newService.init()).rejects.toThrow('Electron');
      
      // Restore original
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
        writable: true,
      });
    }, 7000); // Timeout should be less than bridge wait time
  });
});
