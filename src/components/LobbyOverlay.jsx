export default function LobbyOverlay({ status, roomName, onRetry }) {
  return (
    <div className="lobby-overlay">
      {(status === 'connecting') && (
        <div className="lobby-card">
          <div className="lobby-spinner" />
          <h2 className="lobby-title">Connecting…</h2>
        </div>
      )}

      {status === 'waiting' && (
        <div className="lobby-card">
          <div className="lobby-spinner" />
          <h2 className="lobby-title">Waiting for approval</h2>
          <p className="lobby-sub">
            The room creator must approve your access to{' '}
            <strong>{roomName || 'this room'}</strong>.
          </p>
        </div>
      )}

      {status === 'rejected' && (
        <div className="lobby-card lobby-rejected">
          <div className="lobby-icon">✕</div>
          <h2 className="lobby-title">Access denied</h2>
          <p className="lobby-sub">The creator declined your request to join.</p>
          <button className="btn-primary" onClick={onRetry} style={{ marginTop: '1rem' }}>
            Request again
          </button>
        </div>
      )}
    </div>
  );
}
