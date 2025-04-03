import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Analytics from './pages/Analytics';
import Folders from './pages/Folders';
import FolderView from './pages/FolderView';
import { GoogleMapsProvider } from './contexts/GoogleMapsContext';

// Import the SCSS instead of CSS
import './assets/scss/main.scss';

function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <GoogleMapsProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/" element={
                                <ProtectedRoute>
                                    <DashboardLayout />
                                </ProtectedRoute>
                            }>
                                <Route index element={<Dashboard />} />
                                <Route path="events" element={<Events />} />
                                <Route path="analytics" element={<Analytics />} />
                                <Route path="folders" element={<Folders />} />
                                <Route path="folders/:eventId/:folderName" element={<FolderView />} />
                            </Route>
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </BrowserRouter>
                </GoogleMapsProvider>
            </ThemeProvider>
        </AuthProvider>
    );
}

export default App;
