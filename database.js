const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'collection.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    db.serialize(() => {
      // Auth table
      db.run(`
        CREATE TABLE IF NOT EXISTS auth (
        id INTEGER PRIMARY KEY,
        ownername TEXT,
        phoneno INTEGER,
        password TEXT
      )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      timestamp TEXT,
      title TEXT,
      description TEXT,
      propertyaddress TEXT,
      locality TEXT,
      city TEXT,
      ownername TEXT,
      phoneno TEXT,
      rentalprice TEXT,
      likestatus INTEGER,
      type TEXT
    )
      `);
    });
  }
})

module.exports = db;