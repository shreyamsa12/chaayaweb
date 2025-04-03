import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Tables from './pages/Tables';

// Import styles
import './assets/scss/corporate-ui-dashboard.scss';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="tables" element={<Tables />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
