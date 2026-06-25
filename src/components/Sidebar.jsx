import { useState } from 'react';
import ChatPanel from './ChatPanel';
import UsersPanel from './UsersPanel';
import CommentsPanel from './CommentsPanel';
import { LANG_COLORS, getLang } from '../utils/fileTypes';

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'go', 'rust',
  'java', 'cpp', 'c', 'csharp', 'html', 'css', 'json',
  'sql', 'markdown', 'yaml', 'bash',
];

function FileIcon({ filename }) {
  const lang  = getLang(filename);
  const color = LANG_COLORS[lang] || '#70708a';
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill={color} style={{ flexShrink: 0 }}>
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-3-5V3.5L18.5 9H13z" />
    </svg>
  );
}

function ExplorerPanel({ filesMap, activeFile, onFileClick, onNewFile, onRenameFile, onDeleteFile, onOpenFolder }) {
  const [hovered, setHovered] = useState(null);
  const files = [...(filesMap?.keys() || [])];

  return (
    <div className="sidebar-panel">
      <div className="explorer-header">
        <span className="sidebar-section-title" style={{ padding: 0, border: 0 }}>FILES</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="explorer-folder-btn" onClick={onOpenFolder} title="Open Folder">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
          </button>
          <button className="explorer-add-btn" onClick={onNewFile} title="New File">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="explorer-file-list">
        {files.length === 0 && (
          <div className="explorer-empty">No files yet. Click + to create one.</div>
        )}
        {files.map((filename) => (
          <div
            key={filename}
            className={`explorer-file-row ${filename === activeFile ? 'active' : ''}`}
            onClick={() => onFileClick(filename)}
            onMouseEnter={() => setHovered(filename)}
            onMouseLeave={() => setHovered(null)}
          >
            <FileIcon filename={filename} />
            <span className="explorer-file-name">{filename}</span>
            {hovered === filename && (
              <div className="explorer-file-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="explorer-file-btn"
                  title="Rename"
                  onClick={() => onRenameFile(filename)}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </button>
                <button
                  className="explorer-file-btn danger"
                  title="Delete"
                  onClick={() => onDeleteFile(filename)}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RunPanel({ onRun, running, language }) {
  const unsupported = ['html', 'css', 'markdown', 'yaml', 'json'].includes(language);
  return (
    <div className="sidebar-panel">
      <div className="sidebar-section-title">RUN &amp; DEBUG</div>
      <div className="run-panel-content">
        <button
          className={`run-btn ${running ? 'running' : ''}`}
          onClick={onRun}
          disabled={running || unsupported}
        >
          {running ? (
            <><span className="run-spinner" />Running…</>
          ) : (
            <><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>Run {language}</>
          )}
        </button>
        {unsupported && (
          <p className="run-note">Execution is not available for {language}.</p>
        )}
        <p className="run-note">
          Powered by Judge0. Requires <code>JUDGE0_API_KEY</code> in <code>.env</code>.
        </p>
      </div>
    </div>
  );
}

export default function Sidebar({
  panel, room, peers, language,
  onLanguageChange, running, onRun,
  yChat, user, yComments, onJumpToLine,
  filesMap, activeFile,
  onFileClick, onNewFile, onRenameFile, onDeleteFile, onOpenFolder,
}) {
  const titles = {
    explorer: 'EXPLORER',
    users:    'COLLABORATORS',
    chat:     'CHAT',
    comments: 'COMMENTS',
    run:      'RUN',
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-title">{titles[panel] || panel.toUpperCase()}</div>

      {panel === 'explorer' && (
        <ExplorerPanel
          filesMap={filesMap}
          activeFile={activeFile}
          onFileClick={onFileClick}
          onNewFile={onNewFile}
          onRenameFile={onRenameFile}
          onDeleteFile={onDeleteFile}
          onOpenFolder={onOpenFolder}
        />
      )}
      {panel === 'users' && <UsersPanel peers={peers} />}
      {panel === 'chat' && yChat && (
        <ChatPanel yChat={yChat} userName={user?.username} userColor={user?.color} />
      )}
      {panel === 'comments' && (
        <CommentsPanel yComments={yComments} currentUser={user} onJumpToLine={onJumpToLine} />
      )}
      {panel === 'run' && (
        <RunPanel onRun={onRun} running={running} language={language} />
      )}
    </aside>
  );
}
