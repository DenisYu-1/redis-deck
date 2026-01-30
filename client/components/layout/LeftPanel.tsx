import { useState, useEffect } from 'react';
import type { Plugin, PluginEvent } from '@/plugins/types';
import type { PluginContext } from '@/types';

interface LeftPanelProps {
    plugins: Plugin[];
    context: PluginContext;
    emit: (event: PluginEvent) => void;
}

const STORAGE_KEY = 'left-panel-collapsed';

export function LeftPanel({ plugins, context, emit }: LeftPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'true';
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    }, [isCollapsed]);

    const scrollToPlugin = (pluginId: string) => {
        const element = document.getElementById(`plugin-section-${pluginId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleDefaultButtonClick = (pluginId: string) => {
        scrollToPlugin(pluginId);
    };

    const handleCustomButtonClick = (
        plugin: Plugin,
        button: NonNullable<Plugin['panelButton']>
    ) => {
        button.onClick({
            context,
            emit,
            pluginId: plugin.id
        });
    };

    const sortedPlugins = [...plugins].sort((a, b) => b.priority - a.priority);

    const handlePanelClick = (e: React.MouseEvent<HTMLElement>) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.left-panel-button')) {
            setIsCollapsed(!isCollapsed);
        }
    };

    return (
        <aside
            className={`left-panel ${isCollapsed ? 'collapsed' : ''}`}
            onClick={handlePanelClick}
        >
            <div className="left-panel-content">
                {sortedPlugins.map((plugin) => {
                    const panelButton = plugin.panelButton;
                    const showOnlyCustomWhenCollapsed =
                        isCollapsed && panelButton;
                    return (
                        <div
                            key={plugin.id}
                            className={`left-panel-plugin-group ${
                                showOnlyCustomWhenCollapsed
                                    ? 'collapsed-custom-only'
                                    : ''
                            }`}
                        >
                            {!showOnlyCustomWhenCollapsed && (
                                <button
                                    className="left-panel-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDefaultButtonClick(plugin.id);
                                    }}
                                >
                                    {isCollapsed
                                        ? plugin.name.charAt(0)
                                        : plugin.name}
                                </button>
                            )}
                            {panelButton && (
                                <button
                                    className="left-panel-button left-panel-button-custom"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCustomButtonClick(
                                            plugin,
                                            panelButton
                                        );
                                    }}
                                >
                                    {showOnlyCustomWhenCollapsed
                                        ? plugin.name.charAt(0)
                                        : '*'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
