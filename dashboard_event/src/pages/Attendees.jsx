import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { HiCalendar, HiLocationMarker, HiUsers, HiMail, HiPhone } from 'react-icons/hi';

const Attendees = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user] = useAuthState(auth);

    useEffect(() => {
        const fetchEventsAndAttendees = async () => {
            if (!user) return;

            try {
                // First fetch all events for this host
                const eventsRef = collection(db, 'events');
                const eventsQuery = query(eventsRef, where('event_host', '==', user.uid));
                const eventsSnapshot = await getDocs(eventsQuery);

                const eventsData = eventsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    attendees: [] // Initialize empty attendees array
                }));

                // For each event, fetch its attendees from eventsregistry
                const eventsWithAttendees = await Promise.all(
                    eventsData.map(async (event) => {
                        const registryRef = collection(db, 'eventsregistry');
                        const registryQuery = query(registryRef, where('eventId', '==', event.id));
                        const registrySnapshot = await getDocs(registryQuery);

                        const attendees = registrySnapshot.docs.map(doc => ({
                            ...doc.data(),
                            registrationDate: doc.data().timestamp // Using timestamp as registration date
                        }));

                        return {
                            ...event,
                            attendees
                        };
                    })
                );

                console.log('Events with attendees:', eventsWithAttendees); // Debug log
                setEvents(eventsWithAttendees);
            } catch (error) {
                console.error('Error fetching events and attendees:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEventsAndAttendees();
    }, [user]);

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center h-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="text-center mt-5">
                <h3>No events found</h3>
                <p>Create an event to see attendee information</p>
            </div>
        );
    }

    return (
        <div className="container py-4">
            <h2 className="mb-4">Events & Attendees</h2>
            <div className="row g-4">
                {events.map(event => (
                    <div key={event.id} className="col-12">
                        <div className="card event-card">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                    <h5 className="card-title mb-0">{event.event_name}</h5>
                                    <span className="badge bg-primary">
                                        {event.attendees?.length || 0} Attendees
                                    </span>
                                </div>
                                <div className="card-text mb-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <HiCalendar className="me-2" />
                                        <span>
                                            {new Date(event.date.toDate()).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="d-flex align-items-center">
                                        <HiLocationMarker className="me-2" />
                                        <span>{event.event_location_name}</span>
                                    </div>
                                </div>

                                {/* Attendees List */}
                                {event.attendees && event.attendees.length > 0 ? (
                                    <div className="table-responsive mt-3">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Selfie</th>
                                                    <th>Name</th>
                                                    <th>Phone</th>
                                                    <th>Registration Date</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {event.attendees.map((attendee, index) => (
                                                    <tr key={index}>
                                                        <td>
                                                            <img
                                                                src={attendee.selfieUrl}
                                                                alt={`${attendee.name}'s selfie`}
                                                                className="attendee-selfie rounded"
                                                                style={{
                                                                    width: '50px',
                                                                    height: '50px',
                                                                    objectFit: 'cover',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onClick={() => window.open(attendee.selfieUrl, '_blank')}
                                                            />
                                                        </td>
                                                        <td>{attendee.name}</td>
                                                        <td>
                                                            <div className="d-flex align-items-center">
                                                                <HiPhone className="me-2" />
                                                                {attendee.phone}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {new Date(attendee.timestamp).toLocaleString()}
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${attendee.verified ? 'bg-success' : 'bg-warning'}`}>
                                                                {attendee.verified ? 'Verified' : 'Pending'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => {
                                                                    console.log('Running AI share for:', attendee);
                                                                }}
                                                            >
                                                                Run AI Share
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-3">
                                        <p className="text-muted mb-0">No attendees registered yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Attendees;