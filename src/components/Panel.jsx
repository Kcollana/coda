import { useState, useCallback } from 'react';
import TerminalTab     from './panel/TerminalTab';
import OutputTab       from './panel/OutputTab';
import DebugConsoleTab from './panel/DebugConsoleTab';
import ProblemsTab     from './panel/ProblemsTab';
import PortsTab        from './panel/PortsTab';
import LogsTab         from './panel/LogsTab';

const STATIC_TABS = ['OUTPUT', 'DEBUG CONSOLE', 'PROBLEMS', 'PORTS', 'LOGS'];

export default function Panel({
  output, running, onClose,
  editorRef, monacoRef, activeFile,
  yChangeLogs, onJumpTo,
}) {
  // terminals: array of { id, label }
  const [terminals, setTerminals] = useState([{ id: 1, label: 'Terminal 1' }]);
  const [termCounter, setTermCounter] = useState(2);
  const [activeTab, setActiveTab] = useState('term-1');

  const newTerminal = useCallback(() => {
    const id    = termCounter;
    const label = `Terminal ${id}`;
    setTermCounter((c) => c + 1);
    setTerminals((prev) => [...prev, { id, label }]);
    setActiveTab(`term-${id}`);
  }, [termCounter]);

  const closeTerminal = useCallback((id) => {
    setTerminals((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTab === `term-${id}`) {
        // switch to adjacent terminal or first static tab
        const idx = prev.findIndex((t) => t.id === id);
        const fallback = next[Math.min(idx, next.length - 1)];
        setActiveTab(fallback ? `term-${fallback.id}` : 'OUTPUT');
      }
      return next;
    });
  }, [activeTab]);

  const allTabs = [
    ...terminals.map((t) => ({ key: `term-${t.id}`, label: t.label, closeable: terminals.length > 1, termId: t.id })),
    ...STATIC_TABS.map((label) => ({ key: label, label, closeable: false })),
  ];

  return (
    <div className="panel">
      {/* Tab bar */}
      <div className="panel-tabs">
        {allTabs.map((tab) => (
          <div
            key={tab.key}
            className={`panel-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.closeable && (
              <button
                className="panel-tab-close"
                onClick={(e) => { e.stopPropagation(); closeTerminal(tab.termId); }}
                aria-label="Close terminal"
              >×</button>
            )}
          </div>
        ))}

        <button className="panel-new-terminal" onClick={newTerminal} title="New Terminal">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>

        <div className="panel-tab-spacer" />

        <button className="panel-close" onClick={onClose} title="Close panel">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="panel-body">
        {terminals.map((t) => (
          <div
            key={t.id}
            className="panel-pane"
            style={{ display: activeTab === `term-${t.id}` ? 'flex' : 'none' }}
          >
            <TerminalTab active={activeTab === `term-${t.id}`} instanceId={t.id} />
          </div>
        ))}

        {activeTab === 'OUTPUT' && (
          <div className="panel-pane panel-content">
            <OutputTab output={output} running={running} />
          </div>
        )}

        {activeTab === 'DEBUG CONSOLE' && (
          <div className="panel-pane panel-content">
            <DebugConsoleTab output={output} running={running} />
          </div>
        )}

        {activeTab === 'PROBLEMS' && (
          <div className="panel-pane panel-content">
            <ProblemsTab
              editorRef={editorRef}
              monacoRef={monacoRef}
              activeFile={activeFile}
              onJumpTo={onJumpTo}
            />
          </div>
        )}

        {activeTab === 'PORTS' && (
          <div className="panel-pane panel-content">
            <PortsTab />
          </div>
        )}

        {activeTab === 'LOGS' && (
          <div className="panel-pane panel-content">
            <LogsTab yChangeLogs={yChangeLogs} />
          </div>
        )}
      </div>
    </div>
  );
}
