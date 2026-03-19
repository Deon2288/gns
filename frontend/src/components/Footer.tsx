import React from 'react';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    return (
        <footer style={{ padding: '20px', textAlign: 'center', background: '#f8f9fa' }}>
            <div style={{ marginBottom: '10px' }}>
                <h2 style={{ margin: 0 }}>GNNS Branding</h2>
            </div>
            <div>
                <h3>Quick Links</h3>
                <ul>
                    <li><a href="#">Home</a></li>
                    <li><a href="#">About Us</a></li>
                    <li><a href="#">Services</a></li>
                    <li><a href="#">Contact</a></li>
                </ul>
            </div>
            <div>
                <h3>Resources</h3>
                <ul>
                    <li><a href="#">Blog</a></li>
                    <li><a href="#">Documentation</a></li>
                    <li><a href="#">FAQs</a></li>
                </ul>
            </div>
            <div>
                <h3>Legal Links</h3>
                <ul>
                    <li><a href="#">Privacy Policy</a></li>
                    <li><a href="#">Terms of Service</a></li>
                </ul>
            </div>
            <div style={{ marginTop: '20px', fontSize: '14px', color: '#6c757d' }}>
                &copy; {currentYear} GNNS. All rights reserved.
            </div>
        </footer>
    );
};

export default Footer;