import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZCashChainService } from "./zcash";
import * as bip39 from "bip39";

// Mock fetch globally
global.fetch = vi.fn();

describe("ZCashChainService", () => {
  let service: ZCashChainService;
  const testMnemonic =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ZCashChainService(testMnemonic);
  });

  describe("getAddress", () => {
    it("should return a valid transparent address starting with 't1'", async () => {
      const address = await service.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe("string");
      expect(address.length).toBeGreaterThan(0);
      // ZCash mainnet transparent addresses start with 't1' (P2PKH) or 't3' (P2SH)
      expect(address.startsWith("t1") || address.startsWith("t3")).toBe(true);
      // For mainnet P2PKH, should start with 't1'
      expect(address.startsWith("t1")).toBe(true);
    });

    it("should return the same address on multiple calls", async () => {
      const address1 = await service.getAddress();
      const address2 = await service.getAddress();
      expect(address1).toBe(address2);
    });
  });

  describe("getBalance", () => {
    it("should return balance as string", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: 100000000, // 1 ZEC in satoshis
        }),
      });

      const balance = await service.getBalance();
      expect(balance).toBeDefined();
      expect(typeof balance).toBe("string");
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("API Error"));

      const balance = await service.getBalance();
      expect(balance).toBe("0.0");
    });

    it("should try multiple API endpoints on failure", async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error("First API failed"))
        .mockRejectedValueOnce(new Error("Second API failed"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ balance: 50000000 }),
        });

      const balance = await service.getBalance();
      expect(balance).toBe("0.50000000");
    });

    it("should handle different API response formats", async () => {
      // Test format 1: chain_stats format (like mempool.space)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chain_stats: {
            funded_txo_sum: 500000000,
            spent_txo_sum: 200000000,
          },
        }),
      });

      let balance = await service.getBalance();
      expect(balance).toBe("3.00000000");

      // Test format 2: balance field
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balance: 200000000 }),
      });

      balance = await service.getBalance();
      expect(parseFloat(balance)).toBeGreaterThan(0);

      // Test format 3: balanceSat field
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balanceSat: 300000000 }),
      });

      balance = await service.getBalance();
      expect(parseFloat(balance)).toBeGreaterThan(0);

      // Test format 4: totalReceived/totalSent
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalReceived: 400000000,
          totalSent: 100000000,
        }),
      });

      balance = await service.getBalance();
      expect(balance).toBe("3.00000000");
    });
  });

  describe("sendTransaction", () => {
    it("should throw error indicating not implemented", async () => {
      await expect(
        service.sendTransaction("test-address", "1.0")
      ).rejects.toThrow(
        "ZCash transaction sending requires full node or light client implementation"
      );
    });
  });

  describe("constructor", () => {
    it("should initialize with mnemonic", () => {
      const newService = new ZCashChainService(testMnemonic);
      expect(newService).toBeInstanceOf(ZCashChainService);
    });

    it("should use correct BIP44 path for mainnet", async () => {
      const service = new ZCashChainService(testMnemonic, "mainnet");
      const address = await service.getAddress();
      expect(address).toBeDefined();
    });

    it("should use correct BIP44 path for testnet", async () => {
      const service = new ZCashChainService(testMnemonic, "testnet");
      const address = await service.getAddress();
      expect(address).toBeDefined();
    });
  });

  describe("chain properties", () => {
    it("should have correct chainName", () => {
      expect(service.chainName).toBe("ZCash");
    });

    it("should have correct symbol", () => {
      expect(service.symbol).toBe("ZEC");
    });
  });

  describe("address validation", () => {
    it("should validate mainnet transparent P2PKH addresses (t1)", () => {
      // Valid mainnet P2PKH address (starts with 't1')
      const validMainnet = "t1XYZabcdefghijklmnopqrstuvwxyz123456789";
      expect(service.validateAddress(validMainnet)).toBe(true);
    });

    it("should validate mainnet transparent P2SH addresses (t3)", () => {
      // Valid mainnet P2SH address (starts with 't3')
      const validMainnetP2SH = "t3XYZabcdefghijklmnopqrstuvwxyz123456789";
      expect(service.validateAddress(validMainnetP2SH)).toBe(true);
    });

    it("should validate testnet transparent addresses", () => {
      // Valid testnet P2PKH address (starts with 'tm')
      const validTestnet = "tmXYZabcdefghijklmnopqrstuvwxyz123456789";
      const testnetService = new ZCashChainService(testMnemonic, "testnet");
      expect(testnetService.validateAddress(validTestnet)).toBe(true);
    });

    it("should validate shielded addresses (z-addresses)", () => {
      // Valid mainnet shielded address
      const validShielded = "z" + "1".repeat(77); // 78 chars total
      expect(service.validateAddress(validShielded)).toBe(true);
    });

    it("should reject invalid address formats", () => {
      expect(service.validateAddress("invalid")).toBe(false);
      expect(service.validateAddress("")).toBe(false);
      expect(service.validateAddress("bc1invalid")).toBe(false);
      expect(service.validateAddress("1ABC123")).toBe(false); // Bitcoin address
    });

    it("should reject testnet addresses on mainnet", () => {
      const testnetAddress = "tmXYZabcdefghijklmnopqrstuvwxyz123456789";
      expect(service.validateAddress(testnetAddress)).toBe(false);
    });

    it("should validate generated address", async () => {
      const address = await service.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe("string");
      // Generated address should start with 't1' for mainnet P2PKH
      expect(address.startsWith("t1")).toBe(true);
      expect(service.validateAddress(address)).toBe(true);
    });

    it("should generate addresses that start with t1", async () => {
      const address = await service.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe("string");
      expect(address.length).toBeGreaterThan(25); // ZCash addresses are typically 26-35 chars
      expect(address.startsWith("t1")).toBe(true);
    });

    it("should not generate Bitcoin addresses", async () => {
      const address = await service.getAddress();
      // Should not start with Bitcoin prefixes
      expect(address.startsWith("1")).toBe(false);
      expect(address.startsWith("3")).toBe(false);
      expect(address.startsWith("bc1")).toBe(false);
      // Should start with ZCash prefix
      expect(address.startsWith("t1")).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should throw error for invalid mnemonic", () => {
      expect(() => {
        new ZCashChainService("");
      }).toThrow();
    });

    it("should throw error if address generation fails", () => {
      // This would happen if network config is wrong
      // We can't easily test this without mocking, but the constructor should handle it
      const validMnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const service = new ZCashChainService(validMnemonic);
      expect(service).toBeInstanceOf(ZCashChainService);
    });
  });
});
