import React, { useState, useEffect } from 'react';
import { HiX, HiCheck, HiClock, HiPhotograph } from 'react-icons/hi';

const AIShareModal = ({ show, onClose, attendee, eventId, onShare }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [matches, setMatches] = useState([]);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const steps = [
        { id: 1, title: 'Processing Selfie', description: 'Analyzing your selfie for face detection' },
        { id: 2, title: 'Finding Matches', description: 'Searching through event photos for matches' },
        { id: 3, title: 'Preparing Results', description: 'Organizing matching photos for you' }
    ];

    useEffect(() => {
        if (show && attendee) {
            handleAIShare();
        }
    }, [show, attendee]);

    const handleAIShare = async () => {
        setIsProcessing(true);
        setError(null);
        setCurrentStep(0);

        try {
            // Simulate step 1
            await new Promise(resolve => setTimeout(resolve, 1500));
            setCurrentStep(1);

            // Simulate step 2
            await new Promise(resolve => setTimeout(resolve, 2000));
            setCurrentStep(2);

            // Call the actual share function
            const results = await onShare(attendee, eventId);
            console.log('Match results:', results); // Debug log

            // Transform matches to include imageUrl
            const processedMatches = results.matches.map(match => {
                console.log('Processing match:', match); // Debug individual match
                // Construct the Firebase Storage URL from the filePath
                const imageUrl = `https://firebasestorage.googleapis.com/v0/b/photoshoto-a7226.appspot.com/o/${encodeURIComponent(match.filePath)}?alt=media`;
                console.log('Constructed image URL:', imageUrl); // Debug URL construction
                return {
                    ...match,
                    imageUrl,
                    similarity: match.similarity || 0
                };
            });

            console.log('Processed matches:', processedMatches); // Debug processed matches
            setMatches(processedMatches);
            setCurrentStep(3);
        } catch (error) {
            console.error('Error in handleAIShare:', error);
            setError(error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!show) return null;

    return (
        <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered modal-lg">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">AI Photo Share</h5>
                            <button type="button" className="btn-close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {/* Timeline Progress */}
                            <div className="timeline-progress mb-4">
                                {steps.map((step, index) => (
                                    <div key={step.id} className="timeline-step">
                                        <div className={`timeline-icon ${index <= currentStep ? 'active' : ''}`}>
                                            {index < currentStep ? (
                                                <HiCheck className="text-white" />
                                            ) : index === currentStep ? (
                                                <HiClock className="text-white" />
                                            ) : (
                                                <span className="step-number">{step.id}</span>
                                            )}
                                        </div>
                                        <div className="timeline-content">
                                            <h6 className="mb-1">{step.title}</h6>
                                            <p className="text-muted mb-0">{step.description}</p>
                                        </div>
                                        {index < steps.length - 1 && (
                                            <div className={`timeline-line ${index < currentStep ? 'active' : ''}`}></div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="alert alert-danger" role="alert">
                                    {error}
                                </div>
                            )}

                            {/* Results Section */}
                            {currentStep === 3 && matches.length > 0 && (
                                <div className="matches-section">
                                    <h6 className="mb-3">Found {matches.length} matching photos</h6>
                                    <div className="row g-3">
                                        {matches.map((match, index) => {
                                            console.log('Rendering match:', match); // Debug rendering
                                            return (
                                                <div key={index} className="col-md-4">
                                                    <div className="card h-100">
                                                        <img
                                                            src={match.imageUrl}
                                                            className="card-img-top"
                                                            alt={`Match ${index + 1}`}
                                                            style={{ height: '200px', objectFit: 'cover' }}
                                                            onError={(e) => {
                                                                console.error('Image failed to load:', match.imageUrl);
                                                                e.target.src = 'https://via.placeholder.com/300x200?text=Image+Not+Found';
                                                            }}
                                                        />
                                                        <div className="card-body">
                                                            <p className="card-text">
                                                                <small className="text-muted">
                                                                    Similarity: {Math.round(match.similarity)}%
                                                                </small>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && matches.length === 0 && !error && (
                                <div className="text-center py-4">
                                    <HiPhotograph className="display-4 text-muted mb-3" />
                                    <h5>No matching photos found</h5>
                                    <p className="text-muted">
                                        Try adjusting the similarity threshold or ensure the selfie is clear and well-lit.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={onClose}
                                disabled={isProcessing}
                            >
                                Close
                            </button>
                            {currentStep === 3 && matches.length > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        // Handle share action
                                        onClose();
                                    }}
                                >
                                    Share Photos
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AIShareModal; 