import { useState, useEffect } from 'react';

const TYPE_META = {
  edit:             { icon: '✎', color: 'var(--fg2)' },
  file_created:     { icon: '+', color: 'var(--green)' },
  file_deleted:     { icon: '−', color: 'var(--red)' },
  file_renamed:     { icon: '⟳', color: 'var(--yellow)' },
  folder_opened:    { icon: '⊞', color: 'var(--cyan)' },
  code_run:         { icon: '▶', color: 'var(--cyan)' },
  user_joined:      { icon: '→', color: 'var(--accent-h)' },
  user_left:        { icon: '←', color: 'var(--fg3)' },
  language_changed: { icon: '⬡', color: 'var(--blue)' },
};

function fmt(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function logText(entry) {
  const u = entry.user || 'Someone';
  switch (entry.type) {
    case 'edit':
      return `${u} edited ${entry.file}${
        entry.details ? ` (+${entry.details.added || 0} −${entry.details.removed || 0})` : ''
      }`;
    case 'file_created':    return `${u} created ${entry.file}`;
    case 'file_deleted':    return `${u} deleted ${entry.file}`;
    case 'file_renamed':    return `${u} renamed ${entry.details?.from} → ${entry.details?.to}`;
    case 'folder_opened':   return `${u} opened a folder (${entry.details?.count || '?'} files)`;
    case 'code_run':        return `${u} ran ${entry.file || entry.details?.language || ''}${
      entry.details?.status ? ` [${entry.details.status}]` : ''
    }`;
    case 'user_joined':     return `${u} joined the room`;
    case 'user_left':       return `${u} left the room`;
    case 'language_changed': return `${u} changed language to ${entry.details?.language}`;
    default:                return `${u}: ${entry.type}`;
  }
}

export default function LogsTab({ yChangeLogs }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!yChangeLogs) return;
    const update = () => setLogs([...yChangeLogs.toArray()].reverse());
    update();
    yChangeLogs.observe(update);
    return () => yChangeLogs.unobserve(update);
  }, [yChangeLogs]);

  return (
    <div className="logs-panel">
      {logs.length === 0 && (
        <span className="panel-empty">No activity yet.</span>
      )}
      {logs.map((entry, i) => {
        const meta = TYPE_META[entry.type] || { icon: '·', color: 'var(--fg3)' };
        return (
          <div key={i} className="log-entry">
            <span className="log-icon" style={{ color: meta.color }}>{meta.icon}</span>
            <span className="log-text">{logText(entry)}</span>
            <span className="log-time">{fmt(entry.timestamp)}</span>
          </div>
        );
      })}
    </div>
  );
}
