import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

export default function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <div className="main-content">
                <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                <div className="container-fluid">
                    <Outlet />
                </div>
            </div>
        </div>
    );
} 