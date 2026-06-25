import { useState } from 'react';

const AUTO_PORTS = [
  { port: 5173, label: 'Vite Dev Server',  protocol: 'http', auto: true },
  { port: 3001, label: 'Coda API Server',  protocol: 'http', auto: true },
];

function StatusDot({ port }) {
  return <span className="port-dot" title={`localhost:${port}`} />;
}

export default function PortsTab() {
  const [ports, setPorts]       = useState(AUTO_PORTS);
  const [portVal, setPortVal]   = useState('');
  const [labelVal, setLabelVal] = useState('');

  const add = (e) => {
    e.preventDefault();
    const p = parseInt(portVal, 10);
    if (!p || p < 1 || p > 65535) return;
    if (ports.some((x) => x.port === p)) return;
    setPorts((prev) => [
      ...prev,
      { port: p, label: labelVal.trim() || `Port ${p}`, protocol: 'http', auto: false },
    ]);
    setPortVal('');
    setLabelVal('');
  };

  const remove = (port) =>
    setPorts((prev) => prev.filter((p) => p.auto || p.port !== port));

  return (
    <div className="ports-panel">
      <table className="ports-table">
        <thead>
          <tr>
            <th>Port</th>
            <th>Label</th>
            <th>Local Address</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ports.map((p) => (
            <tr key={p.port} className="port-row">
              <td className="port-num">{p.port}</td>
              <td className="port-label-cell">
                <StatusDot port={p.port} />
                {p.label}
              </td>
              <td className="port-addr">
                <a
                  href={`${p.protocol}://localhost:${p.port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="port-link"
                >
                  localhost:{p.port}
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" style={{ marginLeft: 4 }}>
                    <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                  </svg>
                </a>
              </td>
              <td className="port-actions">
                {!p.auto && (
                  <button className="port-remove-btn" onClick={() => remove(p.port)} title="Remove">✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="ports-add-row" onSubmit={add}>
        <input
          className="ports-input"
          type="number"
          min="1"
          max="65535"
          value={portVal}
          onChange={(e) => setPortVal(e.target.value)}
          placeholder="Port"
        />
        <input
          className="ports-input ports-label-input"
          value={labelVal}
          onChange={(e) => setLabelVal(e.target.value)}
          placeholder="Label (optional)"
        />
        <button type="submit" className="btn-secondary" disabled={!portVal}>
          Add Port
        </button>
      </form>
    </div>
  );
}
