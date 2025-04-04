import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link } from 'react-router-dom';
import { HiPlus, HiLocationMarker, HiPencil, HiTrash } from 'react-icons/hi';
import DatePicker from 'react-datepicker';
import { Autocomplete, GoogleMap, Marker } from '@react-google-maps/api';
import "react-datepicker/dist/react-datepicker.css";
import { GOOGLE_MAPS_API_KEY } from '../config/maps';
import { db, auth, storage } from '../config/firebase';
import { collection, addDoc, updateDoc, doc, GeoPoint, Timestamp, getDocs, query, where, orderBy, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GoogleMapsContext } from '../contexts/GoogleMapsContext';

const mapContainerStyle = {
    width: '100%',
    height: '300px',
    borderRadius: '8px'
};

export default function Events() {
    const { isLoaded } = useContext(GoogleMapsContext);
    const [showModal, setShowModal] = useState(false);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [autocomplete, setAutocomplete] = useState(null);
    const inputRef = useRef(null);
    const [formData, setFormData] = useState({
        event_name: '',
        event_type: '',
        event_location_name: '',
        event_location: null, // Will be converted to GeoPoint
        date: new Date(),
        start_time: new Date(),
        end_time: new Date(),
        live_stream_enabled: false,
        has_QR_code: false,
        live_session_url: '',
        event_host: auth.currentUser?.uid || '', // Get current user's ID
        folders: [], // Add this new field
        coverImage: '',
        avatar: '',
        logo: '',
        introVideo: '',
        event_description: '',
    });
    const [error, setError] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingEventId, setEditingEventId] = useState(null);
    const [formErrors, setFormErrors] = useState({});
    const [isViewing, setIsViewing] = useState(false);
    const [currentEventId, setCurrentEventId] = useState(null);
    const [uploading, setUploading] = useState({
        coverImage: false,
        avatar: false,
        logo: false,
        introVideo: false,
    });

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        // Clear the error for this field
        setFormErrors(prev => ({
            ...prev,
            [name]: null
        }));
    };

    const resetForm = () => {
        setFormData({
            event_name: '',
            event_type: '',
            event_location_name: '',
            event_location: null,
            date: new Date(),
            start_time: new Date(),
            end_time: new Date(),
            live_stream_enabled: false,
            has_QR_code: false,
            live_session_url: '',
            event_host: auth.currentUser?.uid || '',
            folders: [],
            coverImage: '',
            avatar: '',
            logo: '',
            introVideo: '',
            event_description: '',
        });
        setAutocomplete(null);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setIsEditing(false);
        setIsViewing(false);
        setEditingEventId(null);
        setCurrentEventId(null);
        resetForm();
        setFormErrors({});
        setAutocomplete(null);
    };

    const handleOpenModal = () => {
        setShowModal(true);
        setDefaultTimes();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        try {
            const eventData = {
                event_name: formData.event_name,
                event_type: formData.event_type || 'normal',
                event_location_name: formData.event_location_name,
                event_location: new GeoPoint(
                    formData.event_location.lat,
                    formData.event_location.lng
                ),
                date: Timestamp.fromDate(formData.date),
                start_time: Timestamp.fromDate(formData.start_time),
                end_time: Timestamp.fromDate(formData.end_time),
                live_stream_enabled: formData.live_stream_enabled,
                has_QR_code: formData.has_QR_code,
                live_session_url: formData.live_session_url,
                event_host: auth.currentUser?.uid || '',
                folders: formData.folders.filter(folder => folder.trim() !== ''),
                event_description: formData.event_description,
            };

            if (isEditing && editingEventId) {
                await updateDoc(doc(db, 'events', editingEventId), eventData);
            } else {
                await addDoc(collection(db, 'events'), eventData);
            }

            handleCloseModal();
            await fetchEvents();
        } catch (error) {
            console.error('Error saving event: ', error);
            setError('Failed to save event: ' + error.message);
        }
    };

    const setDefaultTimes = () => {
        const start = new Date();
        start.setHours(9, 0, 0); // 9:00 AM

        const end = new Date();
        end.setHours(17, 0, 0); // 5:00 PM

        setFormData(prev => ({
            ...prev,
            start_time: start,
            end_time: end
        }));
    };

    const handlePlaceSelect = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace();
            setFormData(prev => ({
                ...prev,
                event_location_name: place.formatted_address,
                event_location: {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                }
            }));
        }
    };

    const onLoad = (autocomplete) => {
        setAutocomplete(autocomplete);
    };

    const fetchEvents = async () => {
        try {
            setIsLoadingEvents(true);
            setError(null);

            if (!auth.currentUser) {
                setError('User not authenticated');
                setIsLoadingEvents(false);
                return;
            }

            const eventsRef = collection(db, 'events');
            const q = query(
                eventsRef,
                where('event_host', '==', auth.currentUser.uid),
                orderBy('date', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const eventsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('Fetched events:', eventsData);
            setEvents(eventsData);
            setIsLoadingEvents(false);
        } catch (error) {
            console.error('Error fetching events:', error);
            setError('Failed to fetch events');
            setIsLoadingEvents(false);
        }
    };

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setIsLoadingEvents(true);
                setError(null);

                if (!auth.currentUser) {
                    setError('User not authenticated');
                    setIsLoadingEvents(false);
                    return;
                }

                const eventsRef = collection(db, 'events');
                const q = query(
                    eventsRef,
                    where('event_host', '==', auth.currentUser.uid),
                    orderBy('date', 'desc')
                );

                const querySnapshot = await getDocs(q);
                const eventsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('Fetched events:', eventsData);
                setEvents(eventsData);
                setIsLoadingEvents(false);
            } catch (error) {
                console.error('Error fetching events:', error);
                setError('Failed to fetch events');
                setIsLoadingEvents(false);
            }
        };

        // Only fetch if user is authenticated
        if (auth.currentUser) {
            fetchEvents();
        }

        // Listen for auth state changes
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchEvents();
            } else {
                setEvents([]);
                setIsLoadingEvents(false);
            }
        });

        return () => unsubscribe();
    }, [auth.currentUser?.uid]); // Add auth.currentUser?.uid as dependency

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return format(date, 'dd/MM/yyyy');
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return format(date, 'hh:mm a');
    };

    useEffect(() => {
        if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
            setError('Please configure your Google Maps API key');
        }
    }, []);

    useEffect(() => {
        // Initialize autocomplete when modal is shown and script is loaded
        if (showModal && isLoaded && inputRef.current && !autocomplete) {
            try {
                const options = {
                    componentRestrictions: { country: "in" },
                    types: ['geocode', 'establishment']
                };
                const newAutocomplete = new window.google.maps.places.Autocomplete(
                    inputRef.current,
                    options
                );
                newAutocomplete.addListener('place_changed', () => {
                    const place = newAutocomplete.getPlace();
                    if (place.geometry) {
                        setFormData(prev => ({
                            ...prev,
                            event_location_name: place.formatted_address,
                            event_location: {
                                lat: place.geometry.location.lat(),
                                lng: place.geometry.location.lng()
                            }
                        }));
                    }
                });
                setAutocomplete(newAutocomplete);
            } catch (error) {
                console.error('Error initializing autocomplete:', error);
            }
        }
    }, [showModal, isLoaded]);

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (autocomplete) {
                // Cleanup autocomplete
                setAutocomplete(null);
            }
        };
    }, []);

    const handleEditEvent = (event) => {
        const eventLocation = {
            lat: event.event_location.latitude,
            lng: event.event_location.longitude
        };

        setIsViewing(false);
        setIsEditing(true);
        setEditingEventId(event.id);
        setFormData({
            event_name: event.event_name,
            event_type: event.event_type || 'normal',
            event_location_name: event.event_location_name,
            event_location: eventLocation,
            date: event.date.toDate(),
            start_time: event.start_time.toDate(),
            end_time: event.end_time.toDate(),
            live_stream_enabled: event.live_stream_enabled || false,
            has_QR_code: event.has_QR_code || false,
            live_session_url: event.live_session_url || '',
            event_host: event.event_host,
            folders: event.folders || [],
            coverImage: event.coverImage || '',
            avatar: event.avatar || '',
            logo: event.logo || '',
            introVideo: event.introVideo || '',
            event_description: event.event_description || '',
        });
        setShowModal(true);
    };

    const handleViewEvent = (event) => {
        try {
            // Safely convert Firestore timestamps to Date objects
            const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
            const startTime = event.start_time?.toDate ? event.start_time.toDate() : new Date(event.start_time);
            const endTime = event.end_time?.toDate ? event.end_time.toDate() : new Date(event.end_time);

            const eventLocation = {
                lat: event.event_location.latitude,
                lng: event.event_location.longitude
            };

            setIsViewing(true);
            setCurrentEventId(event.id);
            setFormData({
                ...event,
                date: eventDate,
                start_time: startTime,
                end_time: endTime,
                event_location: eventLocation
            });
            setShowModal(true);

            console.log('Event data being set:', {
                date: eventDate,
                start_time: startTime,
                end_time: endTime
            });
        } catch (error) {
            console.error('Error in handleViewEvent:', error);
            // Handle the error appropriately
        }
    };

    const validateForm = () => {
        const errors = {};

        // Only check if event name and location are provided
        if (!formData.event_name.trim()) {
            errors.event_name = 'Event name is required';
        }

        if (!formData.event_location_name || !formData.event_location) {
            errors.event_location = 'Location is required';
        }

        // Debug log
        console.log('Form validation:', {
            formData,
            errors,
            hasErrors: Object.keys(errors).length > 0
        });

        setFormErrors(errors);
        return errors;
    };

    const handleAddFolder = () => {
        setFormData(prev => ({
            ...prev,
            folders: [...prev.folders, '']
        }));
    };

    const handleFolderChange = (index, value) => {
        // Only allow alphanumeric characters
        const alphanumericValue = value.replace(/[^a-zA-Z0-9]/g, '');

        setFormData(prev => {
            const newFolders = [...prev.folders];
            newFolders[index] = alphanumericValue;
            return {
                ...prev,
                folders: newFolders
            };
        });
    };

    const handleRemoveFolder = (index) => {
        setFormData(prev => ({
            ...prev,
            folders: prev.folders.filter((_, i) => i !== index)
        }));
    };

    const handleDownloadQR = () => {
        // Get the SVG element
        const svg = document.querySelector('.qr-code svg');
        if (!svg) return;

        // Create a canvas element
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size (make it larger for better quality)
        canvas.width = 1000;
        canvas.height = 1000;

        // Create an image from the SVG
        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();

        img.onload = () => {
            // Fill white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Create download link
            const link = document.createElement('a');
            link.download = `event-qr-${currentEventId}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    const handleFileUpload = async (file, type) => {
        if (!file || !auth.currentUser) return;

        try {
            setUploading(prev => ({ ...prev, [type]: true }));

            const fileRef = storageRef(storage, `users/${auth.currentUser.uid}/event_media/${type}/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(fileRef);

            setFormData(prev => ({
                ...prev,
                [type]: downloadURL
            }));

            setUploading(prev => ({ ...prev, [type]: false }));
        } catch (error) {
            console.error(`Error uploading ${type}:`, error);
            setError(`Failed to upload ${type}`);
            setUploading(prev => ({ ...prev, [type]: false }));
        }
    };

    if (error) {
        return (
            <div className="container-fluid">
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
                <div className="table-responsive">
                    {/* Show table even if maps API fails */}
                    <table className="table table-striped">
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Date</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Sample data */}
                            <tr>
                                <td>Summer Music Festival</td>
                                <td>2024-06-15</td>
                                <td>Central Park</td>
                                <td><span className="badge bg-success">Active</span></td>
                                <td>
                                    <button className="btn btn-sm btn-primary me-2">Edit</button>
                                    <button className="btn btn-sm btn-danger">Delete</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Events Management</h2>
                <button
                    className="btn btn-primary d-flex align-items-center"
                    onClick={handleOpenModal}
                >
                    <HiPlus className="me-2" />
                    Create New Event
                </button>
            </div>

            {error ? (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            ) : isLoadingEvents ? (
                <div className="card">
                    <div className="card-body text-center py-5">
                        <div className="spinner-border text-primary mb-3" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted mb-0">Loading events...</p>
                    </div>
                </div>
            ) : events.length === 0 ? (
                <div className="card">
                    <div className="card-body text-center py-5">
                        <p className="text-muted mb-0">No events found. Create your first event!</p>
                    </div>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="table table-striped">
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Type</th>
                                <th>Location</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Status</th>
                                <th>Folders</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => (
                                <tr
                                    key={event.id}
                                    onClick={() => handleViewEvent(event)}
                                    style={{ cursor: 'pointer' }}
                                    className="hover-highlight"
                                >
                                    <td>{event.event_name}</td>
                                    <td>
                                        <span className={`badge ${event.event_type === 'smart' ? 'bg-primary' : 'bg-secondary'}`}>
                                            {event.event_type}
                                        </span>
                                    </td>
                                    <td>{event.event_location_name}</td>
                                    <td>{formatDate(event.date)}</td>
                                    <td>
                                        {formatTime(event.start_time)} - {formatTime(event.end_time)}
                                    </td>
                                    <td>
                                        {new Date() < event.date.toDate() ? (
                                            <span className="badge bg-success">Upcoming</span>
                                        ) : (
                                            <span className="badge bg-secondary">Past</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="d-flex flex-wrap gap-1">
                                            {event.folders && event.folders.map((folder, idx) => (
                                                <span key={idx} className="badge bg-secondary">
                                                    {folder}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="actions-cell">
                                        <div className="d-flex">
                                            <button
                                                className="btn btn-icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditEvent(event);
                                                }}
                                            >
                                                <HiPencil />
                                            </button>
                                            <button
                                                className="btn btn-icon text-danger ms-3"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteEvent(event.id);
                                                }}
                                            >
                                                <HiTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <>
                    <div className="modal fade show" style={{ display: 'block' }}>
                        <div className="modal-dialog modal-lg">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">
                                        {isEditing ? 'Edit Event' : isViewing ? 'Event Details' : 'Create New Event'}
                                    </h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={handleCloseModal}
                                    ></button>
                                </div>
                                <div className="modal-body">
                                    {isViewing ? (
                                        <div className="event-details">
                                            <div className="text-center mb-4 p-3 border rounded">
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                    <h6 className="text-muted mb-0">Event QR Code</h6>
                                                    <button
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={() => {
                                                            const currentEvent = events.find(e => e.id === currentEventId);
                                                            if (currentEvent) {
                                                                handleEditEvent(currentEvent);
                                                            }
                                                        }}
                                                    >
                                                        <HiPencil className="me-1" /> Edit Event
                                                    </button>
                                                </div>
                                                <div className="d-flex flex-column align-items-center mb-3">
                                                    <div className="qr-code mb-3">
                                                        <QRCodeSVG
                                                            value={`https://chaaya.ai/event/${currentEventId}`}
                                                            size={200}
                                                            level="H"
                                                            includeMargin={true}
                                                            bgColor={getComputedStyle(document.documentElement)
                                                                .getPropertyValue('--bg-primary')
                                                                .trim()}
                                                            fgColor={getComputedStyle(document.documentElement)
                                                                .getPropertyValue('--text-primary')
                                                                .trim()}
                                                        />
                                                    </div>
                                                    <button
                                                        className="btn btn-outline-primary"
                                                        onClick={handleDownloadQR}
                                                    >
                                                        Download QR Code
                                                    </button>
                                                </div>
                                                <small className="text-muted">
                                                    Scan to access event page: {`https://chaaya.ai/event/${currentEventId}`}
                                                </small>
                                            </div>

                                            <div className="row mb-4">
                                                <div className="col-md-6">
                                                    <h6 className="text-muted">Event Name</h6>
                                                    <p className="lead">{formData.event_name}</p>
                                                </div>
                                                <div className="col-md-6">
                                                    <h6 className="text-muted">Event Type</h6>
                                                    <p>
                                                        <span className={`badge ${formData.event_type === 'smart' ? 'bg-primary' : 'bg-secondary'}`}>
                                                            {formData.event_type}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <h6 className="text-muted">Description</h6>
                                                <p>{formData.event_description}</p>
                                            </div>

                                            <div className="mb-4">
                                                <h6 className="text-muted">Location</h6>
                                                <p>{formData.event_location_name}</p>
                                                <div className="mt-3">
                                                    <GoogleMap
                                                        mapContainerStyle={mapContainerStyle}
                                                        center={formData.event_location}
                                                        zoom={15}
                                                        options={{
                                                            zoomControl: true,
                                                            streetViewControl: false,
                                                            mapTypeControl: false,
                                                            fullscreenControl: true,
                                                        }}
                                                    >
                                                        <Marker
                                                            position={formData.event_location}
                                                            title={formData.event_location_name}
                                                        />
                                                    </GoogleMap>
                                                </div>
                                            </div>

                                            <div className="row mb-4">
                                                <div className="col-md-4">
                                                    <h6 className="text-muted">Date</h6>
                                                    <p>{formData.date ? new Date(formData.date).toLocaleDateString() : 'N/A'}</p>
                                                </div>
                                                <div className="col-md-4">
                                                    <h6 className="text-muted">Time</h6>
                                                    <p>
                                                        {formData.start_time ? new Date(formData.start_time).toLocaleTimeString() : 'N/A'} -
                                                        {formData.end_time ? new Date(formData.end_time).toLocaleTimeString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>

                                            {formData.live_stream_enabled && (
                                                <div className="mb-4">
                                                    <h6 className="text-muted">Live Stream URL</h6>
                                                    <p>
                                                        <a href={formData.live_session_url} target="_blank" rel="noopener noreferrer">
                                                            {formData.live_session_url}
                                                        </a>
                                                    </p>
                                                </div>
                                            )}

                                            <div className="mb-4">
                                                <h6 className="text-muted">Additional Features</h6>
                                                <div className="mt-2">
                                                    {formData.live_stream_enabled && (
                                                        <span className="badge bg-success me-2">Live Stream Enabled</span>
                                                    )}
                                                    {formData.has_QR_code && (
                                                        <span className="badge bg-info me-2">QR Code Available</span>
                                                    )}
                                                </div>
                                            </div>

                                            {formData.folders && formData.folders.length > 0 && (
                                                <div className="mb-4">
                                                    <h6 className="text-muted">Folders</h6>
                                                    <div className="d-flex flex-wrap gap-2">
                                                        {formData.folders.map((folder, index) => (
                                                            <div key={index} className="badge bg-secondary">
                                                                {folder}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmit}>
                                            <div className="mb-3">
                                                <label className="form-label">Event Name*</label>
                                                <input
                                                    type="text"
                                                    className={`form-control ${formErrors.event_name ? 'is-invalid' : ''}`}
                                                    name="event_name"
                                                    value={formData.event_name}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                                {formErrors.event_name && (
                                                    <div className="invalid-feedback">{formErrors.event_name}</div>
                                                )}
                                            </div>

                                            <div className="mb-3">
                                                <label htmlFor="event_description" className="form-label">Event Description</label>
                                                <textarea
                                                    id="event_description"
                                                    className="form-control"
                                                    name="event_description"
                                                    value={formData.event_description || ''}
                                                    onChange={handleInputChange}
                                                    maxLength={100}
                                                    rows={3}
                                                    placeholder="Enter event description (max 100 characters)"
                                                />
                                                <small className="text-muted">
                                                    {`${formData.event_description?.length || 0}/100 characters`}
                                                </small>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label d-block">Event Type</label>
                                                <div className="form-check form-switch">
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        name="event_type"
                                                        id="event_type"
                                                        checked={formData.event_type === 'smart'}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            event_type: e.target.checked ? 'smart' : 'normal'
                                                        }))}
                                                    />
                                                    <label className="form-check-label" htmlFor="event_type">
                                                        Smart Event {formData.event_type === 'smart' ? '(Enabled)' : '(Disabled)'}
                                                    </label>
                                                    <small className="form-text text-muted d-block">
                                                        {formData.event_type === 'smart' ?
                                                            'Smart event with advanced features' :
                                                            'Normal event with basic features'}
                                                    </small>
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Location*</label>
                                                <div className="input-group">
                                                    <input
                                                        ref={inputRef}
                                                        type="text"
                                                        className={`form-control ${formErrors.event_location ? 'is-invalid' : ''}`}
                                                        placeholder="Search for a location"
                                                        value={formData.event_location_name}
                                                        onChange={(e) => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                event_location_name: e.target.value
                                                            }));
                                                            setFormErrors(prev => ({
                                                                ...prev,
                                                                event_location: null // Clear location error
                                                            }));
                                                        }}
                                                        required
                                                    />
                                                    <button
                                                        className="btn btn-outline-secondary"
                                                        type="button"
                                                        onClick={() => {
                                                            if (navigator.geolocation) {
                                                                navigator.geolocation.getCurrentPosition((position) => {
                                                                    const { latitude, longitude } = position.coords;
                                                                    const geocoder = new window.google.maps.Geocoder();
                                                                    geocoder.geocode(
                                                                        { location: { lat: latitude, lng: longitude } },
                                                                        (results, status) => {
                                                                            if (status === 'OK' && results[0]) {
                                                                                setFormData(prev => ({
                                                                                    ...prev,
                                                                                    event_location_name: results[0].formatted_address,
                                                                                    event_location: {
                                                                                        lat: latitude,
                                                                                        lng: longitude
                                                                                    }
                                                                                }));
                                                                            }
                                                                        }
                                                                    );
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <HiLocationMarker />
                                                    </button>
                                                </div>
                                                {formErrors.event_location && (
                                                    <div className="invalid-feedback d-block">{formErrors.event_location}</div>
                                                )}
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Event Date*</label>
                                                <DatePicker
                                                    selected={formData.date}
                                                    onChange={(date) => {
                                                        setFormData(prev => ({ ...prev, date }));
                                                        setFormErrors(prev => ({ ...prev, date: null }));
                                                    }}
                                                    dateFormat="dd/MM/yyyy"
                                                    className={`form-control ${formErrors.date ? 'is-invalid' : ''}`}
                                                    minDate={new Date()}
                                                    required
                                                />
                                                {formErrors.date && (
                                                    <div className="invalid-feedback d-block">{formErrors.date}</div>
                                                )}
                                            </div>

                                            <div className="row mb-3">
                                                <div className="col">
                                                    <label className="form-label">Start Time*</label>
                                                    <DatePicker
                                                        selected={formData.start_time}
                                                        onChange={(date) => {
                                                            setFormData(prev => ({ ...prev, start_time: date }));
                                                            setFormErrors(prev => ({ ...prev, start_time: null }));
                                                        }}
                                                        showTimeSelect
                                                        showTimeSelectOnly
                                                        timeIntervals={15}
                                                        timeCaption="Time"
                                                        dateFormat="h:mm aa"
                                                        className={`form-control ${formErrors.start_time ? 'is-invalid' : ''}`}
                                                        required
                                                    />
                                                    {formErrors.start_time && (
                                                        <div className="invalid-feedback d-block">{formErrors.start_time}</div>
                                                    )}
                                                </div>
                                                <div className="col">
                                                    <label className="form-label">End Time*</label>
                                                    <DatePicker
                                                        selected={formData.end_time}
                                                        onChange={(date) => {
                                                            setFormData(prev => ({ ...prev, end_time: date }));
                                                            setFormErrors(prev => ({ ...prev, end_time: null }));
                                                        }}
                                                        showTimeSelect
                                                        showTimeSelectOnly
                                                        timeIntervals={15}
                                                        timeCaption="Time"
                                                        dateFormat="h:mm aa"
                                                        className={`form-control ${formErrors.end_time ? 'is-invalid' : ''}`}
                                                        required
                                                    />
                                                    {formErrors.end_time && (
                                                        <div className="invalid-feedback d-block">{formErrors.end_time}</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <div className="form-check form-switch">
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        name="live_stream_enabled"
                                                        checked={formData.live_stream_enabled}
                                                        onChange={handleInputChange}
                                                        id="live_stream_enabled"
                                                    />
                                                    <label className="form-check-label" htmlFor="live_stream_enabled">
                                                        Enable Live Stream
                                                    </label>
                                                </div>
                                            </div>

                                            {formData.live_stream_enabled && (
                                                <div className="mb-3">
                                                    <label className="form-label">Live Session URL</label>
                                                    <input
                                                        type="url"
                                                        className="form-control"
                                                        name="live_session_url"
                                                        value={formData.live_session_url}
                                                        onChange={handleInputChange}
                                                        placeholder="Enter live session URL"
                                                    />
                                                </div>
                                            )}

                                            <div className="mb-3">
                                                <div className="form-check form-switch">
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        name="has_QR_code"
                                                        checked={formData.has_QR_code}
                                                        onChange={handleInputChange}
                                                        id="has_QR_code"
                                                    />
                                                    <label className="form-check-label" htmlFor="has_QR_code">
                                                        Generate QR Code
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label d-flex justify-content-between align-items-center">
                                                    Folders
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={handleAddFolder}
                                                    >
                                                        <HiPlus /> Add Folder
                                                    </button>
                                                </label>
                                                {formData.folders.map((folder, index) => (
                                                    <div key={index} className="input-group mb-2">
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            value={folder}
                                                            onChange={(e) => handleFolderChange(index, e.target.value)}
                                                            placeholder="Enter folder name (alphanumeric)"
                                                            pattern="[a-zA-Z0-9]+"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleRemoveFolder(index)}
                                                        >
                                                            <HiTrash />
                                                        </button>
                                                    </div>
                                                ))}
                                                {formData.folders.length > 0 && (
                                                    <small className="text-muted">
                                                        Only alphanumeric characters are allowed (a-z, A-Z, 0-9)
                                                    </small>
                                                )}
                                            </div>

                                            <div className="card mb-4">
                                                <div className="card-header">
                                                    <h6 className="mb-0">Media Kit</h6>
                                                </div>
                                                <div className="card-body">
                                                    <div className="row g-3">
                                                        {/* Cover Image */}
                                                        <div className="col-md-6">
                                                            <label className="form-label">Cover Image</label>
                                                            <div className="d-flex gap-2 align-items-center">
                                                                {formData.coverImage && (
                                                                    <img
                                                                        src={formData.coverImage}
                                                                        alt="Cover"
                                                                        className="img-thumbnail"
                                                                        style={{ width: '100px', height: '60px', objectFit: 'cover' }}
                                                                    />
                                                                )}
                                                                <div className="flex-grow-1">
                                                                    <input
                                                                        type="file"
                                                                        className="form-control"
                                                                        accept="image/*"
                                                                        onChange={(e) => handleFileUpload(e.target.files[0], 'coverImage')}
                                                                        disabled={uploading.coverImage}
                                                                    />
                                                                    {uploading.coverImage && (
                                                                        <div className="spinner-border spinner-border-sm text-primary mt-2" role="status">
                                                                            <span className="visually-hidden">Uploading...</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Avatar */}
                                                        <div className="col-md-6">
                                                            <label className="form-label">Avatar</label>
                                                            <div className="d-flex gap-2 align-items-center">
                                                                {formData.avatar && (
                                                                    <img
                                                                        src={formData.avatar}
                                                                        alt="Avatar"
                                                                        className="img-thumbnail rounded-circle"
                                                                        style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                                                                    />
                                                                )}
                                                                <div className="flex-grow-1">
                                                                    <input
                                                                        type="file"
                                                                        className="form-control"
                                                                        accept="image/*"
                                                                        onChange={(e) => handleFileUpload(e.target.files[0], 'avatar')}
                                                                        disabled={uploading.avatar}
                                                                    />
                                                                    {uploading.avatar && (
                                                                        <div className="spinner-border spinner-border-sm text-primary mt-2" role="status">
                                                                            <span className="visually-hidden">Uploading...</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Logo */}
                                                        <div className="col-md-6">
                                                            <label className="form-label">Logo</label>
                                                            <div className="d-flex gap-2 align-items-center">
                                                                {formData.logo && (
                                                                    <img
                                                                        src={formData.logo}
                                                                        alt="Logo"
                                                                        className="img-thumbnail"
                                                                        style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                                                                    />
                                                                )}
                                                                <div className="flex-grow-1">
                                                                    <input
                                                                        type="file"
                                                                        className="form-control"
                                                                        accept="image/*"
                                                                        onChange={(e) => handleFileUpload(e.target.files[0], 'logo')}
                                                                        disabled={uploading.logo}
                                                                    />
                                                                    {uploading.logo && (
                                                                        <div className="spinner-border spinner-border-sm text-primary mt-2" role="status">
                                                                            <span className="visually-hidden">Uploading...</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Intro Video */}
                                                        <div className="col-md-6">
                                                            <label className="form-label">Intro Video</label>
                                                            <div className="d-flex gap-2 align-items-center">
                                                                {formData.introVideo && (
                                                                    <video
                                                                        src={formData.introVideo}
                                                                        className="img-thumbnail"
                                                                        style={{ width: '100px', height: '60px', objectFit: 'cover' }}
                                                                    />
                                                                )}
                                                                <div className="flex-grow-1">
                                                                    <input
                                                                        type="file"
                                                                        className="form-control"
                                                                        accept="video/mp4,video/webm,video/ogg"
                                                                        onChange={(e) => handleFileUpload(e.target.files[0], 'introVideo')}
                                                                        disabled={uploading.introVideo}
                                                                    />
                                                                    {uploading.introVideo && (
                                                                        <div className="spinner-border spinner-border-sm text-primary mt-2" role="status">
                                                                            <span className="visually-hidden">Uploading...</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="modal-footer">
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={handleCloseModal}
                                                >
                                                    Close
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="btn btn-primary"
                                                    disabled={Object.values(uploading).some(value => value)}
                                                >
                                                    {isEditing ? 'Update Event' : 'Create Event'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop fade show"></div>
                </>
            )}
        </div>
    );
} 