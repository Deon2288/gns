import React from 'react';
import './Logo.css';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', showText = true }) => {
  const sizeMap = {
    small: '32px',
    medium: '48px',
    large: '64px',
  };

  return (
    <div className={`gns-logo gns-logo-${size}`}>
      <img
        src={`${process.env.PUBLIC_URL}/logo192.png`}
        alt="GNS Logo"
        className="logo-image"
        style={{ height: sizeMap[size], width: sizeMap[size] }}
      />
      {showText && <span className="logo-text">GNS</span>}
    </div>
  );
};

export default Logo;
