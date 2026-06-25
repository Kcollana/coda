const jwt    = require('jsonwebtoken');
const { store } = require('./store');

const SECRET = process.env.JWT_SECRET || 'coda_dev_secret_change_in_production';

// roomId → Set<userId>
const approvedUsers = new Map();
// roomId → Map<userId, { ws, username }>
const pendingPool   = new Map();
// roomId → ws (creator's open lobby socket)
const creatorLobby  = new Map();

function getOrSet(map, key, factory) {
  if (!map.has(key)) map.set(key, factory());
  return map.get(key);
}

async function handleLobby(ws, req) {
  const parsed  = new URL(req.url, 'http://localhost');
  const parts   = parsed.pathname.split('/').filter(Boolean); // ['lobby', roomId]
  const roomId  = parts[1] || '';
  const token   = parsed.searchParams.get('token');

  let userId, username;
  try {
    const payload = jwt.verify(token, SECRET);
    userId   = String(payload.id || payload._id || payload.userId || '');
    username = payload.username || 'Unknown';
  } catch {
    ws.close(4001, 'Unauthorized');
    return;
  }

  let creatorId;
  try {
    const room = await store.rooms.findById(roomId);
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      ws.close();
      return;
    }
    creatorId = String(room.createdBy?._id || room.createdBy || '');
  } catch (err) {
    console.error('[lobby] store error:', err);
    ws.close(4000, 'Server error');
    return;
  }

  const approved = getOrSet(approvedUsers, roomId, () => new Set());
  const pending  = getOrSet(pendingPool,   roomId, () => new Map());

  if (userId === creatorId) {
    // ── Creator path ───────────────────────────────────────────────────────
    creatorLobby.set(roomId, ws);
    approved.add(userId);

    const pendingList = [...pending.entries()].map(([uid, { username: un }]) => ({
      userId: uid, username: un,
    }));
    ws.send(JSON.stringify({ type: 'approved', isCreator: true, pendingList }));

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      const uid    = String(msg.userId || '');
      const target = pending.get(uid);

      if (msg.type === 'approve' && target) {
        approved.add(uid);
        if (target.ws.readyState === 1) target.ws.send(JSON.stringify({ type: 'approved' }));
        pending.delete(uid);
      }
      if (msg.type === 'reject' && target) {
        if (target.ws.readyState === 1) target.ws.send(JSON.stringify({ type: 'rejected' }));
        pending.delete(uid);
      }
    });

    ws.on('close', () => {
      if (creatorLobby.get(roomId) === ws) creatorLobby.delete(roomId);
    });

  } else {
    // ── Guest path ─────────────────────────────────────────────────────────
    if (approved.has(userId)) {
      ws.send(JSON.stringify({ type: 'approved' }));
      ws.close();
      return;
    }

    const cws = creatorLobby.get(roomId);
    if (!cws || cws.readyState !== 1) {
      // Creator offline → auto-approve
      approved.add(userId);
      ws.send(JSON.stringify({ type: 'approved' }));
      ws.close();
      return;
    }

    pending.set(userId, { ws, username });
    ws.send(JSON.stringify({ type: 'waiting' }));
    cws.send(JSON.stringify({ type: 'join_request', userId, username }));

    ws.on('close', () => {
      pending.delete(userId);
      const activeCws = creatorLobby.get(roomId);
      if (activeCws?.readyState === 1) {
        activeCws.send(JSON.stringify({ type: 'request_cancelled', userId }));
      }
    });
  }
}

module.exports = handleLobby;
module.exports.approvedUsers = approvedUsers;
