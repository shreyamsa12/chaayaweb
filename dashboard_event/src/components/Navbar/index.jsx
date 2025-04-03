import React from 'react';
import { HiMenuAlt1, HiSun, HiMoon } from 'react-icons/hi';
import { FaUserCircle } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ toggleSidebar }) {
    const { darkMode, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Failed to log out:', error);
        }
    };

    return (
        <nav className="navbar navbar-expand-lg mb-4">
            <div className="container-fluid">
                <button
                    className="btn d-md-none"
                    onClick={toggleSidebar}
                >
                    <HiMenuAlt1 size={24} />
                </button>
                <div className="d-flex align-items-center">
                    <input
                        type="search"
                        className="form-control ms-2"
                        placeholder="Search..."
                    />
                </div>
                <div className="ms-auto d-flex align-items-center">
                    <button
                        className="theme-toggle me-3"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                    >
                        {darkMode ? <HiSun size={24} /> : <HiMoon size={24} />}
                    </button>
                    <div className="dropdown">
                        <button
                            className="btn btn-link"
                            type="button"
                            id="profileDropdown"
                            data-bs-toggle="dropdown"
                        >
                            <FaUserCircle size={32} className="text-primary" />
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end">
                            <li>
                                <span className="dropdown-item-text">{user?.email}</span>
                            </li>
                            <li><hr className="dropdown-divider" /></li>
                            <li>
                                <button
                                    className="dropdown-item"
                                    onClick={handleLogout}
                                >
                                    Logout
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </nav>
    );
} 