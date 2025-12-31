export function Logo() {
    return (
        <svg viewBox="0 0 465 100" xmlns="http://www.w3.org/2000/svg" className="logo">
            <g transform="translate(215, 50)">
                <g transform="translate(-215, -40)">
                    <rect x="20" y="20" width="100" height="70" rx="4" className="logo-dark-accent" opacity="0.3"/>
                    <rect x="10" y="10" width="100" height="70" rx="4" className="logo-primary-red" opacity="0.7"/>
                    <g>
                        <rect x="0" y="0" width="100" height="70" rx="4" className="logo-primary-red"/>
                        <line x1="35" y1="8" x2="35" y2="62" stroke="#FAFAFA" strokeWidth="2"/>
                        <line x1="65" y1="8" x2="65" y2="62" stroke="#FAFAFA" strokeWidth="2"/>
                        <line x1="8" y1="35" x2="92" y2="35" stroke="#FAFAFA" strokeWidth="2"/>
                        <circle cx="20" cy="20" r="4" fill="#FAFAFA"/>
                        <circle cx="50" cy="20" r="4" fill="#FAFAFA"/>
                        <circle cx="80" cy="20" r="4" fill="#FAFAFA"/>
                        <circle cx="20" cy="50" r="4" fill="#FAFAFA"/>
                        <circle cx="50" cy="50" r="4" fill="#FAFAFA"/>
                        <circle cx="80" cy="50" r="4" fill="#FAFAFA"/>
                    </g>
                </g>
                <text
                    x="-90"
                    y="11"
                    dominantBaseline="middle"
                    fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
                    fontSize="68"
                    fontWeight="700"
                    className="logo-primary-red"
                    letterSpacing="-2"
                >
                    Redis
                </text>
                <text
                    x="85"
                    y="11"
                    dominantBaseline="middle"
                    fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
                    fontSize="68"
                    fontWeight="700"
                    className="logo-dark-accent"
                    letterSpacing="-2"
                >
                    Deck
                </text>
            </g>
        </svg>
    );
}
