import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    HiHome,
    HiUser,
    HiTable,
    HiCog,
    HiMenuAlt1,
    HiX
} from 'react-icons/hi';

export default function Sidebar() {
    const location = useLocation();
    const [isOpen, setIsOpen] = React.useState(true);

    const navItems = [
        { path: '/', name: 'Dashboard', icon: HiHome },
        { path: '/profile', name: 'Profile', icon: HiUser },
        { path: '/tables', name: 'Tables', icon: HiTable },
        { path: '/settings', name: 'Settings', icon: HiCog },
    ];

    return (
        <>
            <button
                className="mobile-nav-toggle btn btn-primary d-lg-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <HiX size={24} /> : <HiMenuAlt1 size={24} />}
            </button>

            <aside className={`sidenav navbar navbar-vertical navbar-expand-xs border-0 border-radius-xl my-3 fixed-start ms-3 bg-white ${isOpen ? 'show' : ''}`}>
                <div className="sidenav-header">
                    <Link className="navbar-brand m-0" to="/">
                        <img
                            src="/images/logo.png"
                            className="navbar-brand-img h-100"
                            alt="logo"
                        />
                        <span className="ms-1 font-weight-bold">Dashboard</span>
                    </Link>
                </div>

                <hr className="horizontal dark mt-0" />

                <div className="collapse navbar-collapse w-auto h-auto">
                    <ul className="navbar-nav">
                        {navItems.map((item) => (
                            <li className="nav-item" key={item.path}>
                                <Link
                                    className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                                    to={item.path}
                                >
                                    <div className="icon icon-shape icon-sm shadow border-radius-md bg-white text-center me-2 d-flex align-items-center justify-content-center">
                                        <item.icon
                                            className={location.pathname === item.path ? 'text-white' : 'text-dark'}
                                            size={18}
                                        />
                                    </div>
                                    <span className="nav-link-text ms-1">{item.name}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>
        </>
    );
} 