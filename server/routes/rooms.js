const router = require('express').Router();
const { store } = require('../store');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const rooms = await store.rooms.findByUser(req.user.id);
    res.json(rooms);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, language = 'javascript', isPublic = false } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Room name is required' });
    const room = await store.rooms.create({
      name,
      language,
      isPublic,
      createdBy: req.user.id,
      creatorInfo: { username: req.user.username, color: req.user.color },
    });
    res.status(201).json(room);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const room = await store.rooms.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { language, name } = req.body;
    const patch = {};
    if (language) patch.language = language;
    if (name) patch.name = name.trim();
    const room = await store.rooms.update(req.params.id, req.user.id, patch);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const room = await store.rooms.delete(req.params.id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ message: 'Room deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
