import React from 'react';

interface SimData {
  sim_status: string | null;
  data_used_mb: number | null;
  data_limit_mb: number | null;
  balance: number | null;
  operator: string | null;
}

interface Props {
  simData: SimData | null;
}

export const SimMetricsCard: React.FC<Props> = ({ simData }) => {
  if (!simData || !simData.sim_status) {
    return (
      <div className="sim-metrics-card sim-metrics-no-sim">
        <span>No SIM</span>
      </div>
    );
  }

  const statusColor =
    simData.sim_status === 'active'
      ? '#22c55e'
      : simData.sim_status === 'suspended'
      ? '#ef4444'
      : '#f59e0b';

  const usagePct =
    simData.data_used_mb !== null && simData.data_limit_mb && simData.data_limit_mb > 0
      ? Math.min(100, (simData.data_used_mb / simData.data_limit_mb) * 100)
      : null;

  return (
    <div className="sim-metrics-card">
      <span className="sim-status-badge" style={{ background: statusColor }}>
        {simData.sim_status}
      </span>
      {usagePct !== null && (
        <span className="sim-metrics-usage">
          {usagePct.toFixed(0)}%
        </span>
      )}
      {simData.balance !== null && (
        <span className="sim-metrics-balance">R{Number(simData.balance).toFixed(2)}</span>
      )}
      {simData.operator && (
        <span className="sim-metrics-operator">{simData.operator}</span>
      )}
    </div>
  );
};
