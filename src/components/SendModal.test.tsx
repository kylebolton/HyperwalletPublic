import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SendModal from './SendModal';
import { StorageService } from '../services/storage';
import { WalletService } from '../services/wallet';
import { NetworkService } from '../services/networks';
import { ChainManager } from '../services/chains/manager';

// Mock dependencies
vi.mock('../services/storage');
vi.mock('../services/wallet');
vi.mock('../services/networks');
vi.mock('../services/chains/manager');

describe('SendModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    symbol: 'ETH',
    chainKey: 'ETH',
  };

  let mockService: any;
  const mockChainManager = ChainManager as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = {
      sendTransaction: vi.fn().mockResolvedValue('0xtxhash123'),
    };
    (StorageService.getMnemonic as any) = vi.fn().mockReturnValue('test mnemonic');
    (WalletService.getStoredPrivateKey as any) = vi.fn().mockReturnValue(null);
    (NetworkService.getEnabledNetworks as any) = vi.fn().mockReturnValue([]);
    mockChainManager.mockReset();
    mockChainManager.mockImplementation(function () {
      return {
        getService: vi.fn().mockReturnValue(mockService),
      };
    });
  });

  it('should render send form', () => {
    render(<SendModal {...defaultProps} />);

    expect(screen.getByText('Send ETH')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter ETH address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
  });

  it('should disable send button when fields are empty', () => {
    render(<SendModal {...defaultProps} />);

    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when fields are filled', () => {
    render(<SendModal {...defaultProps} />);

    const addressInput = screen.getByPlaceholderText('Enter ETH address');
    const amountInput = screen.getByPlaceholderText('0.00');

    fireEvent.change(addressInput, { target: { value: '0xrecipient' } });
    fireEvent.change(amountInput, { target: { value: '1.0' } });

    const sendButton = screen.getByText('Send');
    expect(sendButton).not.toBeDisabled();
  });

  it('should send transaction when form is submitted', async () => {
    render(<SendModal {...defaultProps} />);

    const addressInput = screen.getByPlaceholderText('Enter ETH address');
    const amountInput = screen.getByPlaceholderText('0.00');
    const sendButton = screen.getByText('Send');

    fireEvent.change(addressInput, { target: { value: '0xrecipient' } });
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockService.sendTransaction).toHaveBeenCalledWith('0xrecipient', '1.0');
    }, { timeout: 2000 });
  });

  it('should display success message after successful transaction', async () => {
    render(<SendModal {...defaultProps} />);

    const addressInput = screen.getByPlaceholderText('Enter ETH address');
    const amountInput = screen.getByPlaceholderText('0.00');
    const sendButton = screen.getByText('Send');

    fireEvent.change(addressInput, { target: { value: '0xrecipient' } });
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Sent Successfully!')).toBeInTheDocument();
      expect(screen.getByText('0xtxhash123')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should display error message on transaction failure', async () => {
    mockService.sendTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

    render(<SendModal {...defaultProps} />);

    const addressInput = screen.getByPlaceholderText('Enter ETH address');
    const amountInput = screen.getByPlaceholderText('0.00');
    const sendButton = screen.getByText('Send');

    fireEvent.change(addressInput, { target: { value: '0xrecipient' } });
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Transaction failed')).toBeInTheDocument();
    });
  });

  it('should show loading state while sending', async () => {
    // Make sendTransaction take some time so we can see loading state
    mockService.sendTransaction.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve('0xtxhash'), 100))
    );

    render(<SendModal {...defaultProps} />);

    const addressInput = screen.getByPlaceholderText('Enter ETH address');
    const amountInput = screen.getByPlaceholderText('0.00');
    const sendButton = screen.getByText('Send');

    fireEvent.change(addressInput, { target: { value: '0xrecipient' } });
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    fireEvent.click(sendButton);

    // Wait for loading state to appear
    await waitFor(() => {
      expect(screen.getByText('Sending...')).toBeInTheDocument();
    }, { timeout: 1000 });
  });
});





