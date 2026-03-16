import React, { useEffect, useState } from 'react';
import { notifications as notifApi } from '../services/api';
import { Notification } from '../types';

const TYPE_ICONS: Record<string, string> = {
  alert: '🔔',
  info: 'ℹ️',
  warning: '⚠️',
  success: '✅',
  system: '⚙️',
};

const Notifications: React.FC = () => {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    notifApi.getAll()
      .then((d: any) => setList(Array.isArray(d) ? d : d.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await notifApi.markRead(id);
      setList((prev) => prev.map((n) => n.notification_id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    const unread = list.filter((n) => !n.is_read);
    await Promise.all(unread.map((n) => notifApi.markRead(n.notification_id).catch(() => {})));
    setList((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = list.filter((n) => !n.is_read).length;

  const s: Record<string, React.CSSProperties> = {
    page: { padding: 24, color: '#ccd6f6' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 700, color: '#ccd6f6', margin: 0 },
    btn: { padding: '8px 16px', background: '#e94560', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 },
    item: {
      display: 'flex',
      gap: 14,
      padding: '14px 16px',
      borderRadius: 8,
      marginBottom: 8,
      alignItems: 'flex-start',
      cursor: 'pointer',
    },
    icon: { fontSize: 22, flexShrink: 0, paddingTop: 2 },
    content: { flex: 1 },
    notifTitle: { fontWeight: 600, fontSize: 14, marginBottom: 3 },
    message: { color: '#8892b0', fontSize: 13, lineHeight: 1.5 },
    meta: { color: '#8892b0', fontSize: 11, marginTop: 6 },
    markReadBtn: { padding: '4px 10px', background: 'transparent', border: '1px solid #8892b0', borderRadius: 4, color: '#8892b0', cursor: 'pointer', fontSize: 11, flexShrink: 0 },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Notifications</h2>
          {unreadCount > 0 && (
            <span style={{ color: '#e94560', fontSize: 13 }}>{unreadCount} unread</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button style={s.btn} onClick={handleMarkAllRead}>Mark All as Read</button>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#8892b0' }}>Loading...</div>
      ) : list.length === 0 ? (
        <div style={{ color: '#8892b0', fontSize: 14 }}>No notifications</div>
      ) : (
        list.map((n) => (
          <div
            key={n.notification_id}
            style={{
              ...s.item,
              background: n.is_read ? '#0f3460' : 'rgba(233,69,96,0.08)',
              border: n.is_read ? '1px solid #1a1a2e' : '1px solid rgba(233,69,96,0.3)',
            }}
          >
            <div style={s.icon}>{TYPE_ICONS[n.notification_type] || '📬'}</div>
            <div style={s.content}>
              <div style={{ ...s.notifTitle, color: n.is_read ? '#ccd6f6' : '#fff' }}>{n.title}</div>
              <div style={s.message}>{n.message}</div>
              <div style={s.meta}>
                {new Date(n.created_at).toLocaleString()}
                {' · '}
                <span style={{ textTransform: 'capitalize' }}>{n.notification_type}</span>
              </div>
            </div>
            {!n.is_read && (
              <button style={s.markReadBtn} onClick={() => handleMarkRead(n.notification_id)}>
                Mark Read
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default Notifications;
