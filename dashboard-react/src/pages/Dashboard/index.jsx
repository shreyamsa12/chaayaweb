import React from 'react';
import { HiCurrencyDollar, HiUsers, HiShoppingCart, HiGlobe } from 'react-icons/hi';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

export default function Dashboard() {
    const chartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'Sales',
            data: [450, 200, 100, 220, 500, 100],
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.4
        }]
    };

    return (
        <>
            {/* Stats Cards */}
            <div className="row">
                <div className="col-xl-3 col-sm-6 mb-xl-0 mb-4">
                    <div className="card">
                        <div className="card-body p-3">
                            <div className="row">
                                <div className="col-8">
                                    <div className="numbers">
                                        <p className="text-sm mb-0 text-capitalize font-weight-bold">Today's Money</p>
                                        <h5 className="font-weight-bolder mb-0">$53,000</h5>
                                    </div>
                                </div>
                                <div className="col-4 text-end">
                                    <div className="icon icon-shape bg-gradient-primary shadow text-center border-radius-md">
                                        <HiCurrencyDollar className="text-lg opacity-10" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-xl-3 col-sm-6 mb-xl-0 mb-4">
                    <div className="card">
                        <div className="card-body p-3">
                            <div className="row">
                                <div className="col-8">
                                    <div className="numbers">
                                        <p className="text-sm mb-0 text-capitalize font-weight-bold">Total Users</p>
                                        <h5 className="font-weight-bolder mb-0">2,300</h5>
                                    </div>
                                </div>
                                <div className="col-4 text-end">
                                    <div className="icon icon-shape bg-gradient-success shadow text-center border-radius-md">
                                        <HiUsers className="text-lg opacity-10" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-xl-3 col-sm-6 mb-xl-0 mb-4">
                    <div className="card">
                        <div className="card-body p-3">
                            <div className="row">
                                <div className="col-8">
                                    <div className="numbers">
                                        <p className="text-sm mb-0 text-capitalize font-weight-bold">New Clients</p>
                                        <h5 className="font-weight-bolder mb-0">+3,462</h5>
                                    </div>
                                </div>
                                <div className="col-4 text-end">
                                    <div className="icon icon-shape bg-gradient-danger shadow text-center border-radius-md">
                                        <HiShoppingCart className="text-lg opacity-10" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-xl-3 col-sm-6">
                    <div className="card">
                        <div className="card-body p-3">
                            <div className="row">
                                <div className="col-8">
                                    <div className="numbers">
                                        <p className="text-sm mb-0 text-capitalize font-weight-bold">Sales</p>
                                        <h5 className="font-weight-bolder mb-0">$103,430</h5>
                                    </div>
                                </div>
                                <div className="col-4 text-end">
                                    <div className="icon icon-shape bg-gradient-warning shadow text-center border-radius-md">
                                        <HiGlobe className="text-lg opacity-10" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="row mt-4">
                <div className="col-lg-7 mb-lg-0 mb-4">
                    <div className="card">
                        <div className="card-body p-3">
                            <div className="chart">
                                <h6 className="mb-3">Sales Overview</h6>
                                <Line data={chartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                display: false
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true
                                            }
                                        }
                                    }}
                                    height={300}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
} 