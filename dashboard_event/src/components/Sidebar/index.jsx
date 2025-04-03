import { Link, useLocation } from 'react-router-dom';
import { HiHome, HiCalendar, HiChartBar, HiX, HiFolder } from 'react-icons/hi';
import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

export default function Sidebar({ isOpen, toggleSidebar }) {
    const [folders, setFolders] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const location = useLocation();

    const menuItems = [
        { path: '/', name: 'Dashboard', icon: HiHome },
        { path: '/events', name: 'Events', icon: HiCalendar },
        { path: '/analytics', name: 'Analytics', icon: HiChartBar },
    ];

    useEffect(() => {
        const fetchFolders = async () => {
            try {
                const eventsRef = collection(db, 'events');
                const q = query(
                    eventsRef,
                    where('event_host', '==', auth.currentUser.uid)
                );

                const querySnapshot = await getDocs(q);
                const foldersList = [];
                querySnapshot.docs.forEach(doc => {
                    const event = doc.data();
                    if (event.folders && event.folders.length > 0) {
                        event.folders.forEach(folder => {
                            foldersList.push({
                                eventId: doc.id,
                                eventName: event.event_name,
                                folderName: folder
                            });
                        });
                    }
                });
                setFolders(foldersList);
            } catch (error) {
                console.error('Error fetching folders:', error);
            }
        };

        fetchFolders();
    }, []);

    useEffect(() => {
        const pathParts = location.pathname.split('/');
        if (pathParts[1] === 'folders' && pathParts.length > 3) {
            const eventId = pathParts[2];
            const folderName = decodeURIComponent(pathParts[3]);
            const currentFolder = folders.find(
                f => f.eventId === eventId && f.folderName === folderName
            );
            setCurrentFolder(currentFolder);
        } else {
            setCurrentFolder(null);
        }
    }, [location.pathname, folders]);

    return (
        <div className={`sidebar ${isOpen ? 'active' : ''}`}>
            <div className="d-flex justify-content-between align-items-center p-3">
                <h4 className="m-0">Event Dashboard</h4>
                <button className="btn d-md-none" onClick={toggleSidebar}>
                    <HiX />
                </button>
            </div>
            <div className="nav flex-column nav-pills">
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                    >
                        <item.icon className="me-2" />
                        {item.name}
                    </Link>
                ))}
                <div className="nav-item">
                    <NavLink
                        to="/folders"
                        className={({ isActive }) =>
                            `nav-link ${isActive || location.pathname.startsWith('/folders/') ? 'active' : ''}`
                        }
                    >
                        <HiFolder className="me-2" />
                        Folders
                    </NavLink>

                    {currentFolder && (
                        <div className="ms-4 mt-2">
                            <NavLink
                                to={`/folders/${currentFolder.eventId}/${encodeURIComponent(currentFolder.folderName)}`}
                                className="nav-link sub-nav-link active"
                            >
                                <small>
                                    {currentFolder.eventName} / {currentFolder.folderName}
                                </small>
                            </NavLink>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 