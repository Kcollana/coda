const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { store } = require('../store');

const SECRET = process.env.JWT_SECRET || 'coda_dev_secret_change_in_production';

const signToken = (user) =>
  jwt.sign(
    { id: user._id, username: user.username, color: user.color },
    SECRET,
    { expiresIn: '7d' }
  );

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const user = await store.users.create({ username, email, password });
    const pub = store.users.toPublic(user);
    res.status(201).json({ token: signToken(pub), user: pub });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({ error: `That ${field} is already taken` });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await store.users.findByEmail(email);
    if (!user || !(await store.users.comparePassword(user, password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const pub = store.users.toPublic(user);
    res.json({ token: signToken(pub), user: pub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const user = await store.users.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(store.users.toPublic(user));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
