import React from 'react';
import ReactDOM from 'react-dom/client';
import { StatisticsApp } from './pages/Statistics/StatisticsApp';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <StatisticsApp />
    </React.StrictMode>
);
