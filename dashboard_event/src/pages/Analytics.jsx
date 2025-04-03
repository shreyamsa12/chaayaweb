import React from 'react';

export default function Analytics() {
    return (
        <div className="container-fluid">
            <h2 className="mb-4">Analytics Overview</h2>
            <div className="row">
                <div className="col-md-6">
                    <div className="chart-container">
                        <h4>Event Attendance</h4>
                        {/* Add charts here later */}
                        <div className="placeholder-chart">
                            Chart will be added here
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="chart-container">
                        <h4>Revenue Analysis</h4>
                        {/* Add charts here later */}
                        <div className="placeholder-chart">
                            Chart will be added here
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 