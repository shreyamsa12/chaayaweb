import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth, storage, functions } from '../config/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { HiCalendar, HiLocationMarker, HiUsers, HiMail, HiPhone } from 'react-icons/hi';
import { ref, listAll } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import AIShareModal from '../components/AIShareModal';
import '../styles/AIShareModal.css';

const CLOUD_FUNCTION_URL = 'https://us-central1-photoshoto-a7226.cloudfunctions.net';

const Attendees = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user] = useAuthState(auth);
    const [showAIShareModal, setShowAIShareModal] = useState(false);
    const [selectedAttendee, setSelectedAttendee] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);

    useEffect(() => {
        const fetchEventsAndAttendees = async () => {
            if (!user) return;

            try {
                setError(null);
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
                        try {
                            const registryRef = collection(db, 'eventsregistry');
                            const registryQuery = query(registryRef, where('eventId', '==', event.id));
                            const registrySnapshot = await getDocs(registryQuery);

                            const attendees = registrySnapshot.docs.map(doc => {
                                const data = doc.data();
                                console.log('Attendee data:', {
                                    id: doc.id,
                                    name: data.name,
                                    selfieUrl: data.selfieUrl,
                                    rawData: data
                                });
                                return {
                                    id: doc.id,
                                    ...data,
                                    registrationDate: data.timestamp || new Date()
                                };
                            });

                            return {
                                ...event,
                                attendees
                            };
                        } catch (error) {
                            console.error(`Error fetching attendees for event ${event.id}:`, error);
                            return {
                                ...event,
                                attendees: []
                            };
                        }
                    })
                );

                console.log('Events with attendees:', eventsWithAttendees);
                setEvents(eventsWithAttendees);
            } catch (error) {
                console.error('Error fetching events and attendees:', error);
                setError('Failed to load events and attendees. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchEventsAndAttendees();
    }, [user]);

    const handleAIShare = async (attendee, eventId) => {
        if (!attendee?.id || !eventId) {
            setError('Invalid attendee or event data');
            return;
        }

        try {
            setError(null);
            const attendeeRef = doc(db, 'eventsregistry', attendee.id);

            if (!attendee.selfieUrl) {
                setError('No selfie found for this attendee');
                return;
            }

            // Update attendee's document to show processing status
            await updateDoc(attendeeRef, {
                matchStatus: 'processing',
                lastMatchAttempt: new Date().toISOString()
            });

            // Get the collection ID for this event
            const eventRef = doc(db, 'events', eventId);
            const eventDoc = await getDoc(eventRef);

            if (!eventDoc.exists()) {
                throw new Error('Event not found');
            }

            // Check if we need to create a collection ID
            let collectionId = eventDoc.data()?.collectionId;
            if (!collectionId) {
                collectionId = `${eventId}_groupphotos`;
                await updateDoc(eventRef, { collectionId });
            }

            // Call the cloud function to match faces
            const response = await fetch(`${CLOUD_FUNCTION_URL}/matchFacesWithCollection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    selfie_url: attendee.selfieUrl,
                    collectionId: collectionId,
                    similarityThreshold: 80
                })
            });

            if (!response.ok) {
                throw new Error('Failed to match faces');
            }

            const result = await response.json();
            console.log('Match results:', result);

            // Update attendee's document with results
            await updateDoc(attendeeRef, {
                matchStatus: 'completed',
                lastMatchAttempt: new Date().toISOString(),
                aiMatches: result.matches,
                totalMatches: result.matches.length
            });

            return result;
        } catch (error) {
            console.error('Error in handleAIShare:', error);
            setError(error.message || 'Failed to process AI share request');
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center h-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-danger m-3" role="alert">
                {error}
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
                                            {event.date?.toDate ? new Date(event.date.toDate()).toLocaleDateString() : 'Date not available'}
                                        </span>
                                    </div>
                                    <div className="d-flex align-items-center">
                                        <HiLocationMarker className="me-2" />
                                        <span>{event.event_location_name || 'Location not available'}</span>
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
                                                    <tr key={attendee.id || index}>
                                                        <td>
                                                            {attendee.selfieUrl ? (
                                                                <img
                                                                    src={attendee.selfieUrl}
                                                                    alt={`${attendee.name || 'Attendee'}'s selfie`}
                                                                    className="img-thumbnail"
                                                                    style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                                                                    onError={(e) => {
                                                                        console.error('Failed to load image:', {
                                                                            attendeeId: attendee.id,
                                                                            attendeeName: attendee.name,
                                                                            selfieUrl: attendee.selfieUrl,
                                                                            eventId: event.id
                                                                        });
                                                                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIGZpbGw9IiNFNUU1RTUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                                                                    }}
                                                                    onLoad={(e) => {
                                                                        console.log('Successfully loaded image:', {
                                                                            attendeeId: attendee.id,
                                                                            attendeeName: attendee.name,
                                                                            selfieUrl: attendee.selfieUrl,
                                                                            eventId: event.id
                                                                        });
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="img-thumbnail d-flex align-items-center justify-content-center bg-light" style={{ width: '50px', height: '50px' }}>
                                                                    <HiUsers className="text-muted" />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>{attendee.name || 'N/A'}</td>
                                                        <td>{attendee.phone || 'N/A'}</td>
                                                        <td>
                                                            {attendee.registrationDate?.toDate
                                                                ? new Date(attendee.registrationDate.toDate()).toLocaleDateString()
                                                                : 'N/A'}
                                                        </td>
                                                        <td>{attendee.matchStatus || 'Not processed'}</td>
                                                        <td>
                                                            <button
                                                                className="btn btn-primary"
                                                                onClick={() => {
                                                                    setSelectedAttendee(attendee);
                                                                    setSelectedEvent(event.id);
                                                                    setShowAIShareModal(true);
                                                                }}
                                                                disabled={!attendee.selfieUrl}
                                                            >
                                                                Share
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
            {showAIShareModal && selectedAttendee && selectedEvent && (
                <AIShareModal
                    show={showAIShareModal}
                    onClose={() => setShowAIShareModal(false)}
                    onShare={handleAIShare}
                    attendee={selectedAttendee}
                    eventId={selectedEvent}
                />
            )}
        </div>
    );
};

export default Attendees;