const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(
      auth.slice(7),
      process.env.JWT_SECRET || 'coda_dev_secret_change_in_production'
    );
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
