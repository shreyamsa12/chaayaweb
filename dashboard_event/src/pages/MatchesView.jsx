import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi';

const MatchesView = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { attendeeId, eventId, attendeeName } = location.state || {};

    useEffect(() => {
        if (!attendeeId) {
            setError('No attendee ID provided');
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, 'eventsregistry', attendeeId), (doc) => {
            try {
                if (doc.exists()) {
                    const data = doc.data();
                    console.log('Raw data from Firestore:', data);

                    if (data.aimatch && Array.isArray(data.aimatch)) {
                        const validMatches = data.aimatch.filter(match =>
                            match.thumbnailUrl &&
                            typeof match.thumbnailUrl === 'string' &&
                            match.thumbnailUrl.startsWith('http')
                        );

                        console.log('Valid matches:', validMatches);
                        setMatches(validMatches);
                    } else {
                        console.log('No aimatch array found or invalid format');
                        setMatches([]);
                    }
                } else {
                    console.log('No document found');
                    setMatches([]);
                }
            } catch (error) {
                console.error('Error processing matches:', error);
                setError('Error processing matches');
                setMatches([]);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error('Error fetching matches:', error);
            setError('Error fetching matches');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [attendeeId]);

    if (loading) {
        return (
            <div className="container py-4">
                <div className="d-flex justify-content-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger">
                    {error}
                </div>
            </div>
        );
    }

    if (!attendeeId || !eventId || !attendeeName) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger">
                    Missing required parameters
                </div>
            </div>
        );
    }

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center">
                    <button
                        className="btn btn-outline-primary me-3"
                        onClick={() => navigate(-1)}
                    >
                        <HiArrowLeft className="me-2" />
                        Back
                    </button>
                    <h2 className="mb-0">
                        {attendeeName}'s Matches
                    </h2>
                </div>
                <div className="badge bg-primary">
                    {matches.length} matches found
                </div>
            </div>

            {matches.length === 0 ? (
                <div className="alert alert-info">
                    No matches found for this attendee.
                </div>
            ) : (
                <div className="row g-4">
                    {matches.map((match, index) => (
                        <div key={index} className="col-md-4 col-sm-6">
                            <div className="card h-100">
                                <img
                                    src={match.thumbnailUrl}
                                    alt={`Match ${index + 1}`}
                                    className="card-img-top"
                                    style={{ height: '200px', objectFit: 'cover' }}
                                    onError={(e) => {
                                        console.error('Error loading image:', match.thumbnailUrl);
                                        e.target.src = 'https://via.placeholder.com/300x200?text=Image+Not+Found';
                                    }}
                                />
                                <div className="card-body">
                                    <h5 className="card-title">Match {index + 1}</h5>
                                    <div className="d-flex justify-content-between">
                                        <div>
                                            <small className="text-muted">Similarity:</small>
                                            <div className="fw-bold">
                                                {match.similarity ? `${(match.similarity * 100).toFixed(1)}%` : 'N/A'}
                                            </div>
                                        </div>
                                        <div>
                                            <small className="text-muted">Confidence:</small>
                                            <div className="fw-bold">
                                                {match.confidence ? `${(match.confidence * 100).toFixed(1)}%` : 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MatchesView; 