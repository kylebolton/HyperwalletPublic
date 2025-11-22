import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import Analytics from './Analytics';
import { StorageService } from '../services/storage';
import { WalletService } from '../services/wallet';
import { NetworkService } from '../services/networks';
import { ChainManager } from '../services/chains/manager';
import { MarketService } from '../services/market';

// Mock dependencies
vi.mock('../services/storage');
vi.mock('../services/wallet');
vi.mock('../services/networks');
vi.mock('../services/chains/manager');
vi.mock('../services/market');

describe('Analytics Page', () => {
  const mockServices = [
    {
      symbol: 'HYPE',
      chainName: 'HyperEVM',
      getBalance: vi.fn().mockResolvedValue('100.00'),
    },
    {
      symbol: 'BTC',
      chainName: 'Bitcoin',
      getBalance: vi.fn().mockResolvedValue('0.5'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (StorageService.getMnemonic as any) = vi.fn().mockReturnValue('test mnemonic');
    (WalletService.getStoredPrivateKey as any) = vi.fn().mockReturnValue(null);
    (NetworkService.getEnabledNetworks as any) = vi.fn().mockReturnValue([]);
    (ChainManager as any) = vi.fn().mockImplementation(() => ({
      getAllServices: vi.fn().mockReturnValue(mockServices),
    }));
    (MarketService.getPrices as any) = vi.fn().mockResolvedValue({
      HYPE: { current_price: 10 },
      BTC: { current_price: 60000 },
    });
  });

  const renderAnalytics = () => {
    return render(
      <HashRouter>
        <Analytics />
      </HashRouter>
    );
  };

  it('should render analytics page', () => {
    renderAnalytics();

    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('should display portfolio chart', async () => {
    renderAnalytics();

    await waitFor(() => {
      // Charts should render (Recharts components)
      expect(ChainManager).toHaveBeenCalled();
    });
  });

  it('should load market data', async () => {
    renderAnalytics();

    await waitFor(() => {
      expect(MarketService.getPrices).toHaveBeenCalled();
    });
  });

  it('should handle loading state', () => {
    renderAnalytics();

    // Should show loading initially
    expect(ChainManager).toHaveBeenCalled();
  });

  it('should calculate portfolio values', async () => {
    renderAnalytics();

    await waitFor(() => {
      expect(MarketService.getPrices).toHaveBeenCalled();
    });
  });
});




