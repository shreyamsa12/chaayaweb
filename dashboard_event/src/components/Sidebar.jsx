import { Link, useLocation } from 'react-router-dom';
import { HiX, HiHome, HiCalendar, HiChartBar, HiFolder, HiUserGroup } from 'react-icons/hi';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const location = useLocation();

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* Logo/Title Section */}
            <div className="d-flex justify-content-between align-items-center p-3">
                <Link to="/" className="text-decoration-none">
                    <img
                        src="/dashboard_event/images/wawasensei-white.png"
                        alt="Chaaya.ai"
                        style={{ height: '84px', width: 'auto' }}
                        className="sidebar-logo"
                    />
                </Link>
                <button className="btn d-md-none" onClick={toggleSidebar}>
                    <HiX />
                </button>
            </div>

            {/* Navigation Links */}
            <div className="nav flex-column nav-pills">
                <Link
                    to="/"
                    className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                    data-discover="true"
                >
                    <HiHome className="me-2" />
                    Dashboard
                </Link>
                <Link
                    to="/events"
                    className={`nav-link ${location.pathname === '/events' ? 'active' : ''}`}
                    data-discover="true"
                >
                    <HiCalendar className="me-2" />
                    Events
                </Link>
                <Link
                    to="/analytics"
                    className={`nav-link ${location.pathname === '/analytics' ? 'active' : ''}`}
                    data-discover="true"
                >
                    <HiChartBar className="me-2" />
                    Analytics
                </Link>
                <Link
                    to="/attendees"
                    className={`nav-link ${location.pathname === '/attendees' ? 'active' : ''}`}
                    data-discover="true"
                >
                    <HiUserGroup className="me-2" />
                    Attendees
                </Link>
                <div className="nav-item">
                    <Link
                        to="/folders"
                        className={`nav-link ${location.pathname === '/folders' ? 'active' : ''}`}
                        data-discover="true"
                    >
                        <HiFolder className="me-2" />
                        Folders
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Sidebar; 