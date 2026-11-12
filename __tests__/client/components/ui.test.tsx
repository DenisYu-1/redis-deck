import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmented } from '@/components/ui/Segmented';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

describe('ui primitives', () => {
    it('Segmented marks the active option and reports changes', async () => {
        const onChange = jest.fn();
        render(
            <Segmented
                label="Theme"
                value="a"
                onChange={onChange}
                options={[
                    { value: 'a', label: 'Alpha' },
                    { value: 'b', label: 'Beta' }
                ]}
            />
        );
        expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
        await userEvent.click(screen.getByRole('radio', { name: 'Beta' }));
        expect(onChange).toHaveBeenCalledWith('b');
    });

    it('Modal renders content and closes on Escape or scrim click', async () => {
        const onClose = jest.fn();
        render(
            <Modal title="Hello" onClose={onClose}>
                body text
            </Modal>
        );
        expect(screen.getByRole('dialog', { name: 'Hello' })).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
        await userEvent.click(screen.getByTestId('modal-scrim'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('Chip toggles via aria-pressed', async () => {
        const onClick = jest.fn();
        render(<Chip on onClick={onClick}>hash</Chip>);
        const chip = screen.getByRole('button', { name: 'hash' });
        expect(chip).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(chip);
        expect(onClick).toHaveBeenCalled();
    });

    it('Badge shows the redis type label', () => {
        render(<Badge type="zset" />);
        expect(screen.getByText('zset')).toBeInTheDocument();
    });

    it('Button respects disabled', async () => {
        const onClick = jest.fn();
        render(
            <Button disabled onClick={onClick}>
                Go
            </Button>
        );
        await userEvent.click(screen.getByRole('button', { name: 'Go' }));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('EmptyState shows title, text and action', () => {
        render(
            <EmptyState title="Nothing" action={<a href="/x">Do it</a>}>
                add one
            </EmptyState>
        );
        expect(screen.getByRole('heading', { name: 'Nothing' })).toBeInTheDocument();
        expect(screen.getByText('add one')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Do it' })).toBeInTheDocument();
    });
});
