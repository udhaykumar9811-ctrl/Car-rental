const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'drift.db');
const adminPassword = process.env.ADMIN_PASSWORD || 'udhaya@2007';
const adminSessions = new Set();

fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

function initDb() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS cars (
        id TEXT PRIMARY KEY,
        name TEXT,
        details TEXT,
        seats TEXT,
        price TEXT,
        km TEXT
      )
    `);
  });
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

function getSessionToken(req) {
  const cookies = req.headers.cookie || '';
  const sessionCookie = cookies.split(';').find((cookie) => cookie.trim().startsWith('drift_admin_session='));
  return sessionCookie ? sessionCookie.trim().split('=')[1] : '';
}

function requireAdmin(req, res, next) {
  if (!adminSessions.has(getSessionToken(req))) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  next();
}

app.post('/api/admin/login', (req, res) => {
  if (req.body?.password !== adminPassword) {
    return res.status(401).json({ error: 'Incorrect admin password' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.add(token);
  res.setHeader('Set-Cookie', `drift_admin_session=${token}; HttpOnly; SameSite=Lax; Path=/`);
  res.json({ success: true });
});

app.get('/api/fleet', (req, res) => {
  db.all('SELECT * FROM cars ORDER BY rowid ASC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({ cars: rows });
  });
});

app.put('/api/fleet', requireAdmin, (req, res) => {
  const incoming = Array.isArray(req.body?.cars) ? req.body.cars : [];

  if (!incoming.length) {
    return res.status(400).json({ error: 'No car data received' });
  }

  db.serialize(() => {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO cars (id, name, details, seats, price, km) VALUES (?, ?, ?, ?, ?, ?)'
    );

    incoming.forEach((car) => {
      stmt.run(
        car.id || `car-${Date.now()}`,
        car.name || '',
        car.details || '',
        car.seats || '',
        car.price || '',
        car.km || ''
      );
    });

    stmt.finalize(() => {
      res.json({ success: true, cars: incoming });
    });
  });
});

app.delete('/api/fleet/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Car id is required' });
  }

  db.run('DELETE FROM cars WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json({ success: true, deletedId: id });
  });
});

initDb();

app.listen(PORT, () => {
  console.log(`Drift app running at http://localhost:${PORT}`);
});
