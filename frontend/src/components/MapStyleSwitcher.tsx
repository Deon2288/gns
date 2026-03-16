import React from 'react';
import { MAP_STYLES } from '../utils/mapbox-utils';

interface MapStyleSwitcherProps {
    currentStyle: string;
    onStyleChange: (styleKey: string) => void;
}

const STYLE_LABELS: Record<string, string> = {
    light: '☀️ Light',
    dark: '🌙 Dark',
    satellite: '🛰️ Satellite',
    streets: '🗺️ Streets',
    outdoors: '🏔️ Outdoors',
};

/**
 * A floating panel that lets the user switch between Mapbox map styles.
 */
const MapStyleSwitcher: React.FC<MapStyleSwitcherProps> = ({ currentStyle, onStyleChange }) => {
    return (
        <div style={containerStyle}>
            <div style={titleStyle}>Map Style</div>
            {Object.keys(MAP_STYLES).map((key) => (
                <button
                    key={key}
                    onClick={() => onStyleChange(key)}
                    style={{
                        ...buttonStyle,
                        ...(currentStyle === key ? activeButtonStyle : {}),
                    }}
                    title={key.charAt(0).toUpperCase() + key.slice(1)}
                >
                    {STYLE_LABELS[key] ?? key}
                </button>
            ))}
        </div>
    );
};

const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: 10,
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '8px',
    padding: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '130px',
};

const titleStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#666',
    marginBottom: '4px',
    paddingBottom: '4px',
    borderBottom: '1px solid #eee',
};

const buttonStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    background: '#f9f9f9',
    cursor: 'pointer',
    fontSize: '12px',
    textAlign: 'left',
    transition: 'background 0.15s',
};

const activeButtonStyle: React.CSSProperties = {
    background: '#3b82f6',
    color: '#fff',
    borderColor: '#2563eb',
};

export default MapStyleSwitcher;
