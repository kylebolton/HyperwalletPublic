import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketService, type MarketData } from './market';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MarketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPrices', () => {
    it('should fetch prices for valid symbols', async () => {
      const mockResponse = {
        data: [
          {
            id: 'bitcoin',
            current_price: 60000,
            price_change_percentage_24h: 2.5,
            sparkline_in_7d: { price: [58000, 59000, 60000] },
          },
          {
            id: 'ethereum',
            current_price: 3000,
            price_change_percentage_24h: 1.5,
            sparkline_in_7d: { price: [2900, 2950, 3000] },
          },
        ],
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const prices = await MarketService.getPrices(['BTC', 'ETH']);

      expect(prices).toHaveProperty('BTC');
      expect(prices).toHaveProperty('ETH');
      expect(prices.BTC?.current_price).toBe(60000);
      expect(prices.ETH?.current_price).toBe(3000);
    });

    it('should handle API errors gracefully and return fallback prices', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const prices = await MarketService.getPrices(['BTC', 'ETH', 'SOL']);

      expect(prices).toHaveProperty('BTC');
      expect(prices).toHaveProperty('ETH');
      expect(prices).toHaveProperty('SOL');
      expect(prices.BTC?.current_price).toBe(60000); // Fallback value
      expect(prices.ETH?.current_price).toBe(3000); // Fallback value
    }, 10000); // Increase timeout for retry logic

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValue(timeoutError);

      const prices = await MarketService.getPrices(['BTC']);

      // Should return fallback on timeout
      expect(prices).toHaveProperty('BTC');
    }, 10000); // Increase timeout for retry logic

    it('should return empty object for unmapped symbols', async () => {
      const prices = await MarketService.getPrices(['INVALID']);

      expect(Object.keys(prices)).toHaveLength(0);
    });

    it('should include HYPE fallback when API fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API error'));

      const prices = await MarketService.getPrices(['HYPE']);

      expect(prices).toHaveProperty('HYPE');
      expect(prices.HYPE?.current_price).toBeGreaterThan(0);
    }, 10000); // Increase timeout for retry logic

    it('should map HYPEREVM to HYPE price', async () => {
      const mockResponse = {
        data: [
          {
            id: 'hyperliquid',
            current_price: 10.5,
            price_change_percentage_24h: 5.0,
          },
        ],
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const prices = await MarketService.getPrices(['HYPEREVM']);

      expect(prices).toHaveProperty('HYPEREVM');
      expect(prices.HYPEREVM?.current_price).toBe(10.5);
    });
  });
});

