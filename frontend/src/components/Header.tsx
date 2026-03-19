import React from 'react';
import Logo from './Logo';
import './Header.css';

interface HeaderProps {
  title?: string;
  showBranding?: boolean;
}

const Header: React.FC<HeaderProps> = ({ title = 'GPS Tracking System', showBranding = true }) => {
  return (
    <header className="gns-header">
      <div className="header-left">
        {showBranding && <Logo size="medium" showText={true} />}
      </div>
      <div className="header-center">
        <h1>{title}</h1>
      </div>
      <div className="header-right">
        <div className="status-indicator">
          <span className="status-dot"></span>
          Online
        </div>
      </div>
    </header>
  );
};

export default Header;
