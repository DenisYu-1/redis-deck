import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Home } from './pages/Home/Home';
import { SettingsApp } from './pages/Settings/SettingsApp';
import { StatisticsApp } from './pages/Statistics/StatisticsApp';
import { WorkflowPage } from './pages/Workflows/WorkflowPage';

export function AppRoutes() {
    return (
        <Routes>
            <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/keys" replace />} />
                <Route path="/keys" element={<Home />} />
                <Route path="/stats" element={<StatisticsApp />} />
                <Route path="/stats/:board" element={<StatisticsApp />} />
                <Route path="/workflows/:actionId" element={<WorkflowPage />} />
                <Route path="/connections" element={<SettingsApp />} />
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
