import { useEffect, useRef } from 'react';

function classifyLine(line) {
  const l = line.toLowerCase();
  if (/^\s*(error|exception|traceback|fatal|✕|×)/.test(l)) return 'error';
  if (/^\s*(warn(ing)?|⚠|deprecated)/.test(l))            return 'warn';
  if (/^\s*(info|log|debug|›|\[log\])/.test(l))            return 'info';
  return 'log';
}

function prefix(type) {
  if (type === 'error') return '✕'; // ✕
  if (type === 'warn')  return '⚠'; // ⚠
  if (type === 'info')  return 'ℹ'; // ℹ
  return '›';
}

export default function DebugConsoleTab({ output, running }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const lines = [];

  if (output?.stdout) {
    output.stdout.split('\n').forEach((text, i) => {
      if (text) lines.push({ key: `o${i}`, src: 'stdout', type: classifyLine(text), text });
    });
  }
  if (output?.stderr) {
    output.stderr.split('\n').forEach((text, i) => {
      if (text) lines.push({ key: `e${i}`, src: 'stderr', type: 'error', text });
    });
  }

  return (
    <div className="debug-console">
      {running && (
        <div className="panel-running">
          <span className="panel-spinner" /> Running…
        </div>
      )}

      {lines.length === 0 && !running && (
        <div className="panel-empty">No debug output yet. Run code to see console output.</div>
      )}

      {lines.map((line) => (
        <div key={line.key} className={`debug-line debug-${line.type}`}>
          <span className="debug-prefix">{prefix(line.type)}</span>
          <span className="debug-text">{line.text}</span>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
