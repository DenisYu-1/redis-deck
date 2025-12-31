import { render, screen, waitFor } from '@testing-library/react';
import { EnvironmentSelector } from '@/components/Environment/EnvironmentSelector';
import { useAppStore } from '@/store/useAppStore';
import { getKeyCount } from '@/services/apiService';

// Mock the dependencies
jest.mock('@/store/useAppStore');
jest.mock('@/services/apiService');
jest.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        showToast: jest.fn(),
    }),
}));

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;
const mockGetKeyCount = getKeyCount as jest.MockedFunction<typeof getKeyCount>;

describe('EnvironmentSelector', () => {
    const mockConnections = [
        { id: 'test-env', host: 'localhost', port: 6379, tls: false, cluster: false }
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        mockUseAppStore.mockReturnValue({
            connections: mockConnections,
            currentEnvironment: 'test-env',
            setCurrentEnvironment: jest.fn(),
            setSelectedKey: jest.fn(),
            setIsLoading: jest.fn(),
            isLoading: false,
        });

        mockGetKeyCount.mockResolvedValue({ count: 42 });
    });

    it('should display loading initially and then show key count', async () => {
        render(<EnvironmentSelector />);

        // Initially should show Loading...
        expect(screen.getByText('Total Keys: Loading...')).toBeInTheDocument();

        // Wait for the key count to be fetched and displayed
        await waitFor(() => {
            expect(screen.getByText('Total Keys: 42')).toBeInTheDocument();
        });

        // Verify the API was called
        expect(mockGetKeyCount).toHaveBeenCalledWith('test-env');
    });

    it('should display N/A when no environment is selected', async () => {
        mockUseAppStore.mockReturnValue({
            connections: mockConnections,
            currentEnvironment: null,
            setCurrentEnvironment: jest.fn(),
            setSelectedKey: jest.fn(),
            setIsLoading: jest.fn(),
            isLoading: false,
        });

        render(<EnvironmentSelector />);

        await waitFor(() => {
            expect(screen.getByText('Total Keys: N/A')).toBeInTheDocument();
        });
    });

    it('should display N/A when key count fetch fails', async () => {
        mockGetKeyCount.mockRejectedValue(new Error('Connection failed'));

        render(<EnvironmentSelector />);

        await waitFor(() => {
            expect(screen.getByText('Total Keys: N/A')).toBeInTheDocument();
        });
    });
});
