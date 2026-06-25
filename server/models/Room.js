const mongoose = require('mongoose');
const crypto = require('crypto');

const roomSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomBytes(5).toString('hex') },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  language: { type: String, default: 'javascript' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

roomSchema.set('toJSON', { transform: (_, obj) => { delete obj.__v; return obj; } });

module.exports = mongoose.model('Room', roomSchema);
