import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home/Home';
import { SettingsApp } from './pages/Settings/SettingsApp';
import { StatisticsApp } from './pages/Statistics/StatisticsApp';

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/settings" element={<SettingsApp />} />
                <Route path="/statistics" element={<StatisticsApp />} />
            </Routes>
        </BrowserRouter>
    );
}
