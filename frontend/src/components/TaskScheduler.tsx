import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TaskScheduler.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://197.242.150.120:5000';

interface ScheduledTask {
  id: number;
  name: string;
  description: string;
  task_type: string;
  device_ids: number[];
  schedule: string;
  enabled: boolean;
  created_by: number;
  created_at: string;
}

interface TaskExecution {
  id: number;
  task_id: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  result: any;
  error_message: string | null;
  device_id: number;
}

const TASK_TYPES = [
  { value: 'reboot', label: 'Device Reboot', icon: '🔄' },
  { value: 'config_update', label: 'Config Update', icon: '⚙️' },
  { value: 'backup', label: 'Backup', icon: '💾' },
  { value: 'health_check', label: 'Health Check', icon: '🏥' },
  { value: 'metric_collection', label: 'Metric Collection', icon: '📊' },
  { value: 'custom_script', label: 'Custom Script', icon: '📝' },
];

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 8am', value: '0 8 * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every Monday', value: '0 8 * * 1' },
  { label: 'Every Sunday', value: '0 2 * * 0' },
  { label: '1st of every month', value: '0 7 1 * *' },
];

export const TaskScheduler: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'create' | 'history'>('tasks');
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<{
    task: ScheduledTask;
    executions: TaskExecution[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    task_type: 'health_check',
    device_ids: '',
    schedule: '0 8 * * *',
    enabled: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<number | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchQueue();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tasks`);
      setTasks(res.data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tasks/queue`);
      setQueue(res.data);
    } catch (err) {
      console.error('Error fetching queue:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const deviceIds = createForm.device_ids
        .split(',')
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n));

      if (deviceIds.length === 0) {
        setMessage({ type: 'error', text: 'Please enter at least one device ID' });
        setLoading(false);
        return;
      }

      await axios.post(`${API_BASE}/api/tasks`, {
        ...createForm,
        device_ids: deviceIds,
      });
      setMessage({ type: 'success', text: 'Task created successfully!' });
      setCreateForm({
        name: '',
        description: '',
        task_type: 'health_check',
        device_ids: '',
        schedule: '0 8 * * *',
        enabled: true,
      });
      fetchTasks();
      setActiveTab('tasks');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create task' });
    } finally {
      setLoading(false);
    }
  };

  const handleRunTask = async (taskId: number) => {
    setRunningTaskId(taskId);
    try {
      await axios.post(`${API_BASE}/api/tasks/${taskId}/run`);
      setMessage({ type: 'success', text: 'Task queued for immediate execution!' });
      fetchQueue();
      setTimeout(fetchQueue, 3500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to run task' });
    } finally {
      setRunningTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API_BASE}/api/tasks/${taskId}`);
      setMessage({ type: 'success', text: 'Task deleted.' });
      fetchTasks();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete task' });
    }
  };

  const handleToggleEnabled = async (task: ScheduledTask) => {
    try {
      await axios.put(`${API_BASE}/api/tasks/${task.id}`, {
        enabled: !task.enabled,
      });
      fetchTasks();
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleViewHistory = async (task: ScheduledTask) => {
    try {
      const res = await axios.get(`${API_BASE}/api/tasks/${task.id}/history`);
      setSelectedTaskHistory({ task, executions: res.data });
      setActiveTab('history');
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const getTaskTypeInfo = (type: string) => {
    return TASK_TYPES.find((t) => t.value === type) || { icon: '📋', label: type };
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'badge-warning',
      running: 'badge-info',
      success: 'badge-success',
      failed: 'badge-danger',
    };
    return map[status] || 'badge-secondary';
  };

  return (
    <div className="task-container">
      <div className="task-header">
        <h2>⏰ Task Scheduler</h2>
        <p>Schedule automated tasks for your devices — reboots, backups, health checks, and more</p>
      </div>

      {message && (
        <div className={`alert-msg ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {queue.length > 0 && (
        <div className="queue-banner">
          <span>⚡ {queue.length} task(s) currently executing...</span>
        </div>
      )}

      <div className="task-tabs">
        <button
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📋 All Tasks ({tasks.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 Execution History
        </button>
        <button
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ Create Task
        </button>
      </div>

      {activeTab === 'tasks' && (
        <div className="tasks-grid">
          {tasks.length === 0 ? (
            <div className="empty-state">No tasks yet. Create a task to get started.</div>
          ) : (
            tasks.map((task) => {
              const typeInfo = getTaskTypeInfo(task.task_type);
              return (
                <div key={task.id} className={`task-card ${task.enabled ? 'enabled' : 'disabled'}`}>
                  <div className="task-card-header">
                    <div className="task-type-icon">{typeInfo.icon}</div>
                    <div className="task-info">
                      <div className="task-name">{task.name}</div>
                      <div className="task-type-label">{typeInfo.label}</div>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={task.enabled}
                        onChange={() => handleToggleEnabled(task)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>

                  {task.description && (
                    <div className="task-description">{task.description}</div>
                  )}

                  <div className="task-meta">
                    <div className="task-meta-item">
                      <span className="meta-icon">🕐</span>
                      <code>{task.schedule}</code>
                    </div>
                    <div className="task-meta-item">
                      <span className="meta-icon">📡</span>
                      <span>{task.device_ids.length} device(s)</span>
                    </div>
                  </div>

                  <div className="task-actions">
                    <button
                      className="btn-run"
                      onClick={() => handleRunTask(task.id)}
                      disabled={runningTaskId === task.id}
                    >
                      {runningTaskId === task.id ? '⏳ Running...' : '▶️ Run Now'}
                    </button>
                    <button
                      className="btn-history"
                      onClick={() => handleViewHistory(task)}
                    >
                      📜 History
                    </button>
                    <button
                      className="btn-delete-task"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-view">
          {!selectedTaskHistory ? (
            <div className="empty-state">
              Select a task and click "History" to view its execution history.
            </div>
          ) : (
            <div>
              <div className="history-header">
                <h3>
                  {getTaskTypeInfo(selectedTaskHistory.task.task_type).icon}{' '}
                  {selectedTaskHistory.task.name} — Execution History
                </h3>
                <button className="btn-secondary" onClick={() => setSelectedTaskHistory(null)}>
                  ← Back
                </button>
              </div>
              {selectedTaskHistory.executions.length === 0 ? (
                <div className="empty-state">This task has not been executed yet.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Status</th>
                      <th>Device</th>
                      <th>Started</th>
                      <th>Completed</th>
                      <th>Result</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedTaskHistory.executions].reverse().map((exec) => (
                      <tr key={exec.id}>
                        <td>{exec.id}</td>
                        <td>
                          <span className={`badge ${getStatusBadge(exec.status)}`}>
                            {exec.status}
                          </span>
                        </td>
                        <td>#{exec.device_id}</td>
                        <td>{new Date(exec.started_at).toLocaleString()}</td>
                        <td>
                          {exec.completed_at
                            ? new Date(exec.completed_at).toLocaleString()
                            : '—'}
                        </td>
                        <td className="result-cell">
                          {exec.result ? (
                            <code>{JSON.stringify(exec.result)}</code>
                          ) : '—'}
                        </td>
                        <td className="error-cell">{exec.error_message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="create-task-container">
          <form className="create-task-form" onSubmit={handleCreateTask}>
            <h3>Create Scheduled Task</h3>

            <div className="form-group">
              <label>Task Name *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Daily Health Check"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="form-group">
              <label>Task Type *</label>
              <div className="task-type-grid">
                {TASK_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`task-type-btn ${createForm.task_type === t.value ? 'active' : ''}`}
                    onClick={() => setCreateForm({ ...createForm, task_type: t.value })}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Device IDs * (comma-separated)</label>
              <input
                type="text"
                value={createForm.device_ids}
                onChange={(e) => setCreateForm({ ...createForm, device_ids: e.target.value })}
                placeholder="e.g. 1, 2, 3"
                required
              />
            </div>

            <div className="form-group">
              <label>Schedule (Cron Expression) *</label>
              <div className="cron-presets">
                {CRON_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`cron-preset-btn ${createForm.schedule === p.value ? 'active' : ''}`}
                    onClick={() => setCreateForm({ ...createForm, schedule: p.value })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={createForm.schedule}
                onChange={(e) => setCreateForm({ ...createForm, schedule: e.target.value })}
                placeholder="Cron expression"
                required
              />
              <div className="cron-hint">
                Format: <code>minute hour day-of-month month day-of-week</code>
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={createForm.enabled}
                  onChange={(e) => setCreateForm({ ...createForm, enabled: e.target.checked })}
                />
                Enable task immediately
              </label>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : '⏰ Create Task'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
