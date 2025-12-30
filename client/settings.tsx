import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsApp } from './pages/Settings/SettingsApp';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <SettingsApp />
    </React.StrictMode>
);
