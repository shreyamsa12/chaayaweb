import React from 'react';

export default function Footer() {
    return (
        <footer className="footer pt-3">
            <div className="container-fluid">
                <div className="row align-items-center justify-content-lg-between">
                    <div className="col-lg-6 mb-lg-0 mb-4">
                        <div className="copyright text-center text-sm text-muted text-lg-start">
                            © {new Date().getFullYear()}, made with{' '}
                            <i className="fa fa-heart text-danger" /> by{' '}
                            <a href="https://www.creative-tim.com" className="font-weight-bold" target="_blank" rel="noreferrer">
                                Creative Tim
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
} 