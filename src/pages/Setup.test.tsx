import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import Setup from './Setup';
import { WalletService } from '../services/wallet';

// Mock dependencies
vi.mock('../services/wallet', () => ({
  WalletService: {
    generateMnemonic: vi.fn(),
    createNewWallet: vi.fn(),
    getAllWallets: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  };
});

describe('Setup Page', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (WalletService.generateMnemonic as any) = vi.fn().mockReturnValue('test mnemonic phrase with twelve words minimum required here');
    (WalletService.createNewWallet as any) = vi.fn().mockResolvedValue({
      id: 'wallet-1',
      name: 'New Wallet',
      mnemonic: 'test mnemonic phrase with twelve words minimum required here',
      privateKey: '0x123',
      createdAt: Date.now(),
    });
  });

  const renderSetup = () => {
    return render(
      <HashRouter>
        <Setup onComplete={mockOnComplete} />
      </HashRouter>
    );
  };

  it('should render setup form', () => {
    renderSetup();

    expect(screen.getByText(/Create New Wallet/)).toBeInTheDocument();
  });

  it('should generate mnemonic on create', async () => {
    renderSetup();

    // Enter wallet name first
    const nameInput = screen.getByPlaceholderText(/Enter wallet name/);
    fireEvent.change(nameInput, { target: { value: 'Test Wallet' } });

    const createButton = screen.getByText(/Create Wallet/);
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(WalletService.createNewWallet).toHaveBeenCalled();
    });
  });

  it('should display generated mnemonic', async () => {
    renderSetup();

    // Enter wallet name first
    const nameInput = screen.getByPlaceholderText(/Enter wallet name/);
    fireEvent.change(nameInput, { target: { value: 'Test Wallet' } });

    const createButton = screen.getByText(/Create Wallet/);
    fireEvent.click(createButton);

    await waitFor(() => {
      // Should show the mnemonic phrase
      expect(screen.getByText(/test mnemonic phrase/)).toBeInTheDocument();
    });
  });

  it('should allow wallet name input', () => {
    renderSetup();

    const nameInput = screen.getByPlaceholderText(/Enter wallet name/);
    fireEvent.change(nameInput, { target: { value: 'My Wallet' } });

    expect(nameInput).toHaveValue('My Wallet');
  });
});

