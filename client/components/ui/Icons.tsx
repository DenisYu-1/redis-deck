import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

export const KeyIcon = () => (
    <Svg>
        <circle cx="8" cy="15" r="4" />
        <path d="M11 12l9-9M16 7l3 3" />
    </Svg>
);
export const ChartIcon = () => (
    <Svg>
        <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </Svg>
);
export const SlidersIcon = () => (
    <Svg>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
    </Svg>
);
export const UpDownIcon = () => (
    <Svg>
        <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </Svg>
);
export const MonitorIcon = () => (
    <Svg>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
    </Svg>
);
export const SunIcon = () => (
    <Svg>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </Svg>
);
export const MoonIcon = () => (
    <Svg>
        <path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" />
    </Svg>
);

export const LockIcon = () => (
    <Svg>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 018 0v3" />
    </Svg>
);
