import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';
import { ChartIcon, KeyIcon, SlidersIcon } from '@/components/ui/Icons';
import { ConnectionSwitcher } from './ConnectionSwitcher';
import { ThemeToggle } from './ThemeToggle';
import {
    getKeyCount,
    getServerStatus,
    type ServerStatus
} from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { useWorkflows } from '@/pages/Workflows/useWorkflows';

const BOARDS = [
    { to: '/stats', label: 'Overview', end: true },
    { to: '/stats/memory', label: 'Memory deep-dive', end: false }
];

function navClass({ isActive }: { isActive: boolean }) {
    return `navitem ${isActive ? 'on' : ''}`;
}

export function Sidebar() {
    const env = useAppStore((s) => s.currentEnvironment);
    const { pathname } = useLocation();
    const [counts, setCounts] = useState<{ env: string; n: number } | null>(
        null
    );
    const [info, setInfo] = useState<{ env: string; s: ServerStatus } | null>(
        null
    );
    const workflowPlugins = useWorkflows() ?? [];
    const keyCount = counts?.env === env ? counts.n : null;
    const status = info?.env === env ? info.s : null;

    useEffect(() => {
        if (!env) return;
        let cancelled = false;
        getKeyCount(env)
            .then((r) => !cancelled && setCounts({ env, n: r.count }))
            .catch(() => undefined);
        getServerStatus(env)
            .then((s) => !cancelled && setInfo({ env, s }))
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [env]);

    return (
        <aside className="side">
            <div className="brand">
                <Logo />
            </div>
            <ConnectionSwitcher />
            <nav className="navgroup" aria-label="Main">
                <NavLink to="/keys" className={navClass}>
                    <KeyIcon />
                    <span>Keys</span>
                    {keyCount !== null && (
                        <span className="count">
                            {keyCount.toLocaleString()}
                        </span>
                    )}
                </NavLink>
                <NavLink to="/stats" className={navClass}>
                    <ChartIcon />
                    <span>Statistics</span>
                </NavLink>
            </nav>
            {pathname.startsWith('/stats') && (
                <div className="navgroup">
                    <div className="navhead">
                        <span>Boards</span>
                    </div>
                    {BOARDS.map((b) => (
                        <NavLink
                            key={b.to}
                            to={b.to}
                            end={b.end}
                            className={({ isActive }) =>
                                `navitem ${isActive ? 'on' : ''}`
                            }
                        >
                            {b.label}
                        </NavLink>
                    ))}
                </div>
            )}
            {workflowPlugins.length > 0 && (
                <div className="navgroup" aria-label="Workflows">
                    <div className="navhead">
                        <span>Workflows</span>
                    </div>
                    {workflowPlugins.map((p) => (
                        <div key={p.id}>
                            <div className="navhead xs">
                                <span>{p.name}</span>
                            </div>
                            {p.actions.map((a) => (
                                <NavLink
                                    key={a.fullId}
                                    to={`/workflows/${a.fullId}`}
                                    className={navClass}
                                >
                                    {a.title}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </div>
            )}
            <div className="sidefoot">
                <NavLink to="/connections" className={navClass}>
                    <SlidersIcon />
                    <span>Settings</span>
                </NavLink>
                <ThemeToggle />
                <div className="status mono xs">
                    <span className="dot" style={{ width: 6, height: 6 }} />
                    {status
                        ? `Redis ${status.version} · ${String(status.pingMs)} ms`
                        : env
                          ? 'Connecting…'
                          : 'No connection'}
                </div>
            </div>
        </aside>
    );
}
