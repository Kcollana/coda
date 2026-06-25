export default function UsersPanel({ peers }) {
  return (
    <div className="sidebar-panel">
      <div className="sidebar-section-title">ONLINE — {peers.length}</div>
      <div className="users-list">
        {peers.length === 0 && (
          <div className="users-empty">No other users connected.</div>
        )}
        {peers.map((p, i) => (
          <div key={`${p.id}-${i}`} className="user-row">
            <div className="user-dot" style={{ background: p.color }} />
            <span className="user-name">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
