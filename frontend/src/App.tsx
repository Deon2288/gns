import React, { useState } from 'react';
import './App.css';
import MapContainer from './components/MapContainer';
import Dashboard from './components/Dashboard';
import AlertsPanel from './components/AlertsPanel';
import DeviceAdmin from './components/DeviceAdmin';

type Tab = 'map' | 'dashboard' | 'alerts' | 'admin';

const TABS: { id: Tab; label: string }[] = [
  { id: 'map',       label: '🗺  Map'       },
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'alerts',    label: '🔔 Alerts'    },
  { id: 'admin',     label: '⚙️  Devices'   },
];

const App: React.FC = () => {
  const [active, setActive] = useState<Tab>('map');

  return (
    <div className="gns-shell">
      <nav className="gns-nav">
        <span className="gns-nav-brand">GNS</span>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`gns-tab${active === t.id ? ' active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="gns-content">
        {active === 'map'       && <MapContainer />}
        {active === 'dashboard' && <div className="gns-panel"><Dashboard /></div>}
        {active === 'alerts'    && <div className="gns-panel"><AlertsPanel /></div>}
        {active === 'admin'     && <div className="gns-panel"><DeviceAdmin /></div>}
      </div>
    </div>
  );
};

export default App;
