import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth, storage, functions } from '../config/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { HiCalendar, HiLocationMarker, HiUsers, HiMail, HiPhone } from 'react-icons/hi';
import { ref, listAll } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

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
                            id: doc.id,
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
                                                                onClick={async () => {
                                                                    const selfieUrl = attendee.selfieUrl;
                                                                    const eventId = event.id;
                                                                    const registryId = attendee.uid;

                                                                    if (!registryId) {
                                                                        console.error('No registry ID found for attendee:', attendee);
                                                                        alert('Error: Could not find attendee registry. Please try again.');
                                                                        return;
                                                                    }

                                                                    try {
                                                                        // Fetch event data using eventId
                                                                        const eventDoc = await getDoc(doc(db, 'events', eventId));
                                                                        if (!eventDoc.exists()) {
                                                                            throw new Error('Event not found');
                                                                        }

                                                                        const eventData = eventDoc.data();
                                                                        const folders = eventData.folders || [];

                                                                        if (!folders || folders.length === 0) {
                                                                            throw new Error('No folders found in the event data');
                                                                        }

                                                                        // Construct folder paths for the request
                                                                        const folderPaths = folders.map(folder => {
                                                                            // Remove any leading/trailing slashes and ensure proper format
                                                                            const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
                                                                            // Construct the full path as expected by the cloud function
                                                                            return `users/${user.uid}/event_folders/${event.event_name}/${cleanFolder}/thumbnails`.replace(/\/+/g, '/');
                                                                        });

                                                                        // Log request parameters with more details
                                                                        console.log('Request parameters:', {
                                                                            selfie_url: selfieUrl,
                                                                            folder_paths: folderPaths,
                                                                            eventsregistryId: registryId,
                                                                            event_name: event.event_name,
                                                                            folders_count: folders.length,
                                                                            user_id: user.uid
                                                                        });

                                                                        // Create the callable function
                                                                        const matchFacesSequential = httpsCallable(functions, 'matchFacesSequential');

                                                                        // Call the function
                                                                        const result = await matchFacesSequential({
                                                                            selfie_url: selfieUrl,
                                                                            folder_paths: folderPaths,
                                                                            eventsregistryId: registryId
                                                                        });

                                                                        console.log('AI Share result:', result.data);

                                                                        // Update the attendee's document with the match status
                                                                        await updateDoc(doc(db, 'eventsregistry', registryId), {
                                                                            matchStatus: 'processing',
                                                                            lastMatchAttempt: new Date().toISOString()
                                                                        });

                                                                        alert('AI Share process started successfully! Check the matches view for results.');
                                                                    } catch (error) {
                                                                        console.error('Error in AI Share:', error);
                                                                        // Show more detailed error message
                                                                        alert(`Error starting AI Share process: ${error.message}\n\nPlease check the console for more details.`);
                                                                    }
                                                                }}
                                                                className="btn btn-primary btn-sm"
                                                            >
                                                                AI Share
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