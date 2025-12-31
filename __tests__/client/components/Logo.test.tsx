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

    it('renders Redis text with logo-primary-red class', () => {
        const { container } = render(<Logo />);
        const texts = container.querySelectorAll('text');
        const redisText = Array.from(texts).find(text => text.textContent === 'Redis');
        expect(redisText).toBeInTheDocument();
        expect(redisText).toHaveClass('logo-primary-red');
    });

    it('renders Deck text with logo-dark-accent class', () => {
        const { container } = render(<Logo />);
        const texts = container.querySelectorAll('text');
        const deckText = Array.from(texts).find(text => text.textContent === 'Deck');
        expect(deckText).toBeInTheDocument();
        expect(deckText).toHaveClass('logo-dark-accent');
    });
});

