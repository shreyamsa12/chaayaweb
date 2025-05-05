import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, getDoc, doc, query, orderBy, limit, startAfter, getDocs, addDoc, where, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../config/firebase';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { HiFolder, HiUpload, HiPhotograph, HiVideoCamera, HiX, HiChevronLeft, HiChevronRight, HiZoomIn, HiZoomOut, HiShare, HiMail, HiChat, HiCog } from 'react-icons/hi';
import imageCompression from 'browser-image-compression';

// Cloud function URL
const CLOUD_FUNCTION_URL = 'https://us-central1-photoshoto-a7226.cloudfunctions.net';

const ShareWizardModal = ({ show, onClose, eventId, folderName }) => {
    const [selectedShareMethod, setSelectedShareMethod] = useState(null);
    const [shareFormData, setShareFormData] = useState({
        contact: '',
        instagramHandle: '',
        email: '',
        permissions: ['view']
    });

    const handleShareMethodSelect = (method) => {
        setSelectedShareMethod(method);
    };

    const handleShareFormSubmit = (e) => {
        e.preventDefault();
        const shareUrl = `${window.location.origin}/folders/${eventId}/${folderName}`;
        const message = `Check out these photos: ${shareUrl}`;

        switch (selectedShareMethod) {
            case 'whatsapp':
                window.open(`https://wa.me/${shareFormData.contact}?text=${encodeURIComponent(message)}`, '_blank');
                break;
            case 'sms':
                window.open(`sms:${shareFormData.contact}?body=${encodeURIComponent(message)}`, '_blank');
                break;
            case 'email':
                window.open(`mailto:${shareFormData.email}?subject=Photo Share&body=${encodeURIComponent(message)}`, '_blank');
                break;
            case 'instagram':
                navigator.clipboard.writeText(shareUrl)
                    .then(() => alert('Link copied to clipboard! Share it on Instagram.'))
                    .catch(() => alert('Failed to copy link.'));
                break;
        }

        onClose();
    };

    const handlePermissionChange = (permission) => {
        setShareFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(permission)
                ? prev.permissions.filter(p => p !== permission)
                : [...prev.permissions, permission]
        }));
    };

    if (!show) return null;

    return (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Share Photos</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        {!selectedShareMethod ? (
                            <div className="share-methods">
                                <button
                                    className="btn btn-outline-success w-100 mb-2 d-flex align-items-center justify-content-center"
                                    onClick={() => handleShareMethodSelect('whatsapp')}
                                >
                                    <HiChat className="me-2" />
                                    WhatsApp
                                </button>
                                <button
                                    className="btn btn-outline-primary w-100 mb-2 d-flex align-items-center justify-content-center"
                                    onClick={() => handleShareMethodSelect('sms')}
                                >
                                    <HiChat className="me-2" />
                                    SMS
                                </button>
                                <button
                                    className="btn btn-outline-danger w-100 mb-2 d-flex align-items-center justify-content-center"
                                    onClick={() => handleShareMethodSelect('email')}
                                >
                                    <HiMail className="me-2" />
                                    Email
                                </button>
                                <button
                                    className="btn btn-outline-info w-100 mb-2 d-flex align-items-center justify-content-center"
                                    onClick={() => handleShareMethodSelect('instagram')}
                                >
                                    <HiPhotograph className="me-2" />
                                    Instagram
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleShareFormSubmit}>
                                {selectedShareMethod === 'whatsapp' && (
                                    <div className="mb-3">
                                        <label className="form-label">WhatsApp Number</label>
                                        <input
                                            type="tel"
                                            className="form-control"
                                            placeholder="Enter WhatsApp number"
                                            value={shareFormData.contact}
                                            onChange={(e) => setShareFormData(prev => ({ ...prev, contact: e.target.value }))}
                                            required
                                        />
                                    </div>
                                )}
                                {selectedShareMethod === 'sms' && (
                                    <div className="mb-3">
                                        <label className="form-label">Phone Number</label>
                                        <input
                                            type="tel"
                                            className="form-control"
                                            placeholder="Enter phone number"
                                            value={shareFormData.contact}
                                            onChange={(e) => setShareFormData(prev => ({ ...prev, contact: e.target.value }))}
                                            required
                                        />
                                    </div>
                                )}
                                {selectedShareMethod === 'email' && (
                                    <div className="mb-3">
                                        <label className="form-label">Email Address</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            placeholder="Enter email address"
                                            value={shareFormData.email}
                                            onChange={(e) => setShareFormData(prev => ({ ...prev, email: e.target.value }))}
                                            required
                                        />
                                    </div>
                                )}
                                {selectedShareMethod === 'instagram' && (
                                    <div className="mb-3">
                                        <label className="form-label">Instagram Handle</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Enter Instagram handle"
                                            value={shareFormData.instagramHandle}
                                            onChange={(e) => setShareFormData(prev => ({ ...prev, instagramHandle: e.target.value }))}
                                            required
                                        />
                                    </div>
                                )}

                                <div className="mb-3">
                                    <label className="form-label">Permissions</label>
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={shareFormData.permissions.includes('view')}
                                            onChange={() => handlePermissionChange('view')}
                                        />
                                        <label className="form-check-label">Just View</label>
                                    </div>
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={shareFormData.permissions.includes('select')}
                                            onChange={() => handlePermissionChange('select')}
                                        />
                                        <label className="form-check-label">View and Select</label>
                                    </div>
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={shareFormData.permissions.includes('write')}
                                            onChange={() => handlePermissionChange('write')}
                                        />
                                        <label className="form-check-label">Write</label>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setSelectedShareMethod(null)}
                                    >
                                        Back
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Share
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FaceResultsModal = ({ show, onClose, results }) => {
    if (!show || !results) return null;

    return (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog modal-xl">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Face Detection Results - {results.fileName}</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        {results.results.length === 0 ? (
                            <p>No face detection results found for this image.</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Collection ID</th>
                                            <th>Status</th>
                                            <th>Processed At</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.results.map((result, index) => (
                                            <tr key={result.id || index}>
                                                <td>{result.collectionId}</td>
                                                <td>
                                                    {result.message ? (
                                                        <span className="badge bg-warning">{result.message}</span>
                                                    ) : (
                                                        <span className={`badge ${result.faceIndexed ? 'bg-success' : 'bg-danger'}`}>
                                                            {result.faceIndexed ?
                                                                `${result.faceCount || 1} Face${result.faceCount > 1 ? 's' : ''} Detected` :
                                                                'No Face Detected'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{new Date(result.processedAt).toLocaleString()}</td>
                                                <td>
                                                    {result.faceDetails ? (
                                                        <div>
                                                            {Array.isArray(result.faceDetails.faces) ? (
                                                                <div>
                                                                    <div className="alert alert-info mb-3">
                                                                        <p className="mb-1"><strong>Total Faces Detected:</strong> {result.faceDetails.metadata.totalFacesDetected}</p>
                                                                        {result.faceDetails.metadata.hasMoreFaces && (
                                                                            <p className="mb-0 text-warning">
                                                                                <i className="fas fa-exclamation-triangle me-2"></i>
                                                                                Maximum face limit reached ({result.faceDetails.metadata.maxFacesAllowed}). Some faces may not have been detected.
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
                                                                        {result.faceDetails.faces.map((face, faceIndex) => (
                                                                            <div key={face.faceId} className="col">
                                                                                <div className="card h-100">
                                                                                    <div className="card-header">
                                                                                        <h6 className="mb-0">Face {faceIndex + 1}</h6>
                                                                                    </div>
                                                                                    <div className="card-body">
                                                                                        <div className="mb-2">
                                                                                            <strong>Confidence:</strong> {face.confidence?.toFixed(2)}%
                                                                                        </div>
                                                                                        <div className="mb-2">
                                                                                            <strong>Face ID:</strong> {face.faceId}
                                                                                        </div>
                                                                                        <div className="mb-2">
                                                                                            <strong>Bounding Box:</strong>
                                                                                            <ul className="list-unstyled mb-0">
                                                                                                <li>Width: {(face.boundingBox?.Width * 100).toFixed(1)}%</li>
                                                                                                <li>Height: {(face.boundingBox?.Height * 100).toFixed(1)}%</li>
                                                                                                <li>Left: {(face.boundingBox?.Left * 100).toFixed(1)}%</li>
                                                                                                <li>Top: {(face.boundingBox?.Top * 100).toFixed(1)}%</li>
                                                                                            </ul>
                                                                                        </div>
                                                                                        {face.pose && (
                                                                                            <div>
                                                                                                <strong>Pose:</strong>
                                                                                                <ul className="list-unstyled mb-0">
                                                                                                    <li>Pitch: {face.pose.Pitch?.toFixed(1)}°</li>
                                                                                                    <li>Roll: {face.pose.Roll?.toFixed(1)}°</li>
                                                                                                    <li>Yaw: {face.pose.Yaw?.toFixed(1)}°</li>
                                                                                                </ul>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <p><strong>Confidence:</strong> {result.faceDetails.confidence?.toFixed(2)}%</p>
                                                                    <p><strong>Face ID:</strong> {result.faceDetails.faceId}</p>
                                                                    <p><strong>Bounding Box:</strong> {JSON.stringify(result.faceDetails.boundingBox)}</p>
                                                                    {result.faceDetails.pose && (
                                                                        <p><strong>Pose:</strong> {JSON.stringify(result.faceDetails.pose)}</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted">{result.message || 'No face details available'}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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
    const [uploadProgress, setUploadProgress] = useState({});
    const [showShareModal, setShowShareModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalFiles, setTotalFiles] = useState(0);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMoreFiles, setHasMoreFiles] = useState(true);
    const [isIndexing, setIsIndexing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(null);
    const [processingStatus, setProcessingStatus] = useState('');
    const [resumeToken, setResumeToken] = useState(null);
    const [isRecreatingThumbnails, setIsRecreatingThumbnails] = useState(false);
    const [showFaceResultsModal, setShowFaceResultsModal] = useState(false);
    const [selectedFileFaceResults, setSelectedFileFaceResults] = useState(null);
    const IMAGES_PER_PAGE = 12;

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

    // Function to migrate existing files to Firestore
    const migrateExistingFiles = async (basePath) => {
        const filesRef = collection(db, 'files');
        const photosRef = ref(storage, `${basePath}/photos`);
        const videosRef = ref(storage, `${basePath}/videos`);

        // Fetch all existing files from Storage
        const [photosResult, videosResult] = await Promise.all([
            listAll(photosRef).catch(() => ({ items: [] })),
            listAll(videosRef).catch(() => ({ items: [] }))
        ]);

        const allRefs = [
            ...photosResult.items.map(ref => ({ ref, type: 'photos' })),
            ...videosResult.items.map(ref => ({ ref, type: 'videos' }))
        ];

        // Process each file
        for (const { ref, type } of allRefs) {
            try {
                // Check if file already exists in Firestore
                const fileQuery = query(
                    filesRef,
                    where('path', '==', ref.fullPath)
                );
                const querySnapshot = await getDocs(fileQuery);

                if (querySnapshot.empty) {
                    // File doesn't exist in Firestore, add it
                    const timestamp = parseInt(ref.name.split('_')[0]);
                    const fileData = {
                        name: ref.name,
                        path: ref.fullPath,
                        type: type,
                        uploadedAt: timestamp,
                        eventId: eventId,
                        folderName: folderName,
                        userId: event.event_host,
                        thumbnailPath: type === 'photos' ? ref.fullPath.replace(`/${type}/`, '/thumbnails/') : null
                    };

                    await addDoc(filesRef, fileData);
                    console.log(`Migrated file: ${ref.name}`);
                }
            } catch (error) {
                console.error(`Error migrating file ${ref.name}:`, error);
            }
        }
    };

    // Effect to fetch files when page changes
    useEffect(() => {
        const fetchFiles = async () => {
            if (!event || !event.event_host) return;

            setLoadingMedia(true);
            try {
                const basePath = `users/${event.event_host}/event_folders/${event.event_name}/${folderName}`;

                // Migrate existing files if needed (only on first page)
                if (currentPage === 1) {
                    await migrateExistingFiles(basePath);
                }

                // Create Firestore query
                const filesRef = collection(db, 'files');
                let q = query(
                    filesRef,
                    where('eventId', '==', eventId),
                    where('folderName', '==', folderName),
                    orderBy('uploadedAt', 'desc'),
                    limit(IMAGES_PER_PAGE)
                );

                // If not first page, start after last document
                if (currentPage > 1 && lastDoc) {
                    q = query(
                        filesRef,
                        where('eventId', '==', eventId),
                        where('folderName', '==', folderName),
                        orderBy('uploadedAt', 'desc'),
                        startAfter(lastDoc),
                        limit(IMAGES_PER_PAGE)
                    );
                }

                try {
                    // Try to get files from Firestore
                    const querySnapshot = await getDocs(q);

                    // Get the last document for pagination
                    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                    setLastDoc(lastVisible);

                    // Check if there are more files
                    setHasMoreFiles(querySnapshot.docs.length === IMAGES_PER_PAGE);

                    // Fetch file URLs and thumbnails
                    const files = await Promise.all(
                        querySnapshot.docs.map(async (doc) => {
                            const fileData = doc.data();
                            try {
                                const fileRef = ref(storage, fileData.path);
                                const url = await getDownloadURL(fileRef);

                                let thumbnailUrl = null;
                                if (fileData.type === 'photos') {
                                    const thumbnailPath = fileData.path.replace(`/${fileData.type}/`, '/thumbnails/');
                                    const thumbnailRef = ref(storage, thumbnailPath);
                                    try {
                                        thumbnailUrl = await getDownloadURL(thumbnailRef);
                                    } catch (error) {
                                        console.log('No thumbnail found, using original:', fileData.name);
                                        thumbnailUrl = url;
                                    }
                                }

                                return {
                                    id: doc.id,
                                    name: fileData.name,
                                    url: url,
                                    type: fileData.type,
                                    path: fileData.path,
                                    thumbnailUrl: thumbnailUrl || url,
                                    uploadedAt: fileData.uploadedAt
                                };
                            } catch (error) {
                                console.error(`Error fetching file details for ${fileData.name}:`, error);
                                return null;
                            }
                        })
                    );

                    setUploadedFiles(files.filter(file => file !== null));

                    // Update total count (only on first page)
                    if (currentPage === 1) {
                        const countQuery = query(
                            filesRef,
                            where('eventId', '==', eventId),
                            where('folderName', '==', folderName)
                        );
                        const countSnapshot = await getDocs(countQuery);
                        setTotalFiles(countSnapshot.size);
                    }
                } catch (error) {
                    // If Firestore query fails (e.g., index not ready), fall back to Storage
                    console.log('Falling back to Storage for file listing');
                    const photosRef = ref(storage, `${basePath}/photos`);
                    const videosRef = ref(storage, `${basePath}/videos`);

                    const [photosResult, videosResult] = await Promise.all([
                        listAll(photosRef).catch(() => ({ items: [] })),
                        listAll(videosRef).catch(() => ({ items: [] }))
                    ]);

                    const allRefs = [
                        ...photosResult.items.map(item => ({ ref: item, type: 'photos' })),
                        ...videosResult.items.map(item => ({ ref: item, type: 'videos' }))
                    ].sort((a, b) => {
                        const timestampA = parseInt(a.ref.name.split('_')[0]);
                        const timestampB = parseInt(b.ref.name.split('_')[0]);
                        return timestampB - timestampA;
                    });

                    const startIndex = (currentPage - 1) * IMAGES_PER_PAGE;
                    const endIndex = startIndex + IMAGES_PER_PAGE;
                    const currentPageRefs = allRefs.slice(startIndex, endIndex);

                    const files = await Promise.all(
                        currentPageRefs.map(async ({ ref: fileRef, type }) => {
                            try {
                                const url = await getDownloadURL(fileRef);
                                let thumbnailUrl = null;
                                if (type === 'photos') {
                                    const thumbnailPath = fileRef.fullPath.replace(`/${type}/`, '/thumbnails/');
                                    const thumbnailRef = ref(storage, thumbnailPath);
                                    try {
                                        thumbnailUrl = await getDownloadURL(thumbnailRef);
                                    } catch (error) {
                                        thumbnailUrl = url;
                                    }
                                }

                                return {
                                    name: fileRef.name,
                                    url: url,
                                    type: type,
                                    path: fileRef.fullPath,
                                    thumbnailUrl: thumbnailUrl || url,
                                    uploadedAt: parseInt(fileRef.name.split('_')[0])
                                };
                            } catch (error) {
                                console.error(`Error fetching file details for ${fileRef.name}:`, error);
                                return null;
                            }
                        })
                    );

                    setUploadedFiles(files.filter(file => file !== null));
                    setHasMoreFiles(endIndex < allRefs.length);
                    if (currentPage === 1) {
                        setTotalFiles(allRefs.length);
                    }
                }

                setLoadingMedia(false);
            } catch (error) {
                console.error('Error fetching files:', error);
                setLoadingMedia(false);
            }
        };

        fetchFiles();
    }, [event, folderName, currentPage, lastDoc]);

    const handleNextPage = () => {
        if (hasMoreFiles) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    };

    // Reset pagination when folder changes
    useEffect(() => {
        setCurrentPage(1);
        setLastDoc(null);
        setHasMoreFiles(true);
    }, [folderName]);

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

        if (!event || !event.event_host) {
            console.error('Event or event host not found');
            return;
        }

        setIsProcessing(true);
        const uploadedFiles = [];

        try {
            const basePath = `users/${event.event_host}/event_folders/${event.event_name}/${folderName}`;
            const filesRef = collection(db, 'files');

            for (const file of files) {
                const timestamp = Date.now();
                const fileName = `${timestamp}_${file.name}`;
                const filePath = `${basePath}/${type}/${fileName}`;

                setUploadProgress(prev => ({
                    ...prev,
                    [fileName]: 0
                }));

                try {
                    const storageRef = ref(storage, filePath);
                    const uploadTask = uploadBytesResumable(storageRef, file);

                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(prev => ({
                                ...prev,
                                [fileName]: progress
                            }));
                        },
                        (error) => {
                            console.error(`Error uploading ${fileName}:`, error);
                        },
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

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

                            // Store file metadata in Firestore
                            const fileData = {
                                name: fileName,
                                path: filePath,
                                type: type,
                                uploadedAt: timestamp,
                                eventId: eventId,
                                folderName: folderName,
                                userId: event.event_host,
                                thumbnailPath: type === 'photos' ? `${basePath}/thumbnails/${fileName}` : null
                            };

                            await addDoc(filesRef, fileData);

                            const uploadedFile = {
                                name: fileName,
                                url: downloadURL,
                                type: type,
                                path: filePath,
                                thumbnailUrl: thumbnailUrl || downloadURL,
                                uploadedAt: timestamp
                            };

                            uploadedFiles.push(uploadedFile);
                            setUploadedFiles(prev => [...prev, uploadedFile]);

                            setUploadProgress(prev => {
                                const newProgress = { ...prev };
                                delete newProgress[fileName];
                                return newProgress;
                            });
                        }
                    );
                } catch (error) {
                    console.error(`Error uploading ${fileName}:`, error);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
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
            // Delete main file from Storage
            const fileRef = ref(storage, file.path);
            await deleteObject(fileRef);

            // Delete thumbnail if it exists (for photos)
            if (file.type === 'photos' && file.thumbnailUrl) {
                const thumbnailPath = file.path.replace(`/${file.type}/`, '/thumbnails/');
                const thumbnailRef = ref(storage, thumbnailPath);
                await deleteObject(thumbnailRef).catch(err => console.log('No thumbnail found:', err));
            }

            // Delete file metadata from Firestore
            const filesRef = collection(db, 'files');
            const q = query(
                filesRef,
                where('path', '==', file.path)
            );
            const querySnapshot = await getDocs(q);

            // Delete all matching documents (should be only one)
            const deletePromises = querySnapshot.docs.map(doc =>
                deleteDoc(doc.ref)
            );
            await Promise.all(deletePromises);

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
            const filesRef = collection(db, 'files');

            for (const filePath of selectedFiles) {
                const file = uploadedFiles.find(f => f.path === filePath);
                if (!file) continue;

                // Delete main file from Storage
                const fileRef = ref(storage, file.path);
                await deleteObject(fileRef);

                // Delete thumbnail if it exists
                if (file.type === 'photos' && file.thumbnailUrl) {
                    const thumbnailPath = file.path.replace(`/${file.type}/`, '/thumbnails/');
                    const thumbnailRef = ref(storage, thumbnailPath);
                    await deleteObject(thumbnailRef).catch(err => console.log('No thumbnail found:', err));
                }

                // Delete file metadata from Firestore
                const q = query(
                    filesRef,
                    where('path', '==', file.path)
                );
                const querySnapshot = await getDocs(q);

                // Delete all matching documents (should be only one)
                const deletePromises = querySnapshot.docs.map(doc =>
                    deleteDoc(doc.ref)
                );
                await Promise.all(deletePromises);
            }

            // Update state to remove deleted files
            setUploadedFiles(prev => prev.filter(file => !selectedFiles.includes(file.path)));
            setSelectedFiles([]);
        } catch (error) {
            console.error('Error deleting files:', error);
            alert('Failed to delete some files. Please try again.');
        }
    };

    const handleShareLink = () => {
        setShowShareModal(true);
    };

    const handleIndexAll = async () => {
        if (!event || !event.event_host) return;

        setIsIndexing(true);
        try {
            const basePath = `users/${event.event_host}/event_folders/${event.event_name}/${folderName}`;
            await migrateExistingFiles(basePath);
            // Refresh the current page after indexing
            setCurrentPage(1);
            setLastDoc(null);
            setHasMoreFiles(true);
            alert('All files have been indexed successfully!');
        } catch (error) {
            console.error('Error indexing files:', error);
            alert('Error indexing files. Please try again.');
        } finally {
            setIsIndexing(false);
        }
    };

    const handleBatchProcess = async () => {
        try {
            if (!event || !event.event_host) {
                throw new Error('Event or event host not found');
            }

            if (!confirm('Are you sure you want to process all images in this folder with AWS Rekognition?')) {
                return;
            }

            setIsProcessing(true);
            setProcessingProgress({ status: 'starting', message: 'Initializing batch processing...' });

            // Get the base path for the folder
            const basePath = `users/${event.event_host}/event_folders/${event.event_name}/${folderName}`;
            const collectionId = `${eventId}_${folderName}`;

            console.log('Starting batch process with:', {
                basePath,
                collectionId,
                eventId,
                folderName,
                userId: event.event_host,
                eventName: event.event_name
            });

            // Check for existing processing status
            const processingStatusRef = doc(db, 'processingStatus', collectionId);
            const processingStatusDoc = await getDoc(processingStatusRef);

            let shouldResume = false;
            if (processingStatusDoc.exists()) {
                const status = processingStatusDoc.data();
                console.log('Existing processing status:', status);
                if (status.status === 'in_progress') {
                    shouldResume = confirm('A previous processing session was interrupted. Would you like to resume?');
                }
            }

            // Initialize or update processing status
            console.log('Initializing processing status...');
            await setDoc(processingStatusRef, {
                status: 'in_progress',
                totalFiles: 0,
                processedFiles: 0,
                failedFiles: 0,
                lastUpdated: serverTimestamp(),
                startTime: serverTimestamp(),
                results: [],
                resumeToken: shouldResume ? true : false
            }, { merge: true });

            setProcessingProgress({ status: 'processing', message: 'Processing images...' });

            // Call the cloud function
            console.log('Calling cloud function at:', `${CLOUD_FUNCTION_URL}/batchProcessImages`);
            const requestBody = {
                folder_path: basePath,
                eventId: eventId,
                folderName: folderName,
                collectionId: collectionId,
                userId: event.event_host,
                eventName: event.event_name,
                resumeToken: shouldResume,
                processOptions: {
                    includeThumbnails: true,
                    fileTypes: ['photos'],
                    includePaths: ['/thumbnails/'],
                    excludePaths: ['/photos/']
                }
            };
            console.log('Request body:', requestBody);

            const response = await fetch(`${CLOUD_FUNCTION_URL}/batchProcessImages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('Cloud function response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Cloud function error response:', errorData);
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Cloud function result:', result);

            // Update processing status with results
            await setDoc(processingStatusRef, {
                status: 'completed',
                totalFiles: result.totalFiles,
                processedFiles: result.processedFiles,
                failedFiles: result.failedFiles,
                lastUpdated: serverTimestamp(),
                endTime: serverTimestamp(),
                results: result.results
            }, { merge: true });

            setProcessingProgress({
                status: 'completed',
                message: `Processing completed. Processed ${result.processedFiles} files successfully. ${result.failedFiles} files failed.`
            });

            // Refresh the current page by resetting pagination
            setCurrentPage(1);
            setLastDoc(null);
            setHasMoreFiles(true);

        } catch (error) {
            console.error('Error in batch processing:', error);
            console.error('Error stack:', error.stack);
            setProcessingProgress({
                status: 'error',
                message: `Error processing images: ${error.message}`
            });

            // Update processing status to failed
            try {
                const collectionId = `${eventId}_${folderName}`;
                const processingStatusRef = doc(db, 'processingStatus', collectionId);
                await setDoc(processingStatusRef, {
                    status: 'failed',
                    lastUpdated: serverTimestamp(),
                    error: error.message
                }, { merge: true });
            } catch (updateError) {
                console.error('Error updating processing status:', updateError);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRecreateThumbnails = async () => {
        if (!event || !folderName) return;

        try {
            setIsRecreatingThumbnails(true);
            setProcessingStatus('Recreating thumbnails...');

            const basePath = `users/${event.event_host}/event_folders/${event.event_name}/${folderName}`;
            const response = await fetch(`${CLOUD_FUNCTION_URL}/recreateThumbnails`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    folder_path: basePath,
                    eventId: eventId,
                    folderName: folderName,
                    quality: 85, // Higher quality JPEG
                    maxSize: 5 * 1024 * 1024, // 5MB in bytes
                    dimensions: {
                        width: 1920, // Full HD width
                        height: 1080 // Full HD height
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Thumbnail recreation result:', result);

            // Update processing status
            setProcessingStatus(`Successfully recreated ${result.processedFiles} thumbnails. ${result.failedFiles} failed.`);

            // Refresh the current page to show new thumbnails
            window.location.reload();
        } catch (error) {
            console.error('Error recreating thumbnails:', error);
            setProcessingStatus(`Error recreating thumbnails: ${error.message}`);
        } finally {
            setIsRecreatingThumbnails(false);
        }
    };

    const handleViewFaceResults = async (file) => {
        try {
            console.log('Fetching face results for file:', file.path);
            const filesRef = collection(db, 'files');
            const q = query(filesRef, where('path', '==', file.path));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docRef = querySnapshot.docs[0].ref;
                const fileData = querySnapshot.docs[0].data();
                console.log('Found file document:', docRef.id, 'with data:', fileData);

                // Get the faceIndexing subcollection
                const faceIndexingRef = collection(docRef, 'faceIndexing');
                const faceResults = await getDocs(faceIndexingRef);

                console.log('Face results count:', faceResults.size);

                const results = faceResults.docs.map(doc => {
                    const data = doc.data();
                    console.log('Face result data:', data);
                    return {
                        id: doc.id,
                        ...data
                    };
                });

                if (results.length === 0) {
                    // If no results in faceIndexing, check the main document's status
                    if (fileData.hasFaceIndexing) {
                        const status = fileData.faceDetectionStatus || 'no_face_detected';
                        const message = status === 'face_detected' ?
                            'Face was detected but details are not available' :
                            'No faces detected in this image';

                        setSelectedFileFaceResults({
                            fileName: file.name,
                            results: [{
                                id: 'current',
                                collectionId: `${eventId}_${folderName}`,
                                faceIndexed: status === 'face_detected',
                                processedAt: fileData.lastProcessed || new Date().toISOString(),
                                faceDetails: null,
                                message: message
                            }]
                        });
                    } else {
                        setSelectedFileFaceResults({
                            fileName: file.name,
                            results: [{
                                id: 'not_processed',
                                collectionId: `${eventId}_${folderName}`,
                                faceIndexed: false,
                                processedAt: new Date().toISOString(),
                                faceDetails: null,
                                message: 'This image has not been processed for face detection yet'
                            }]
                        });
                    }
                } else {
                    setSelectedFileFaceResults({
                        fileName: file.name,
                        results: results
                    });
                }
                setShowFaceResultsModal(true);
            } else {
                console.log('No file document found for path:', file.path);
                setSelectedFileFaceResults({
                    fileName: file.name,
                    results: [{
                        id: 'not_found',
                        collectionId: `${eventId}_${folderName}`,
                        faceIndexed: false,
                        processedAt: new Date().toISOString(),
                        faceDetails: null,
                        message: 'File not found in database'
                    }]
                });
                setShowFaceResultsModal(true);
            }
        } catch (error) {
            console.error('Error fetching face results:', error);
            alert('Error fetching face detection results: ' + error.message);
        }
    };

    const SKELETON_COUNT = 8; // Number of skeleton cards to show

    const renderMediaGrid = () => {
        if (loadingMedia) {
            return (
                <div className="row g-4">
                    {Array.from({ length: IMAGES_PER_PAGE }).map((_, idx) => (
                        <div key={idx} className="col-md-3 col-sm-6">
                            <div className="media-card">
                                <div className="media-thumbnail skeleton" style={{ height: 200 }} />
                                <div className="media-info mt-2">
                                    <div className="skeleton" style={{ height: 16, width: '80%' }} />
                                    <div className="skeleton mt-2" style={{ height: 12, width: '60%' }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return (
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
                                        <div className="d-flex gap-2">
                                            {file.type === 'photos' && (
                                                <button
                                                    className="btn btn-sm btn-info"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleViewFaceResults(file);
                                                    }}
                                                >
                                                    View Faces
                                                </button>
                                            )}
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
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalFiles / IMAGES_PER_PAGE);

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
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center">
                    <HiFolder className="me-2" style={{ fontSize: '2rem', color: 'var(--primary)' }} />
                    <h2 className="mb-0">
                        {event.event_name} / {folderName}
                    </h2>
                </div>
            </div>

            <div className="d-flex gap-2 mb-4">
                {uploadedFiles.length > 0 && (
                    <>
                        <button
                            className="btn btn-outline-primary d-flex align-items-center"
                            onClick={() => setSelectMode(!selectMode)}
                        >
                            {selectMode ? 'Cancel' : 'Select'}
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
                    className="btn btn-outline-info d-flex align-items-center"
                    onClick={handleIndexAll}
                    disabled={isIndexing}
                >
                    {isIndexing ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Indexing...
                        </>
                    ) : (
                        <>
                            <HiUpload className="me-2" />
                            Index
                        </>
                    )}
                </button>
                <button
                    className="btn btn-outline-info d-flex align-items-center"
                    onClick={handleBatchProcess}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Processing...
                        </>
                    ) : (
                        <>
                            <HiCog className="me-2" />
                            Process Images
                        </>
                    )}
                </button>
                <button
                    className="btn btn-primary d-flex align-items-center"
                    onClick={handleUploadClick}
                >
                    <HiUpload className="me-2" />
                    Upload
                </button>
                <button
                    className="btn btn-outline-primary d-flex align-items-center"
                    onClick={handleShareLink}
                >
                    <HiShare className="me-2" />
                    Share
                </button>
                <button
                    onClick={handleRecreateThumbnails}
                    disabled={isRecreatingThumbnails}
                    className={`px-4 py-2 rounded-lg ${isRecreatingThumbnails
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                        } text-white`}
                >
                    {isRecreatingThumbnails ? 'Recreating...' : 'Recreate Thumbnails'}
                </button>
            </div>

            {/* Add processing progress alert */}
            {processingProgress && (
                <div className={`alert alert-${processingProgress.status === 'error' ? 'danger' : processingProgress.status === 'completed' ? 'success' : 'info'} mb-4`}>
                    {processingProgress.message}
                </div>
            )}

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

            {/* Pagination Bar */}
            {uploadedFiles.length > 0 && (
                <div className="d-flex justify-content-center align-items-center my-3 gap-3">
                    <button
                        className="btn btn-outline-secondary"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>
                    <span>
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        className="btn btn-outline-secondary"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>
                </div>
            )}

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
                            {/* Add progress display */}
                            {Object.entries(uploadProgress).map(([fileName, progress]) => (
                                <div key={fileName} className="mt-3">
                                    <div className="d-flex justify-content-between mb-1">
                                        <small>{fileName}</small>
                                        <small>{Math.round(progress)}%</small>
                                    </div>
                                    <div className="progress">
                                        <div
                                            className="progress-bar"
                                            role="progressbar"
                                            style={{ width: `${progress}%` }}
                                            aria-valuenow={progress}
                                            aria-valuemin="0"
                                            aria-valuemax="100"
                                        />
                                    </div>
                                </div>
                            ))}
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

            {/* Add Share Wizard Modal */}
            <ShareWizardModal
                show={showShareModal}
                onClose={() => setShowShareModal(false)}
                eventId={eventId}
                folderName={folderName}
            />

            {/* Add Face Results Modal */}
            <FaceResultsModal
                show={showFaceResultsModal}
                onClose={() => setShowFaceResultsModal(false)}
                results={selectedFileFaceResults}
            />
        </div>
    );
} 