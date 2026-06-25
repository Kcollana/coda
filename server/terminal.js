const jwt    = require('jsonwebtoken');
const os     = require('os');

let pty = null;
try { pty = require('node-pty'); } catch (e) {
  console.warn('[terminal] node-pty unavailable, falling back to spawn:', e.message);
}

const SECRET = process.env.JWT_SECRET || 'coda_dev_secret_change_in_production';

const SHELL = process.platform === 'win32'
  ? (process.env.COMSPEC || 'cmd.exe')
  : (process.env.SHELL || '/bin/bash');

module.exports = function handleTerminal(ws, req) {
  const url   = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');

  try {
    jwt.verify(token, SECRET);
  } catch {
    ws.close(1008, 'Unauthorized');
    return;
  }

  const send = (type, data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type, data }));
  };

  if (pty) {
    const term = pty.spawn(SHELL, [], {
      name: 'xterm-256color',
      cols: 80, rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: process.env,
    });

    term.onData((data) => send('data', data));
    term.onExit(() => { send('exit', null); try { ws.close(); } catch {} });

    ws.on('message', (raw) => {
      try {
        const { type, data } = JSON.parse(raw.toString());
        if (type === 'input')  term.write(data);
        if (type === 'resize') term.resize(Math.max(2, data.cols), Math.max(2, data.rows));
      } catch {}
    });

    ws.on('close', () => { try { term.kill(); } catch {} });
  } else {
    // Fallback: line-buffered shell via spawn
    const { spawn } = require('child_process');
    const proc = spawn(SHELL, process.platform === 'win32' ? [] : ['-i'], {
      cwd: process.env.HOME || process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (d) => send('data', d.toString()));
    proc.stderr.on('data', (d) => send('data', d.toString()));
    proc.on('exit', () => { send('exit', null); try { ws.close(); } catch {} });

    send('data', '\x1b[33m[Basic mode — node-pty unavailable]\x1b[0m\r\n');

    ws.on('message', (raw) => {
      try {
        const { type, data } = JSON.parse(raw.toString());
        if (type === 'input') proc.stdin.write(data);
      } catch {}
    });

    ws.on('close', () => { try { proc.kill(); } catch {} });
  }
};
