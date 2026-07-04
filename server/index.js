require('dotenv').config();

// node-pty's WindowsPtyAgent.kill() calls an internal promise with no .catch()
// (fails with "AttachConsole failed" on some Windows/Node combos), which would
// otherwise crash the whole process — and every WebSocket in it — every time a
// terminal session ends. Log and keep running instead.
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection (ignored):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception (ignored):', err);
});

const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { setupWSConnection } = require('y-websocket/bin/utils');
const { setMongoConnected } = require('./store');
const handleTerminal = require('./terminal');
const handleLobby    = require('./lobby');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/execute', require('./routes/execute'));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const SECRET = process.env.JWT_SECRET || 'coda_dev_secret_change_in_production';

// Separate WS server for terminals (no auth in the wss layer — terminal.js handles it)
const termWss  = new WebSocket.Server({ noServer: true });
const lobbyWss = new WebSocket.Server({ noServer: true });

termWss.on('connection', handleTerminal);
lobbyWss.on('connection', (ws, req) => {
  handleLobby(ws, req).catch((err) => {
    console.error('[lobby] unhandled error:', err);
    if (ws.readyState <= 1) ws.close(4000, 'Server error');
  });
});

server.on('upgrade', (req, socket, head) => {
  try {
    const parsed = new URL(req.url, 'http://localhost');

    if (parsed.pathname.startsWith('/terminal')) {
      termWss.handleUpgrade(req, socket, head, (ws) => termWss.emit('connection', ws, req));
      return;
    }

    if (parsed.pathname.startsWith('/lobby/')) {
      const token = parsed.searchParams.get('token');
      try { jwt.verify(token, SECRET); } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      lobbyWss.handleUpgrade(req, socket, head, (ws) => lobbyWss.emit('connection', ws, req));
      return;
    }

    if (!parsed.pathname.startsWith('/ws/')) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    // Yjs WS — verify JWT and check lobby approval
    const token = parsed.searchParams.get('token');
    let payload;
    try { payload = jwt.verify(token, SECRET); } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const userId   = String(payload.id || payload._id || payload.userId || '');
    const roomId   = parsed.pathname.slice(4);
    const approved = handleLobby.approvedUsers.get(roomId);

    if (approved && !approved.has(userId)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

wss.on('connection', (conn, req) => {
  const parsed = new URL(req.url, 'http://localhost');
  const roomId = parsed.pathname.slice(4);
  setupWSConnection(conn, req, { docName: roomId, gc: true });
});

const PORT = process.env.PORT || 3001;

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coda')
  .then(() => {
    setMongoConnected(true);
    console.log('[server] MongoDB connected — using persistent storage');
  })
  .catch(() => {
    console.log('[server] MongoDB unavailable — using in-memory storage (data resets on restart)');
  });

server.listen(PORT, () =>
  console.log(`[server] Listening on http://localhost:${PORT}`)
);
