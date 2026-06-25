/**
 * Dual-mode data store.
 * Uses MongoDB when connected, falls back to in-memory Maps automatically.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COLORS = [
  '#e06c75', '#98c379', '#e5c07b', '#61afef',
  '#c678dd', '#56b6c2', '#d19a66', '#ff6b6b',
  '#4ecdc4', '#45b7d1',
];

let mongoConnected = false;
const setMongoConnected = (v) => { mongoConnected = v; };
const isMongoConnected = () => mongoConnected;

// ── In-memory storage ──────────────────────────────────────────────────────────
const _users = new Map();        // id  -> user
const _byEmail = new Map();      // email (lower) -> user
const _rooms = new Map();        // id  -> room

const mem = {
  users: {
    async create({ username, email, password }) {
      const lc = email.toLowerCase().trim();
      if (_byEmail.has(lc)) throw Object.assign(new Error(), { code: 11000, keyValue: { email } });
      if ([..._users.values()].some(u => u.username === username.trim())) {
        throw Object.assign(new Error(), { code: 11000, keyValue: { username } });
      }
      const id = crypto.randomBytes(12).toString('hex');
      const user = {
        _id: id,
        username: username.trim(),
        email: lc,
        password: await bcrypt.hash(password, 10),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        createdAt: new Date(),
      };
      _users.set(id, user);
      _byEmail.set(lc, user);
      return user;
    },
    findByEmail: (email) => _byEmail.get(email.toLowerCase().trim()) ?? null,
    findById: (id) => _users.get(id) ?? null,
    comparePassword: (user, pwd) => bcrypt.compare(pwd, user.password),
    toPublic: ({ password, ...rest }) => rest,
  },

  rooms: {
    create({ name, language = 'javascript', isPublic = false, createdBy, creatorInfo }) {
      const id = crypto.randomBytes(5).toString('hex');
      const room = {
        _id: id, name: name.trim(), language, isPublic,
        createdBy, creatorInfo, createdAt: new Date(),
      };
      _rooms.set(id, room);
      return room;
    },
    findByUser(userId) {
      return [..._rooms.values()]
        .filter(r => r.createdBy === userId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    findById: (id) => _rooms.get(id) ?? null,
    update(id, userId, patch) {
      const r = _rooms.get(id);
      if (!r || r.createdBy !== userId) return null;
      Object.assign(r, patch);
      return r;
    },
    delete(id, userId) {
      const r = _rooms.get(id);
      if (!r || r.createdBy !== userId) return null;
      _rooms.delete(id);
      return r;
    },
  },
};

// ── Mongo models (loaded lazily so server starts without mongo) ────────────────
let User, Room;
const getModels = () => {
  if (!User) User = require('./models/User');
  if (!Room) Room = require('./models/Room');
  return { User, Room };
};

// ── Unified API ────────────────────────────────────────────────────────────────
const store = {
  get mode() { return mongoConnected ? 'mongo' : 'memory'; },

  users: {
    async create(data) {
      if (!mongoConnected) {
        const u = await mem.users.create(data);
        return mem.users.toPublic(u);
      }
      const u = await getModels().User.create(data);
      return u.toJSON();
    },
    async findByEmail(email) {
      if (!mongoConnected) return mem.users.findByEmail(email);
      return getModels().User.findOne({ email: email.toLowerCase().trim() });
    },
    async findById(id) {
      if (!mongoConnected) return mem.users.findById(id);
      return getModels().User.findById(id);
    },
    async comparePassword(user, pwd) {
      if (!mongoConnected) return mem.users.comparePassword(user, pwd);
      return user.comparePassword(pwd);
    },
    toPublic(user) {
      if (!mongoConnected) return mem.users.toPublic(user);
      return typeof user.toJSON === 'function' ? user.toJSON() : user;
    },
  },

  rooms: {
    async create(data) {
      if (!mongoConnected) return mem.rooms.create(data);
      const r = await getModels().Room.create(data);
      await r.populate('createdBy', 'username color');
      return r.toJSON();
    },
    async findByUser(userId) {
      if (!mongoConnected) return mem.rooms.findByUser(userId);
      return getModels().Room.find({ createdBy: userId })
        .populate('createdBy', 'username color')
        .sort({ createdAt: -1 });
    },
    async findById(id) {
      if (!mongoConnected) return mem.rooms.findById(id);
      return getModels().Room.findById(id).populate('createdBy', 'username color');
    },
    async update(id, userId, patch) {
      if (!mongoConnected) return mem.rooms.update(id, userId, patch);
      return getModels().Room.findOneAndUpdate(
        { _id: id, createdBy: userId }, patch, { new: true }
      ).populate('createdBy', 'username color');
    },
    async delete(id, userId) {
      if (!mongoConnected) return mem.rooms.delete(id, userId);
      return getModels().Room.findOneAndDelete({ _id: id, createdBy: userId });
    },
  },
};

module.exports = { store, setMongoConnected, isMongoConnected };
