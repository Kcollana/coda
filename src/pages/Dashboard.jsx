import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'go', 'rust',
  'java', 'cpp', 'csharp', 'html', 'css', 'bash',
];

const LANG_ICONS = {
  javascript: 'JS', typescript: 'TS', python: 'PY', go: 'GO',
  rust: 'RS', java: 'JA', cpp: 'C+', csharp: 'C#',
  html: 'HT', css: 'CS', bash: 'SH',
};

const AGO = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', language: 'javascript' });
  const [showForm, setShowForm] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/rooms')
      .then(({ data }) => setRooms(data))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post('/rooms', form);
      navigate(`/room/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room');
      setCreating(false);
    }
  };

  const deleteRoom = async (id, e) => {
    e.stopPropagation();
    await api.delete(`/rooms/${id}`);
    setRooms((r) => r.filter((x) => x._id !== id));
  };

  return (
    <div className="dashboard">
      <aside className="dash-sidebar">
        <div className="dash-logo">coda</div>
        <nav className="dash-nav">
          <div className="dash-nav-item active">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
            My Rooms
          </div>
        </nav>
        <div className="dash-user">
          <div className="dash-avatar" style={{ background: user?.color || '#61afef' }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="dash-username">{user?.username}</div>
          <button className="dash-logout" onClick={logout} title="Sign out">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <header className="dash-header">
          <div>
            <h1>My Rooms</h1>
            <p>Select a room to start collaborating, or create a new one.</p>
          </div>
          <div className="dash-header-actions">
            <div className="join-row">
              <input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Paste room ID to join…"
                className="join-input"
                onKeyDown={(e) => e.key === 'Enter' && joinId.trim() && navigate(`/room/${joinId.trim()}`)}
              />
              <button
                className="btn-secondary"
                disabled={!joinId.trim()}
                onClick={() => navigate(`/room/${joinId.trim()}`)}
              >
                Join
              </button>
            </div>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + New Room
            </button>
          </div>
        </header>

        {showForm && (
          <div className="modal-backdrop" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>New Room</h2>
              <form onSubmit={createRoom}>
                <div className="field">
                  <label>Room name</label>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Algorithm practice"
                    required
                  />
                </div>
                <div className="field">
                  <label>Language</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  >
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                {error && <div className="form-error">{error}</div>}
                <div className="modal-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={creating}>
                    {creating ? 'Creating…' : 'Create Room'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="dash-empty">Loading rooms…</div>
        ) : rooms.length === 0 ? (
          <div className="dash-empty">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" opacity=".2"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
            <p>No rooms yet. Create your first room to start collaborating.</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>Create Room</button>
          </div>
        ) : (
          <div className="room-grid">
            {rooms.map((room) => (
              <div
                key={room._id}
                className="room-card"
                onClick={() => navigate(`/room/${room._id}`)}
              >
                <div className="room-card-header">
                  <span className="room-lang-badge">{LANG_ICONS[room.language] || room.language.slice(0, 2).toUpperCase()}</span>
                  <button
                    className="room-delete"
                    onClick={(e) => deleteRoom(room._id, e)}
                    title="Delete room"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  </button>
                </div>
                <div className="room-card-name">{room.name}</div>
                <div className="room-card-meta">
                  <span>{room.language}</span>
                  <span>{AGO(room.createdAt)}</span>
                </div>
                <div className="room-card-id">{room._id}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
