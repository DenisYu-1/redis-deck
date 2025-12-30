import { render } from '@testing-library/react';
import { Logo } from '@/components/common/Logo';

describe('Logo', () => {
    it('renders without crashing', () => {
        const { container } = render(<Logo />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with correct class', () => {
        const { container } = render(<Logo />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('logo');
    });
});

