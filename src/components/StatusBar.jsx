export default function StatusBar({ connected, language, peers, cursorPos, onTogglePanel }) {
  return (
    <div className={`status-bar ${connected ? 'connected' : ''}`}>
      <div className="status-left">
        <div className="status-item">
          <span className="status-conn-dot" />
          <span className="status-conn-label">{connected ? 'Connected' : 'Connecting…'}</span>
        </div>
      </div>

      <div className="status-right">
        <button className="status-item" onClick={onTogglePanel} title="Toggle output panel">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <path d="M20 3H4v10c0 1.1.9 2 2 2h6v2H8v2h8v-2h-4v-2h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H6V5h14v10z" />
          </svg>
          Output
        </button>

        <div className="status-item">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
          {peers.length} {peers.length === 1 ? 'user' : 'users'}
        </div>

        <div className="status-item">{language}</div>

        <div className="status-item">Ln {cursorPos.line}, Col {cursorPos.column}</div>

        <div className="status-item">UTF-8</div>
      </div>
    </div>
  );
}
