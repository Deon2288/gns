import React from 'react';

export interface LayerConfig {
  id: string;
  label: string;
  enabled: boolean;
}

interface MapLayerControlProps {
  layers: LayerConfig[];
  onChange: (id: string, enabled: boolean) => void;
}

const MapLayerControl: React.FC<MapLayerControlProps> = ({
  layers,
  onChange,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1,
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        padding: '8px 12px',
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
          display: 'block',
          marginBottom: 6,
        }}
      >
        Layers
      </span>
      {layers.map((layer) => (
        <label
          key={layer.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            cursor: 'pointer',
            fontSize: 13,
            color: '#374151',
          }}
        >
          <input
            type="checkbox"
            checked={layer.enabled}
            onChange={(e) => onChange(layer.id, e.target.checked)}
            style={{ cursor: 'pointer' }}
            aria-label={layer.label}
          />
          {layer.label}
        </label>
      ))}
    </div>
  );
};

export default MapLayerControl;
