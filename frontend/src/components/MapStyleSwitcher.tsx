import React from 'react';
import { MAP_STYLES, MapStyle } from '../utils/mapbox-utils';

interface MapStyleSwitcherProps {
  currentStyle: MapStyle;
  onChange: (style: MapStyle) => void;
}

const STYLE_LABELS: Record<MapStyle, string> = {
  streets: 'Streets',
  outdoors: 'Outdoors',
  light: 'Light',
  dark: 'Dark',
  satellite: 'Satellite',
  'satellite-streets': 'Satellite + Streets',
};

const MapStyleSwitcher: React.FC<MapStyleSwitcherProps> = ({
  currentStyle,
  onChange,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1,
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 160,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: '#6b7280',
          letterSpacing: '0.05em',
          marginBottom: 2,
        }}
      >
        Map Style
      </span>
      {(Object.keys(MAP_STYLES) as MapStyle[]).map((style) => (
        <button
          key={style}
          onClick={() => onChange(style)}
          style={{
            padding: '6px 10px',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            textAlign: 'left',
            background: currentStyle === style ? '#3b82f6' : 'transparent',
            color: currentStyle === style ? 'white' : '#374151',
            fontWeight: currentStyle === style ? 600 : 400,
            transition: 'background 0.15s, color 0.15s',
          }}
          aria-pressed={currentStyle === style}
        >
          {STYLE_LABELS[style]}
        </button>
      ))}
    </div>
  );
};

export default MapStyleSwitcher;
