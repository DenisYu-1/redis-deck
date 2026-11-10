import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Home } from './pages/Home/Home';
import { ConnectionsPage } from './pages/Connections/ConnectionsPage';
import { StatisticsApp } from './pages/Statistics/StatisticsApp';

export function AppRoutes() {
    return (
        <Routes>
            <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/keys" replace />} />
                <Route path="/keys" element={<Home />} />
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
