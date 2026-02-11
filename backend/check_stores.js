import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
});

db.all('SELECT id, name, status, errorReason, updatedAt FROM Stores', [], (err, rows) => {
    if (err) throw err;
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
