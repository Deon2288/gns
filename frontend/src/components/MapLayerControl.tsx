import React, { useState } from 'react';

export interface LayerState {
    roads: boolean;
    traffic: boolean;
    boundaries: boolean;
    labels: boolean;
    heatmap: boolean;
    geofences: boolean;
}

interface MapLayerControlProps {
    layers: LayerState;
    onToggle: (layer: keyof LayerState) => void;
}

const LAYER_LABELS: Record<keyof LayerState, string> = {
    roads: '🛣️ Roads',
    traffic: '🚦 Traffic',
    boundaries: '🗾 Boundaries',
    labels: '🏷️ Labels',
    heatmap: '🌡️ Heatmap',
    geofences: '📐 Geofences',
};

/**
 * A floating panel with toggle switches for individual map layers.
 */
const MapLayerControl: React.FC<MapLayerControlProps> = ({ layers, onToggle }) => {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div style={containerStyle}>
            <button
                style={headerStyle}
                onClick={() => setCollapsed((c) => !c)}
                aria-expanded={!collapsed}
            >
                <span>Layers</span>
                <span style={{ fontSize: '10px' }}>{collapsed ? '▶' : '▼'}</span>
            </button>
            {!collapsed && (
                <div style={listStyle}>
                    {(Object.keys(layers) as Array<keyof LayerState>).map((key) => (
                        <label key={key} style={rowStyle}>
                            <input
                                type="checkbox"
                                checked={layers[key]}
                                onChange={() => onToggle(key)}
                                style={{ marginRight: '6px', cursor: 'pointer' }}
                            />
                            {LAYER_LABELS[key]}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '220px',
    right: '10px',
    zIndex: 10,
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    minWidth: '160px',
    overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.05em',
};

const listStyle: React.CSSProperties = {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
};

const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    cursor: 'pointer',
    userSelect: 'none',
};

export default MapLayerControl;
