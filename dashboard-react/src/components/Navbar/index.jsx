import React from 'react';
import { HiSearch, HiBell, HiCog } from 'react-icons/hi';

export default function Navbar() {
    return (
        <nav className="navbar navbar-main navbar-expand-lg px-0 mx-4 shadow-none border-radius-xl">
            <div className="container-fluid py-1 px-3">
                <div className="collapse navbar-collapse mt-sm-0 mt-2 me-md-0 me-sm-4" id="navbar">
                    <div className="ms-md-auto pe-md-3 d-flex align-items-center">
                        <div className="input-group">
                            <span className="input-group-text text-body">
                                <HiSearch className="text-dark" />
                            </span>
                            <input type="text" className="form-control" placeholder="Type here..." />
                        </div>
                    </div>
                    <ul className="navbar-nav justify-content-end">
                        <li className="nav-item d-flex align-items-center">
                            <button className="btn btn-icon-only btn-rounded btn-outline-dark mb-0 me-3">
                                <HiBell />
                            </button>
                        </li>
                        <li className="nav-item d-flex align-items-center">
                            <button className="btn btn-icon-only btn-rounded btn-outline-dark mb-0">
                                <HiCog />
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
} 