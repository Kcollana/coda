import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export default function TerminalTab({ active, instanceId }) {
  const containerRef = useRef(null);
  const termRef      = useRef(null);
  const fitRef       = useRef(null);
  const wsRef        = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting | open | closed

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background:    '#0d0d12',
        foreground:    '#d0d0e8',
        cursor:        '#a78bfa',
        cursorAccent:  '#0d0d12',
        selectionBackground: '#7c3aed40',
        black:         '#1e1e2c',
        red:           '#f87171',
        green:         '#10b981',
        yellow:        '#fbbf24',
        blue:          '#60a5fa',
        magenta:       '#c084fc',
        cyan:          '#22d3ee',
        white:         '#d0d0e8',
        brightBlack:   '#30304a',
        brightRed:     '#fca5a5',
        brightGreen:   '#34d399',
        brightYellow:  '#fde68a',
        brightBlue:    '#93c5fd',
        brightMagenta: '#e879f9',
        brightCyan:    '#67e8f9',
        brightWhite:   '#f0f0fa',
      },
      fontFamily: "'JetBrains Mono','Cascadia Code','Fira Code',Consolas,monospace",
      fontSize: 13,
      lineHeight: 1.45,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 2000,
      allowProposedApi: true,
    });

    const fitAddon      = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current  = fitAddon;

    const token = localStorage.getItem('coda-token');
    const proto  = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws     = new WebSocket(`${proto}://${location.host}/terminal?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      fitAddon.fit();
      ws.send(JSON.stringify({ type: 'resize', data: { cols: term.cols, rows: term.rows } }));
    };

    ws.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data);
        if (type === 'data') term.write(data);
        if (type === 'exit') {
          term.write('\r\n\x1b[33m[Process exited — press any key to reconnect]\x1b[0m\r\n');
          setStatus('closed');
        }
      } catch {}
    };

    ws.onerror = () => {
      term.write('\x1b[31mFailed to connect to terminal server\x1b[0m\r\n');
      setStatus('closed');
    };

    ws.onclose = () => setStatus((s) => (s === 'open' ? 'closed' : s));

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', data: { cols, rows } }));
      }
    });

    const ro = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch {}
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, [instanceId]); // remount only when instanceId changes (new terminal button)

  // Refit when tab becomes visible
  useEffect(() => {
    if (active) setTimeout(() => { try { fitRef.current?.fit(); } catch {} }, 30);
  }, [active]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {status === 'closed' && (
        <div className="term-reconnect-bar">
          Terminal disconnected.
          <button onClick={() => window.location.reload()}>Reconnect</button>
        </div>
      )}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', padding: '4px 6px' }} />
    </div>
  );
}
