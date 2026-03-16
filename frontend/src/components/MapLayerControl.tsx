import React from 'react';

export interface LayerVisibility {
    roads: boolean;
    traffic: boolean;
    boundaries: boolean;
    labels: boolean;
    heatmap: boolean;
    geofences: boolean;
    deviceTrails: boolean;
}

interface MapLayerControlProps {
    layers: LayerVisibility;
    onToggle: (layer: keyof LayerVisibility) => void;
}

const LAYER_LABELS: Record<keyof LayerVisibility, string> = {
    roads: 'Roads',
    traffic: 'Traffic',
    boundaries: 'Boundaries',
    labels: 'Labels',
    heatmap: 'Heatmap',
    geofences: 'Geofences',
    deviceTrails: 'Device Trails',
};

/**
 * A floating panel that provides toggle switches for individual map layers.
 */
const MapLayerControl: React.FC<MapLayerControlProps> = ({ layers, onToggle }) => {
    const layerKeys = Object.keys(layers) as Array<keyof LayerVisibility>;

    return (
        <div
            style={{
                position: 'absolute',
                top: 50,
                right: 10,
                zIndex: 1000,
                background: 'rgba(255,255,255,0.95)',
                borderRadius: 8,
                padding: '8px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                minWidth: 160,
            }}
            role="group"
            aria-label="Map layer controls"
        >
            <span
                style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#374151',
                    marginBottom: 6,
                }}
            >
                Layers
            </span>
            {layerKeys.map((key) => (
                <label
                    key={key}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '3px 0',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: '#374151',
                        userSelect: 'none',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={layers[key]}
                        onChange={() => onToggle(key)}
                        style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
                    />
                    {LAYER_LABELS[key]}
                </label>
            ))}
        </div>
    );
};

export default MapLayerControl;
