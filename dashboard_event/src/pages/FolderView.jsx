import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, getDoc, doc } from 'firebase/firestore';
import { db, storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { HiFolder, HiUpload, HiPhotograph, HiVideoCamera, HiX, HiChevronLeft, HiChevronRight, HiZoomIn, HiZoomOut } from 'react-icons/hi';
import imageCompression from 'browser-image-compression';

export default function FolderView() {
    const { eventId, folderName } = useParams();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState([]);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showViewerModal, setShowViewerModal] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [thumbnails, setThumbnails] = useState({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [selectMode, setSelectMode] = useState(false);
    const [loadingMedia, setLoadingMedia] = useState(true);

    const thumbnailOptions = {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 400,
        useWebWorker: true
    };

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                setLoading(true);
                const eventDoc = await getDoc(doc(db, 'events', eventId));
                if (eventDoc.exists()) {
                    setEvent({ id: eventDoc.id, ...eventDoc.data() });
                }
            } catch (error) {
                console.error('Error fetching event:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvent();
    }, [eventId]);

    useEffect(() => {
        const fetchExistingFiles = async () => {
            if (!event || !event.event_host) return;

            setLoadingMedia(true);
            try {
                const basePath = `users/${event.event_host}/event_folders/${event.event_name}/${folderName}`;

                // Fetch photos, videos, and thumbnails
                const photosRef = ref(storage, `${basePath}/photos`);
                const videosRef = ref(storage, `${basePath}/videos`);
                const thumbnailsRef = ref(storage, `${basePath}/thumbnails`);

                const [photosResult, videosResult, thumbnailsResult] = await Promise.all([
                    listAll(photosRef).catch(() => ({ items: [] })),
                    listAll(videosRef).catch(() => ({ items: [] })),
                    listAll(thumbnailsRef).catch(() => ({ items: [] }))
                ]);

                // Create thumbnails map
                const thumbnailsMap = {};
                for (const thumbnailRef of thumbnailsResult.items) {
                    const thumbnailUrl = await getDownloadURL(thumbnailRef);
                    thumbnailsMap[thumbnailRef.name] = thumbnailUrl;
                }

                const fetchFileDetails = async (fileRef, type) => {
                    try {
                        const url = await getDownloadURL(fileRef);
                        return {
                            name: fileRef.name,
                            url: url,
                            type: type,
                            path: fileRef.fullPath,
                            thumbnailUrl: type === 'photos' ? thumbnailsMap[fileRef.name] || url : null,
                            uploadedAt: parseInt(fileRef.name.split('_')[0])
                        };
                    } catch (error) {
                        console.error(`Error fetching file details for ${fileRef.name}:`, error);
                        return null;
                    }
                };

                const photoFiles = await Promise.all(
                    photosResult.items.map(ref => fetchFileDetails(ref, 'photos'))
                );

                const videoFiles = await Promise.all(
                    videosResult.items.map(ref => fetchFileDetails(ref, 'videos'))
                );

                // Combine and sort files by uploadedAt timestamp
                const allFiles = [...photoFiles, ...videoFiles]
                    .filter(file => file !== null)
                    .sort((a, b) => b.uploadedAt - a.uploadedAt);

                setUploadedFiles(allFiles);
            } catch (error) {
                console.error('Error fetching existing files:', error);
            } finally {
                setLoadingMedia(false);
            }
        };

        if (event) {
            fetchExistingFiles();
        }
    }, [event, folderName]);

    const handleUploadClick = () => {
        setShowUploadModal(true);
    };

    const handleCloseModal = () => {
        setShowUploadModal(false);
    };

    const createThumbnail = async (file) => {
        if (!file.type.startsWith('image/')) return null;
        try {
            const compressedFile = await imageCompression(file, thumbnailOptions);
            return new File([compressedFile], file.name, {
                type: compressedFile.type,
            });
        } catch (error) {
            console.error('Error creating thumbnail:', error);
            return null;
        }
    };

    const handleFileUpload = async (files, type) => {
        if (!files || files.length === 0) {
            console.log('No files selected');
            return;
        }

        console.log(`Starting upload of ${files.length} ${type}`);

        if (!event || !event.event_host) {
            console.error('Event or event host not found');
            return;
        }

        setIsProcessing(true);
        const uploadedFiles = [];

        try {
            const basePath = `users/${event.event_host}/event_folders/${event.event_name}/${folderName}`;
            console.log('Upload path:', basePath);

            for (const file of files) {
                const timestamp = Date.now();
                const fileName = `${timestamp}_${file.name}`;
                const filePath = `${basePath}/${type}/${fileName}`;
                console.log('Uploading file:', filePath);

                try {
                    const storageRef = ref(storage, filePath);
                    console.log('Storage reference created for path:', filePath);
                    console.log('Event host:', event.event_host);
                    console.log('Event name:', event.event_name);

                    const snapshot = await uploadBytes(storageRef, file);
                    console.log('File uploaded:', snapshot);

                    const downloadURL = await getDownloadURL(snapshot.ref);
                    console.log('Download URL obtained:', downloadURL);

                    let thumbnailUrl = null;
                    if (type === 'photos') {
                        const thumbnail = await createThumbnail(file);
                        if (thumbnail) {
                            const thumbnailPath = `${basePath}/thumbnails/${fileName}`;
                            const thumbnailRef = ref(storage, thumbnailPath);
                            await uploadBytes(thumbnailRef, thumbnail);
                            thumbnailUrl = await getDownloadURL(thumbnailRef);
                        }
                    }

                    const uploadedFile = {
                        name: fileName,
                        url: downloadURL,
                        type: type,
                        path: filePath,
                        thumbnailUrl: thumbnailUrl || downloadURL,
                        uploadedAt: timestamp
                    };

                    uploadedFiles.push(uploadedFile);
                } catch (error) {
                    console.error(`Error uploading ${fileName}:`, error);
                    console.error('Error details:', error.message);
                }
            }

            setUploadedFiles(prev => [...prev, ...uploadedFiles]);
        } catch (error) {
            console.error('Upload error:', error);
            console.error('Error details:', error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileClick = (file) => {
        setSelectedFile(file);
        setShowViewerModal(true);
        setZoomLevel(1);
    };

    const handlePrevious = () => {
        const currentIndex = uploadedFiles.findIndex(file => file.url === selectedFile.url);
        if (currentIndex > 0) {
            setSelectedFile(uploadedFiles[currentIndex - 1]);
            setZoomLevel(1);
        }
    };

    const handleNext = () => {
        const currentIndex = uploadedFiles.findIndex(file => file.url === selectedFile.url);
        if (currentIndex < uploadedFiles.length - 1) {
            setSelectedFile(uploadedFiles[currentIndex + 1]);
            setZoomLevel(1);
        }
    };

    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 0.5, 3));
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
    };

    const handleDeleteFile = async (file, event) => {
        event.stopPropagation(); // Prevent opening the viewer when clicking delete

        if (!window.confirm('Are you sure you want to delete this file?')) {
            return;
        }

        try {
            // Delete main file
            const fileRef = ref(storage, file.path);
            await deleteObject(fileRef);

            // Delete thumbnail if it exists (for photos)
            if (file.type === 'photos' && file.thumbnailUrl) {
                const thumbnailPath = file.path.replace(`/${file.type}/`, '/thumbnails/');
                const thumbnailRef = ref(storage, thumbnailPath);
                await deleteObject(thumbnailRef).catch(err => console.log('No thumbnail found:', err));
            }

            // Update state to remove the deleted file
            setUploadedFiles(prev => prev.filter(f => f.path !== file.path));
        } catch (error) {
            console.error('Error deleting file:', error);
            alert('Failed to delete file. Please try again.');
        }
    };

    const handleSelectFile = (file, isSelected) => {
        setSelectedFiles(prev =>
            isSelected
                ? [...prev, file.path]
                : prev.filter(path => path !== file.path)
        );
    };

    const handleSelectAll = () => {
        if (selectedFiles.length === uploadedFiles.length) {
            setSelectedFiles([]);
        } else {
            setSelectedFiles(uploadedFiles.map(file => file.path));
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedFiles.length) return;

        if (!window.confirm(`Are you sure you want to delete ${selectedFiles.length} files?`)) {
            return;
        }

        try {
            for (const filePath of selectedFiles) {
                const file = uploadedFiles.find(f => f.path === filePath);
                if (!file) continue;

                // Delete main file
                const fileRef = ref(storage, file.path);
                await deleteObject(fileRef);

                // Delete thumbnail if it exists
                if (file.type === 'photos' && file.thumbnailUrl) {
                    const thumbnailPath = file.path.replace(`/${file.type}/`, '/thumbnails/');
                    const thumbnailRef = ref(storage, thumbnailPath);
                    await deleteObject(thumbnailRef).catch(err => console.log('No thumbnail found:', err));
                }
            }

            // Update state to remove deleted files
            setUploadedFiles(prev => prev.filter(file => !selectedFiles.includes(file.path)));
            setSelectedFiles([]);
        } catch (error) {
            console.error('Error deleting files:', error);
            alert('Failed to delete some files. Please try again.');
        }
    };

    const renderMediaGrid = () => (
        <div className="row g-4">
            {uploadedFiles.map((file, index) => (
                <div key={`uploaded-${index}`} className="col-md-3 col-sm-6">
                    <div
                        className="media-card"
                        onClick={() => !selectMode && file.type === 'photos' && handleFileClick(file)}
                        style={{ cursor: selectMode ? 'default' : file.type === 'photos' ? 'pointer' : 'default' }}
                    >
                        <div className="media-thumbnail">
                            {file.type === 'photos' ? (
                                <img
                                    src={file.thumbnailUrl || file.url}
                                    alt={file.name}
                                    loading="lazy"
                                    onError={(e) => {
                                        console.log('Thumbnail load error, falling back to original:', file.name);
                                        e.target.src = file.url;
                                    }}
                                />
                            ) : (
                                <div className="video-thumbnail">
                                    <HiVideoCamera className="display-4" />
                                </div>
                            )}
                        </div>
                        <div className="media-info">
                            <div className="d-flex flex-column">
                                <small className="text-muted text-truncate mb-2">
                                    {file.name.split('_').slice(1).join('_')}
                                </small>
                                {selectMode ? (
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={selectedFiles.includes(file.path)}
                                            onChange={(e) => handleSelectFile(file, e.target.checked)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <label className="form-check-label">Select</label>
                                    </div>
                                ) : (
                                    <div>
                                        {file.type === 'videos' && (
                                            <a
                                                href={file.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-primary"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Play Video
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

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

    if (!event) {
        return (
            <div className="container-fluid">
                <div className="alert alert-danger">
                    Event not found
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center">
                    <HiFolder className="me-2" style={{ fontSize: '2rem', color: 'var(--primary)' }} />
                    <h2 className="mb-0">
                        {event.event_name} / {folderName}
                    </h2>
                </div>
                <div className="d-flex gap-2">
                    {uploadedFiles.length > 0 && (
                        <>
                            <button
                                className="btn btn-outline-primary d-flex align-items-center"
                                onClick={() => setSelectMode(!selectMode)}
                            >
                                {selectMode ? 'Cancel' : 'Select Files'}
                            </button>
                            {selectMode && (
                                <>
                                    <button
                                        className="btn btn-outline-secondary d-flex align-items-center"
                                        onClick={handleSelectAll}
                                    >
                                        {selectedFiles.length === uploadedFiles.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <button
                                        className="btn btn-danger d-flex align-items-center"
                                        onClick={handleBulkDelete}
                                        disabled={selectedFiles.length === 0}
                                    >
                                        Delete Selected ({selectedFiles.length})
                                    </button>
                                </>
                            )}
                        </>
                    )}
                    <button
                        className="btn btn-primary d-flex align-items-center"
                        onClick={handleUploadClick}
                    >
                        <HiUpload className="me-2" />
                        Upload Media
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    {loadingMedia ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary mb-3" role="status">
                                <span className="visually-hidden">Loading media...</span>
                            </div>
                            <p className="text-muted mb-0">Loading media files...</p>
                        </div>
                    ) : uploadedFiles.length === 0 ? (
                        <div className="text-center py-5">
                            <p className="empty-state-message mb-0">
                                No media files uploaded yet. Click "Upload Media" to add files.
                            </p>
                        </div>
                    ) : (
                        renderMediaGrid()
                    )}
                </div>
            </div>

            {/* Upload Modal */}
            <div className={`modal fade ${showUploadModal ? 'show' : ''}`}
                style={{ display: showUploadModal ? 'block' : 'none' }}
                tabIndex="-1"
                aria-labelledby="uploadModalLabel"
                aria-hidden={!showUploadModal}
            >
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="uploadModalLabel">Upload Media</h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={handleCloseModal}
                            ></button>
                        </div>
                        <div className="modal-body">
                            <div className="row g-4">
                                <div className="col-6">
                                    <div
                                        className="upload-option d-flex flex-column align-items-center justify-content-center p-4 border rounded"
                                        onClick={() => document.getElementById('photoInput').click()}
                                    >
                                        <HiPhotograph className="display-4 mb-2" />
                                        <h5>Upload Photos</h5>
                                        <p className="text-muted small mb-0">JPG, PNG, GIF</p>
                                        <input
                                            type="file"
                                            id="photoInput"
                                            accept="image/*"
                                            multiple
                                            className="d-none"
                                            onChange={(e) => handleFileUpload(e.target.files, 'photos')}
                                        />
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div
                                        className="upload-option d-flex flex-column align-items-center justify-content-center p-4 border rounded"
                                        onClick={() => document.getElementById('videoInput').click()}
                                    >
                                        <HiVideoCamera className="display-4 mb-2" />
                                        <h5>Upload Videos</h5>
                                        <p className="text-muted small mb-0">MP4, MOV, AVI</p>
                                        <input
                                            type="file"
                                            id="videoInput"
                                            accept="video/*"
                                            multiple
                                            className="d-none"
                                            onChange={(e) => handleFileUpload(e.target.files, 'videos')}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Viewer Modal */}
            {showViewerModal && selectedFile && (
                <>
                    <div
                        className="modal fade show"
                        style={{ display: 'block' }}
                        tabIndex="-1"
                    >
                        <div className="modal-dialog modal-xl modal-dialog-centered">
                            <div className="modal-content image-viewer-modal">
                                <div className="modal-header border-0">
                                    <h5 className="modal-title">{selectedFile.name}</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => {
                                            setShowViewerModal(false);
                                            setSelectedFile(null);
                                            setZoomLevel(1);
                                        }}
                                    ></button>
                                </div>
                                <div className="modal-body text-center position-relative p-0">
                                    <div className="image-container">
                                        <img
                                            src={selectedFile.url}
                                            alt={selectedFile.name}
                                            style={{
                                                transform: `scale(${zoomLevel})`,
                                                transition: 'transform 0.3s ease'
                                            }}
                                        />
                                    </div>

                                    <div className="viewer-controls">
                                        <button
                                            className="btn btn-light me-2"
                                            onClick={handleZoomOut}
                                            disabled={zoomLevel <= 0.5}
                                        >
                                            <HiZoomOut />
                                        </button>
                                        <button
                                            className="btn btn-light"
                                            onClick={handleZoomIn}
                                            disabled={zoomLevel >= 3}
                                        >
                                            <HiZoomIn />
                                        </button>
                                    </div>

                                    {uploadedFiles.findIndex(file => file.url === selectedFile.url) > 0 && (
                                        <button
                                            className="btn btn-light navigation-button left"
                                            onClick={handlePrevious}
                                        >
                                            <HiChevronLeft />
                                        </button>
                                    )}

                                    {uploadedFiles.findIndex(file => file.url === selectedFile.url) < uploadedFiles.length - 1 && (
                                        <button
                                            className="btn btn-light navigation-button right"
                                            onClick={handleNext}
                                        >
                                            <HiChevronRight />
                                        </button>
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