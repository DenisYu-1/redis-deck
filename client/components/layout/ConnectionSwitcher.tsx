import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersIcon, UpDownIcon } from '@/components/ui/Icons';
import { TierBadge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/useAppStore';

export function ConnectionSwitcher() {
    const { connections, currentEnvironment, setCurrentEnvironment } =
        useAppStore();
    const [open, setOpen] = useState(false);
    const current = connections.find((c) => c.id === currentEnvironment);

    return (
        <div className="connwrap">
            <button
                type="button"
                className="connbtn"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span className="dot" />
                <span className="connmeta">
                    <span className="connname">
                        {current?.id ?? 'No connection'}
                    </span>
                    {current && (
                        <span className="mono xs mu ellip">
                            {current.host}:{current.port}
                        </span>
                    )}
                </span>
                {current?.tier && <TierBadge tier={current.tier} />}
                <UpDownIcon />
            </button>
            {open && (
                <div className="menu" role="menu">
                    {connections.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setCurrentEnvironment(c.id);
                                setOpen(false);
                            }}
                        >
                            <span
                                className="dot"
                                style={
                                    c.id === currentEnvironment
                                        ? undefined
                                        : { background: 'var(--bd2)' }
                                }
                            />
                            <span style={{ flex: 1 }}>{c.id}</span>
                            <TierBadge tier={c.tier ?? 'local'} />
                        </button>
                    ))}
                    <hr />
                    <Link
                        role="menuitem"
                        to="/connections"
                        onClick={() => setOpen(false)}
                    >
                        <SlidersIcon />
                        Manage connections
                    </Link>
                </div>
            )}
        </div>
    );
}
