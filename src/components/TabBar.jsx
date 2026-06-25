import { LANG_COLORS, getLang } from '../utils/fileTypes';

function FileIcon({ filename, size = 13 }) {
  const lang  = getLang(filename);
  const color = LANG_COLORS[lang] || '#70708a';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ flexShrink: 0 }}>
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  );
}

export default function TabBar({ tabs, activeFile, onTabClick, onTabClose, onRun, running, onShare, copied }) {
  return (
    <div className="tab-bar">
      <div className="tabs" role="tablist">
        {tabs.map((filename) => (
          <div
            key={filename}
            role="tab"
            aria-selected={filename === activeFile}
            className={`tab ${filename === activeFile ? 'active' : ''}`}
            onClick={() => onTabClick(filename)}
            title={filename}
          >
            <FileIcon filename={filename} />
            <span className="tab-name">{filename}</span>
            <button
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); onTabClose(filename); }}
              title="Close"
              aria-label={`Close ${filename}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="tab-bar-actions">
        <button
          className={`tab-action-btn run-tab-btn ${running ? 'running' : ''}`}
          onClick={onRun}
          disabled={running}
          title="Run code (Ctrl+Enter)"
        >
          {running ? (
            <span className="run-spinner-sm" />
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
          {running ? 'Running…' : 'Run'}
        </button>
        <button className="tab-action-btn share-btn-tab" onClick={onShare} title="Copy share link">
          {copied ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" /></svg>
          )}
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>
    </div>
  );
}
