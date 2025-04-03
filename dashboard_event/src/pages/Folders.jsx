import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { HiFolderOpen } from 'react-icons/hi';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function Folders() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setLoading(true);
                const eventsRef = collection(db, 'events');
                const q = query(
                    eventsRef,
                    where('event_host', '==', auth.currentUser.uid)
                );

                const querySnapshot = await getDocs(q);
                const eventsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).filter(event => event.folders && event.folders.length > 0);

                setEvents(eventsData);
            } catch (error) {
                console.error('Error fetching events:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    if (loading) {
        return (
            <div className="container-fluid">
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <h2 className="mb-4">Folders</h2>

            {events.length === 0 ? (
                <div className="alert alert-info">
                    No folders found. Create folders in your events to see them here.
                </div>
            ) : (
                <div className="row">
                    {events.map(event => (
                        <div key={event.id} className="col-12 mb-4">
                            <div className="card">
                                <div className="card-header">
                                    <h5 className="mb-0">{event.event_name}</h5>
                                    <small className="text-muted">
                                        {format(event.date.toDate(), 'dd MMM yyyy')}
                                    </small>
                                </div>
                                <div className="card-body">
                                    <div className="row g-4">
                                        {event.folders.map((folder, index) => (
                                            <div key={index} className="col-md-3 col-sm-6">
                                                <div
                                                    className="folder-card text-center"
                                                    onClick={() => navigate(`/folders/${event.id}/${encodeURIComponent(folder)}`)}
                                                >
                                                    <HiFolderOpen className="folder-icon" />
                                                    <div className="folder-name mt-2">
                                                        <strong>{event.event_name}</strong> / {folder}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
} 