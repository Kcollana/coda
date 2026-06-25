import { useState, useEffect, useCallback } from 'react';

const SEV = { 8: 'error', 4: 'warning', 2: 'info', 1: 'hint' };

function SevIcon({ level }) {
  if (level === 8) return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" className="prob-icon error">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
  if (level === 4) return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" className="prob-icon warning">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" className="prob-icon info">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  );
}

export default function ProblemsTab({ editorRef, monacoRef, activeFile, onJumpTo }) {
  const [markers, setMarkers] = useState([]);

  const refresh = useCallback(() => {
    const monaco = monacoRef?.current;
    const editor = editorRef?.current;
    if (!monaco || !editor) { setMarkers([]); return; }
    const model = editor.getModel();
    if (!model) { setMarkers([]); return; }
    setMarkers(monaco.editor.getModelMarkers({ resource: model.uri }));
  }, [editorRef, monacoRef]);

  useEffect(() => {
    refresh();
    const monaco = monacoRef?.current;
    if (!monaco) return;
    const d = monaco.editor.onDidChangeMarkers(refresh);
    return () => d.dispose();
  }, [refresh, activeFile]);

  const errors   = markers.filter((m) => m.severity === 8).length;
  const warnings = markers.filter((m) => m.severity === 4).length;

  return (
    <div className="problems-panel">
      <div className="problems-summary">
        {errors > 0   && <span className="prob-count error"><span>✕</span> {errors} error{errors   !== 1 ? 's' : ''}</span>}
        {warnings > 0 && <span className="prob-count warning"><span>⚠</span> {warnings} warning{warnings !== 1 ? 's' : ''}</span>}
        {markers.length === 0 && <span className="prob-count ok">✓ No problems detected</span>}
      </div>

      <div className="problems-list">
        {markers.map((m, i) => (
          <div
            key={i}
            className={`problem-row problem-${SEV[m.severity] || 'info'}`}
            onClick={() => onJumpTo?.(m.startLineNumber, m.startColumn)}
            title={`${activeFile}:${m.startLineNumber}:${m.startColumn}`}
          >
            <SevIcon level={m.severity} />
            <span className="prob-message">{m.message}</span>
            <span className="prob-source">{m.source || 'ts'}</span>
            <span className="prob-location">{activeFile} [{m.startLineNumber},{m.startColumn}]</span>
          </div>
        ))}
      </div>
    </div>
  );
}
