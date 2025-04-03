import React, { useState } from 'react';
import { HiMail, HiPhone, HiLocationMarker, HiPencil } from 'react-icons/hi';

export default function Profile() {
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState({
        name: "John Doe",
        role: "CEO / Co-Founder",
        bio: "Hi, I'm John Doe, Decisions: If you can't decide, the answer is no...",
        mobile: "(44) 123 1234 123",
        email: "john@example.com",
        location: "USA"
    });

    const handleSave = () => {
        setIsEditing(false);
        // Here you would typically make an API call to save the data
    };

    return (
        <>
            {/* Header */}
            <div className="card card-body blur shadow-blur mx-4 mt-n6 overflow-hidden">
                <div className="row gx-4">
                    <div className="col-auto">
                        <div className="avatar avatar-xl position-relative">
                            <img src="/images/avatar.jpg" alt="profile_image" className="w-100 border-radius-lg shadow-sm" />
                            <label className="btn btn-sm btn-icon-only bg-gradient-light position-absolute bottom-0 end-0 mb-n2 me-n2">
                                <input type="file" className="d-none" />
                                <HiPencil className="text-dark" />
                            </label>
                        </div>
                    </div>
                    <div className="col-auto my-auto">
                        <div className="h-100">
                            {isEditing ? (
                                <input
                                    type="text"
                                    className="form-control"
                                    value={profileData.name}
                                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                />
                            ) : (
                                <h5 className="mb-1">{profileData.name}</h5>
                            )}
                            <p className="mb-0 font-weight-bold text-sm">{profileData.role}</p>
                        </div>
                    </div>
                    <div className="col-auto ms-auto">
                        {isEditing ? (
                            <button className="btn btn-primary btn-sm" onClick={handleSave}>
                                Save Changes
                            </button>
                        ) : (
                            <button className="btn btn-light btn-sm" onClick={() => setIsEditing(true)}>
                                Edit Profile
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Profile Info */}
            <div className="container-fluid py-4">
                <div className="row">
                    <div className="col-12 col-xl-4">
                        <div className="card h-100">
                            <div className="card-header pb-0 p-3">
                                <h6 className="mb-0">Profile Information</h6>
                            </div>
                            <div className="card-body p-3">
                                <p className="text-sm">
                                    {profileData.bio}
                                </p>
                                <hr className="horizontal gray-light my-4" />
                                <ul className="list-group">
                                    <li className="list-group-item border-0 ps-0 pt-0 text-sm">
                                        <strong className="text-dark">Full Name:</strong> &nbsp; {profileData.name}
                                    </li>
                                    <li className="list-group-item border-0 ps-0 text-sm">
                                        <strong className="text-dark">Mobile:</strong> &nbsp; {profileData.mobile}
                                    </li>
                                    <li className="list-group-item border-0 ps-0 text-sm">
                                        <strong className="text-dark">Email:</strong> &nbsp; {profileData.email}
                                    </li>
                                    <li className="list-group-item border-0 ps-0 text-sm">
                                        <strong className="text-dark">Location:</strong> &nbsp; {profileData.location}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-xl-8">
                        <div className="card h-100">
                            <div className="card-header pb-0 p-3">
                                <h6 className="mb-0">Projects</h6>
                            </div>
                            <div className="card-body p-3">
                                <div className="row">
                                    {[1, 2, 3, 4].map((item) => (
                                        <div className="col-xl-3 col-md-6 mb-xl-0 mb-4" key={item}>
                                            <div className="card card-blog card-plain">
                                                <div className="position-relative">
                                                    <div className="d-block shadow-xl border-radius-xl">
                                                        <img
                                                            src={`/images/project-${item}.jpg`}
                                                            alt={`project-${item}`}
                                                            className="img-fluid shadow border-radius-xl"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="card-body px-1 pb-0">
                                                    <p className="text-gradient text-dark mb-2 text-sm">Project #{item}</p>
                                                    <h5>Modern Project</h5>
                                                    <p className="mb-4 text-sm">
                                                        As Uber works through a huge amount of internal management turmoil.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
} 