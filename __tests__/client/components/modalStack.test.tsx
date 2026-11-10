import { render, fireEvent } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

it('Escape closes only the topmost modal', () => {
    const outer = jest.fn();
    const inner = jest.fn();
    render(
        <>
            <Modal title="form" onClose={outer}>
                x
            </Modal>
            <Modal title="confirm" onClose={inner}>
                y
            </Modal>
        </>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
});
