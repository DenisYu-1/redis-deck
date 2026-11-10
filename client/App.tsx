import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { KeysPage } from './pages/Keys/KeysPage';
import { ConnectionsPage } from './pages/Connections/ConnectionsPage';
import { StatisticsApp } from './pages/Statistics/StatisticsApp';

export function AppRoutes() {
    return (
        <Routes>
            <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/keys" replace />} />
                <Route path="/keys" element={<KeysPage />} />
                <Route path="/stats" element={<StatisticsApp />} />
                <Route path="/stats/:board" element={<StatisticsApp />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route
                    path="/settings"
                    element={<Navigate to="/connections" replace />}
                />
                <Route path="*" element={<Navigate to="/keys" replace />} />
            </Route>
        </Routes>
    );
}

export function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    );
}
