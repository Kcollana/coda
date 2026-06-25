import { useEffect, useRef } from 'react';

const STATUS_COLOR = {
  'Accepted':           '#4ec9b0',
  'Wrong Answer':       '#f48771',
  'Time Limit Exceeded':'#e5c07b',
  'Runtime Error':      '#f48771',
  'Compilation Error':  '#f48771',
  'Error':              '#f48771',
  'Running…':          '#61afef',
};

export default function OutputTab({ output, running }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const statusColor = STATUS_COLOR[output?.status] || '#abb2bf';

  return (
    <div className="output-tab">
      {running && !output?.stdout && !output?.stderr && (
        <div className="panel-running">
          <span className="panel-spinner" />
          Executing…
        </div>
      )}

      {output && (
        <>
          <div className="panel-status-line">
            <span style={{ color: statusColor }}>● {output.status}</span>
            {output.time   && <span className="panel-meta">{output.time}s</span>}
            {output.memory && <span className="panel-meta">{(output.memory / 1024).toFixed(1)} MB</span>}
          </div>
          {output.stdout && <pre className="panel-output stdout">{output.stdout}</pre>}
          {output.stderr && <pre className="panel-output stderr">{output.stderr}</pre>}
          {!output.stdout && !output.stderr && (
            <pre className="panel-output muted">(no output)</pre>
          )}
        </>
      )}

      {!running && !output && (
        <div className="panel-empty">Run your code to see output here.</div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
