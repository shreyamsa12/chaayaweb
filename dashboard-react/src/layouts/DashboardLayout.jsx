import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

export default function DashboardLayout() {
    return (
        <div className="g-sidenav-show bg-gray-100">
            <Sidebar />
            <main className="main-content position-relative max-height-vh-100 h-100 border-radius-lg">
                <Navbar />
                <div className="container-fluid py-4">
                    <Outlet />
                    <Footer />
                </div>
            </main>
        </div>
    );
} 