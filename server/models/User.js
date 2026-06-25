const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const COLORS = [
  '#e06c75', '#98c379', '#e5c07b', '#61afef',
  '#c678dd', '#56b6c2', '#d19a66', '#ff6b6b',
  '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
];

const userSchema = new mongoose.Schema({
  username: {
    type: String, required: true, unique: true,
    trim: true, minlength: 2, maxlength: 30,
  },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  color: {
    type: String,
    default: () => COLORS[Math.floor(Math.random() * COLORS.length)],
  },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_, obj) => {
    delete obj.password;
    delete obj.__v;
    return obj;
  },
});

module.exports = mongoose.model('User', userSchema);
