import React from 'react';

export default function Dashboard() {
    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <h2 className="mb-4">Dashboard Overview</h2>

                    {/* Stats Row */}
                    <div className="row">
                        <div className="col-md-3 mb-4">
                            <div className="stat-card">
                                <h3>Total Events</h3>
                                <h2>156</h2>
                            </div>
                        </div>
                        <div className="col-md-3 mb-4">
                            <div className="stat-card">
                                <h3>Active Events</h3>
                                <h2>32</h2>
                            </div>
                        </div>
                        <div className="col-md-3 mb-4">
                            <div className="stat-card">
                                <h3>Total Revenue</h3>
                                <h2>$45,678</h2>
                            </div>
                        </div>
                        <div className="col-md-3 mb-4">
                            <div className="stat-card">
                                <h3>Attendees</h3>
                                <h2>1,234</h2>
                            </div>
                        </div>
                    </div>

                    {/* Recent Events Table */}
                    <div className="table-responsive mt-4">
                        <h3 className="mb-4">Recent Events</h3>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Event Name</th>
                                    <th>Date</th>
                                    <th>Location</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Summer Music Festival</td>
                                    <td>2024-06-15</td>
                                    <td>Central Park</td>
                                    <td><span className="badge bg-success">Active</span></td>
                                </tr>
                                <tr>
                                    <td>Tech Conference 2024</td>
                                    <td>2024-07-20</td>
                                    <td>Convention Center</td>
                                    <td><span className="badge bg-warning">Pending</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
} 