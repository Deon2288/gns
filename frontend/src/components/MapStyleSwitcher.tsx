import React from 'react';
import { MAP_STYLES, MapStyle } from '../utils/mapbox-utils';

interface MapStyleSwitcherProps {
    currentStyle: MapStyle;
    onStyleChange: (style: MapStyle) => void;
}

const STYLE_LABELS: Record<MapStyle, string> = {
    streets: 'Streets',
    light: 'Light',
    dark: 'Dark',
    satellite: 'Satellite',
    outdoors: 'Outdoors',
};

/**
 * A floating panel that lets the user switch between Mapbox map styles.
 * Rendered as an absolutely-positioned overlay; the parent must have
 * `position: relative` (or similar) for correct placement.
 */
const MapStyleSwitcher: React.FC<MapStyleSwitcherProps> = ({ currentStyle, onStyleChange }) => {
    const styles = Object.keys(MAP_STYLES) as MapStyle[];

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 40,
                left: 10,
                zIndex: 1000,
                background: 'rgba(255,255,255,0.95)',
                borderRadius: 8,
                padding: '8px 10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 110,
            }}
            role="group"
            aria-label="Map style switcher"
        >
            <span
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#374151',
                    marginBottom: 2,
                }}
            >
                Map Style
            </span>
            {styles.map((style) => (
                <button
                    key={style}
                    onClick={() => onStyleChange(style)}
                    aria-pressed={currentStyle === style}
                    style={{
                        padding: '5px 10px',
                        borderRadius: 5,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: currentStyle === style ? 700 : 400,
                        background: currentStyle === style ? '#3b82f6' : 'transparent',
                        color: currentStyle === style ? '#fff' : '#374151',
                        textAlign: 'left',
                        transition: 'background 0.15s, color 0.15s',
                    }}
                >
                    {STYLE_LABELS[style]}
                </button>
            ))}
        </div>
    );
};

export default MapStyleSwitcher;
