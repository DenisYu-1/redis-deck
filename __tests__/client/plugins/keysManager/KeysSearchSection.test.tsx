import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KeysSearchSection } from '@/plugins/plugins/keysManager/components/KeysSearchSection';

describe('KeysSearchSection - Search History', () => {
    const defaultProps = {
        inputValue: '*',
        onInputChange: jest.fn(),
        onSearch: jest.fn(),
        onShowAll: jest.fn(),
        onKeyDown: jest.fn(),
        currentEnvironment: 'test-env',
        searchHistory: [],
        onHistorySelect: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should show history button', () => {
        render(<KeysSearchSection {...defaultProps} />);
        const historyButton = screen.getByTitle('Search History');
        expect(historyButton).toBeInTheDocument();
    });

    it('should show empty state when history is empty', () => {
        render(<KeysSearchSection {...defaultProps} searchHistory={[]} />);
        
        const historyButton = screen.getByTitle('Search History');
        fireEvent.click(historyButton);

        expect(screen.getByText('History is empty')).toBeInTheDocument();
    });

    it('should display history items when history is not empty', () => {
        const history = ['user:*', 'order:*', 'product:*'];
        render(<KeysSearchSection {...defaultProps} searchHistory={history} />);
        
        const historyButton = screen.getByTitle('Search History');
        fireEvent.click(historyButton);

        expect(screen.getByText('user:*')).toBeInTheDocument();
        expect(screen.getByText('order:*')).toBeInTheDocument();
        expect(screen.getByText('product:*')).toBeInTheDocument();
    });

    it('should call onHistorySelect when clicking a history item', () => {
        const history = ['user:*', 'order:*'];
        const onHistorySelect = jest.fn();
        render(<KeysSearchSection {...defaultProps} searchHistory={history} onHistorySelect={onHistorySelect} />);
        
        const historyButton = screen.getByTitle('Search History');
        fireEvent.click(historyButton);

        const historyItem = screen.getByText('order:*');
        fireEvent.click(historyItem);

        expect(onHistorySelect).toHaveBeenCalledWith('order:*');
    });

    it('should close popup when clicking outside', () => {
        const history = ['user:*'];
        render(<KeysSearchSection {...defaultProps} searchHistory={history} />);
        
        const historyButton = screen.getByTitle('Search History');
        fireEvent.click(historyButton);

        expect(screen.getByText('user:*')).toBeInTheDocument();

        fireEvent.mouseDown(document.body);

        expect(screen.queryByText('user:*')).not.toBeInTheDocument();
    });

    it('should toggle popup when clicking history button twice', () => {
        const history = ['user:*'];
        render(<KeysSearchSection {...defaultProps} searchHistory={history} />);
        
        const historyButton = screen.getByTitle('Search History');
        
        fireEvent.click(historyButton);
        expect(screen.getByText('user:*')).toBeInTheDocument();

        fireEvent.click(historyButton);
        expect(screen.queryByText('user:*')).not.toBeInTheDocument();
    });
});
