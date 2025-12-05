import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryService, type Transaction } from './history';
import { SupportedChain } from './chains/manager';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HistoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHistory', () => {
    it('should return empty array for unsupported chains', async () => {
      const history = await HistoryService.getHistory(SupportedChain.XMR, 'test-address');
      
      expect(history).toEqual([]);
    });

    it('should return empty array for ETH (not implemented)', async () => {
      const history = await HistoryService.getHistory(SupportedChain.ETH, '0x123');
      
      expect(history).toEqual([]);
    });

    it('should return empty array for SOL (not implemented)', async () => {
      const history = await HistoryService.getHistory(SupportedChain.SOL, 'Sol123');
      
      expect(history).toEqual([]);
    });

    it('should fetch BTC history successfully', async () => {
      const mockResponse = {
        data: [
          {
            txid: 'abc123',
            hash: 'abc123',
            vout: [
              {
                scriptpubkey_address: 'bc1test',
                value: 100000000, // 1 BTC in satoshis
              },
            ],
            vin: [],
            status: {
              confirmed: true,
              block_time: Math.floor(Date.now() / 1000) - 3600,
            },
          },
        ],
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const history = await HistoryService.getHistory(
        SupportedChain.BTC,
        'bc1test'
      );

      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('receive');
      expect(history[0].asset).toBe('BTC');
      expect(history[0].amount).toBe('1.00000000');
      expect(history[0].status).toBe('Confirmed');
    });

    it('should handle BTC API failures gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API error'));

      const history = await HistoryService.getHistory(
        SupportedChain.BTC,
        'bc1test'
      );

      expect(history).toEqual([]);
    }, 10000); // Increase timeout for error handling

    it('should retry on BTC API failure', async () => {
      mockedAxios.get
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({ data: [] });

      const history = await HistoryService.getHistory(
        SupportedChain.BTC,
        'bc1test'
      );

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(history).toEqual([]);
    });

    it('should parse BTC transaction correctly', async () => {
      const mockResponse = {
        data: [
          {
            txid: 'tx123',
            vout: [
              {
                scriptpubkey_address: 'bc1test',
                value: 50000000, // 0.5 BTC
              },
            ],
            status: {
              confirmed: false,
              block_time: null,
            },
          },
        ],
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const history = await HistoryService.getHistory(
        SupportedChain.BTC,
        'bc1test'
      );

      expect(history[0].type).toBe('receive');
      expect(history[0].amount).toBe('0.50000000');
      expect(history[0].status).toBe('Pending');
    });
  });
});





