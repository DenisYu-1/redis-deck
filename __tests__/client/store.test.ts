import { useAppStore } from '@/store/useAppStore';

describe('useAppStore environment switch', () => {
    beforeEach(() => {
        useAppStore.setState({ currentEnvironment: 'a', selectedKey: 'k' });
    });
    it('clears the selected key when the connection changes', () => {
        useAppStore.getState().setCurrentEnvironment('b');
        expect(useAppStore.getState().selectedKey).toBeNull();
    });
    it('keeps the selected key when the same connection is set again', () => {
        useAppStore.getState().setCurrentEnvironment('a');
        expect(useAppStore.getState().selectedKey).toBe('k');
    });
});
