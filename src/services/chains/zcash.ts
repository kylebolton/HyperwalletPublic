import * as bitcoin from "bitcoinjs-lib";
import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import { type IChainService } from "./types";
import { sha256 } from "@noble/hashes/sha256";

const bip32 = BIP32Factory(ecc);

// ZCash network configuration
// ZCash uses different version bytes than Bitcoin for addresses
const zcashMainnet: bitcoin.Network = {
  messagePrefix: "\x18Zcash Signed Message:\n",
  bech32: undefined, // ZCash doesn't use bech32 for transparent addresses
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x1cb8, // Mainnet P2PKH - addresses start with 't1'
  scriptHash: 0x1cbd, // Mainnet P2SH - addresses start with 't3'
  wif: 0x80,
};

const zcashTestnet: bitcoin.Network = {
  messagePrefix: "\x18Zcash Signed Message:\n",
  bech32: undefined,
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x1d25, // Testnet P2PKH
  scriptHash: 0x1cba, // Testnet P2SH
  wif: 0xef,
};

// Retry helper
async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

export class ZCashChainService implements IChainService {
  chainName = "ZCash";
  symbol = "ZEC";
  private network: bitcoin.Network;
  private transparentAddress: string;
  private keyPair: any;
  private apiUrls: string[];

  constructor(mnemonic: string, network: "mainnet" | "testnet" = "mainnet") {
    try {
      // Use proper ZCash network configuration with correct version bytes
      this.network = network === "mainnet" ? zcashMainnet : zcashTestnet;

      // ZCash public API endpoints
      // Using block explorers that support ZCash with mempool.space-like API format
      this.apiUrls =
        network === "mainnet"
          ? [
              "https://explorer.z.cash/api", // Official ZCash explorer
              "https://zcashblockexplorer.com/api",
              "https://chain.so/api/v2", // Chain.so supports ZCash
            ]
          : ["https://explorer.testnet.z.cash/api"];

      if (!mnemonic || mnemonic.trim().length === 0) {
        throw new Error("ZCash: Invalid mnemonic provided");
      }

      const seed = bip39.mnemonicToSeedSync(mnemonic);

      // Use Bitcoin network for BIP32 derivation (standard approach)
      // The derivation path handles the coin type difference
      const root = bip32.fromSeed(seed, bitcoin.networks.bitcoin);

      // ZCash BIP44 path: m/44'/133'/0'/0/0 (coin type 133 for ZCash)
      const path =
        network === "mainnet" ? "m/44'/133'/0'/0/0" : "m/44'/1'/0'/0/0";

      try {
        const child = root.derivePath(path);
        this.keyPair = child;

        // Generate transparent address (P2PKH for ZCash) using ZCash network config
        // The network parameter ensures we use ZCash version bytes (0x1CB8)
        let address: string | undefined;

        try {
          const payment = bitcoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: this.network,
          });
          address = payment.address;
        } catch (e: any) {
          console.warn(
            "ZCash: bitcoin.payments.p2pkh failed, trying manual encoding:",
            e
          );
        }

        // ZCash uses 2-byte version numbers (0x1CB8 = 7352), which is too large for bitcoinjs-lib's standard methods
        // We need to manually encode the address with the 2-byte version prefix
        if (
          !address ||
          (network === "mainnet" &&
            !address.startsWith("t1") &&
            !address.startsWith("t3"))
        ) {
          // ZCash transparent addresses use 2-byte version numbers
          // Format: [version_byte_1][version_byte_2][hash160]
          const hash160 = bitcoin.crypto.hash160(child.publicKey);
          const version = this.network.pubKeyHash;
          if (!version || version > 65535) {
            throw new Error(`ZCash: Invalid version byte: ${version}`);
          }

          // Convert version to 2 bytes (big-endian)
          const versionBytes = Buffer.allocUnsafe(2);
          versionBytes.writeUInt16BE(version, 0);

          // Create payload: version (2 bytes) + hash160 (20 bytes) = 22 bytes
          const payload = Buffer.concat([versionBytes, hash160]);

          // Calculate Base58Check checksum: first 4 bytes of double SHA256
          // Use @noble/hashes/sha256 which is browser-compatible and synchronous
          const hash1 = sha256(payload);
          const hash2 = sha256(hash1);
          const checksum = Buffer.from(hash2.slice(0, 4));

          // Create address buffer: payload + checksum (22 + 4 = 26 bytes)
          const addressBuffer = Buffer.concat([payload, checksum]);

          // Base58 encode using manual implementation
          const ALPHABET =
            "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

          function base58Encode(buffer: Buffer): string {
            if (buffer.length === 0) return "";

            // Handle leading zeros first
            let leadingZeros = 0;
            while (leadingZeros < buffer.length && buffer[leadingZeros] === 0) {
              leadingZeros++;
            }

            if (leadingZeros === buffer.length) {
              return "1".repeat(buffer.length);
            }

            // Convert remaining bytes to BigInt
            const hex = buffer.slice(leadingZeros).toString("hex");
            let num = BigInt("0x" + hex);
            let result = "";

            while (num > 0n) {
              result = ALPHABET[Number(num % 58n)] + result;
              num = num / 58n;
            }

            // Add leading '1's for leading zero bytes
            result = "1".repeat(leadingZeros) + result;

            return result;
          }

          address = base58Encode(addressBuffer);
        }

        if (!address) {
          throw new Error(
            "ZCash: Failed to generate address - both methods failed"
          );
        }

        this.transparentAddress = address;

        // Verify address starts with correct prefix
        if (network === "mainnet") {
          if (
            !this.transparentAddress.startsWith("t1") &&
            !this.transparentAddress.startsWith("t3")
          ) {
            console.error(
              `ZCash: ERROR - Generated address doesn't start with 't1' or 't3': ${this.transparentAddress}`
            );
            console.error(
              `ZCash: Network pubKeyHash: ${
                this.network.pubKeyHash
              } (0x${this.network.pubKeyHash?.toString(16)})`
            );
            // Try to manually verify what version byte was used
            try {
              const decoded = bitcoin.address.fromBase58Check(
                this.transparentAddress
              );
              console.error(
                `ZCash: Decoded version byte: ${
                  decoded.version
                } (0x${decoded.version.toString(16)})`
              );
              console.error(
                `ZCash: Expected version: ${
                  this.network.pubKeyHash
                } (0x${this.network.pubKeyHash?.toString(16)})`
              );
            } catch (e) {
              console.error("ZCash: Could not decode address:", e);
            }
            throw new Error(
              `ZCash: Invalid address format generated: ${this.transparentAddress} (expected t1 or t3 prefix)`
            );
          }
        }
      } catch (deriveError: any) {
        console.error(
          "ZCash: Error during key derivation or address generation:",
          deriveError
        );
        console.error("ZCash: Error stack:", deriveError.stack);
        throw new Error(
          `ZCash derivation/address generation failed: ${deriveError.message}`
        );
      }
    } catch (error: any) {
      console.error("ZCash constructor error:", error);
      console.error("Error stack:", error.stack);
      // Re-throw with more context
      throw new Error(`ZCash initialization failed: ${error.message}`);
    }
  }

  async getAddress(): Promise<string> {
    // Return transparent address for now
    // Shielded addresses (z-addresses) require more complex implementation
    // Validate address before returning (non-blocking - warn but still return)
    if (!this.validateAddress(this.transparentAddress)) {
      console.warn(
        `ZCash address validation failed for: ${this.transparentAddress}, but returning anyway`
      );
    }
    return this.transparentAddress;
  }

  validateAddress(address: string): boolean {
    if (!address || typeof address !== "string") return false;

    // Check for transparent addresses (t-addresses)
    // Mainnet: 't1' (P2PKH) or 't3' (P2SH)
    // Testnet: 'tm' (P2PKH) or 't2' (P2SH)
    if (address.startsWith("t1") || address.startsWith("t3")) {
      // Mainnet transparent address
      if (this.network === zcashMainnet) {
        try {
          const decoded = bitcoin.address.fromBase58Check(address);
          const version = decoded.version;
          return version === 0x1cb8 || version === 0x1cbd;
        } catch (e) {
          return false;
        }
      }
      return false; // Wrong network
    }

    if (address.startsWith("tm") || address.startsWith("t2")) {
      // Testnet transparent address
      if (this.network === zcashTestnet) {
        try {
          const decoded = bitcoin.address.fromBase58Check(address);
          const version = decoded.version;
          return version === 0x1d25 || version === 0x1cba;
        } catch (e) {
          return false;
        }
      }
      return false; // Wrong network
    }

    // Check for shielded addresses (z-addresses)
    // Mainnet: starts with 'z', 78-95 characters
    // Testnet: starts with 'ztestsapling' or 'z' with 78+ characters
    if (address.startsWith("z")) {
      if (this.network === zcashMainnet) {
        return address.length >= 78 && address.length <= 95;
      } else {
        // Testnet
        return address.startsWith("ztestsapling") || address.length >= 78;
      }
    }

    return false;
  }

  async getBalance(): Promise<string> {
    for (const apiUrl of this.apiUrls) {
      try {
        const balance = await retry(
          async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            try {
              // Try format 1: /address/{address} (mempool.space-like format)
              // This format is used by explorer.z.cash
              try {
                const response = await fetch(
                  `${apiUrl}/address/${this.transparentAddress}`,
                  {
                    signal: controller.signal,
                    headers: {
                      Accept: "application/json",
                    },
                  }
                );

                if (response.ok) {
                  const data = await response.json();
                  clearTimeout(timeoutId);

                  // Try chain_stats format (like mempool.space)
                  if (data.chain_stats) {
                    const funded = data.chain_stats.funded_txo_sum || 0;
                    const spent = data.chain_stats.spent_txo_sum || 0;
                    return ((funded - spent) / 100000000).toFixed(8);
                  }

                  // Try mempool_stats format
                  if (data.mempool_stats) {
                    const funded = data.mempool_stats.funded_txo_sum || 0;
                    const spent = data.mempool_stats.spent_txo_sum || 0;
                    return ((funded - spent) / 100000000).toFixed(8);
                  }

                  // Try direct balance fields
                  if (data.balance !== undefined) {
                    return (data.balance / 100000000).toFixed(8);
                  }
                  if (data.balanceSat !== undefined) {
                    return (data.balanceSat / 100000000).toFixed(8);
                  }
                  if (
                    data.totalReceived !== undefined &&
                    data.totalSent !== undefined
                  ) {
                    return (
                      (data.totalReceived - data.totalSent) /
                      100000000
                    ).toFixed(8);
                  }
                }
              } catch (e) {
                // Try next format
              }

              // Try format 2: /addr/{address} (alternative format)
              try {
                const response = await fetch(
                  `${apiUrl}/addr/${this.transparentAddress}`,
                  {
                    signal: controller.signal,
                    headers: {
                      Accept: "application/json",
                    },
                  }
                );

                if (response.ok) {
                  const data = await response.json();
                  clearTimeout(timeoutId);

                  if (data.balance !== undefined) {
                    return (data.balance / 100000000).toFixed(8);
                  }
                  if (data.balanceSat !== undefined) {
                    return (data.balanceSat / 100000000).toFixed(8);
                  }
                  if (
                    data.totalReceived !== undefined &&
                    data.totalSent !== undefined
                  ) {
                    return (
                      (data.totalReceived - data.totalSent) /
                      100000000
                    ).toFixed(8);
                  }
                }
              } catch (e) {
                // Try next format
              }

              // Try format 3: Chain.so API format
              if (apiUrl.includes("chain.so")) {
                try {
                  const response = await fetch(
                    `${apiUrl}/get_address_balance/ZEC/${this.transparentAddress}`,
                    {
                      signal: controller.signal,
                      headers: {
                        Accept: "application/json",
                      },
                    }
                  );

                  if (response.ok) {
                    const data = await response.json();
                    clearTimeout(timeoutId);

                    if (
                      data.status === "success" &&
                      data.data?.confirmed_balance
                    ) {
                      return (
                        parseFloat(data.data.confirmed_balance) / 100000000
                      ).toFixed(8);
                    }
                  }
                } catch (e) {
                  // Continue to next
                }
              }

              clearTimeout(timeoutId);
              throw new Error("Unable to parse balance from API response");
            } catch (error: any) {
              clearTimeout(timeoutId);
              if (error.name === "AbortError") {
                throw new Error("Request timeout");
              }
              throw error;
            }
          },
          2,
          1000
        );

        return balance;
      } catch (error) {
        console.warn(`ZCash API ${apiUrl} failed:`, error);
        continue; // Try next API
      }
    }

    console.error("All ZCash APIs failed");
    return "0.0";
  }

  async sendTransaction(to: string, amount: string): Promise<string> {
    // ZCash transaction sending requires full node or light client implementation
    // For now, throw error indicating it's not implemented
    throw new Error(
      "ZCash transaction sending requires full node or light client implementation"
    );
  }
}
