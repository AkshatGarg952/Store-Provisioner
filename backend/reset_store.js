import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
});

db.run("UPDATE Stores SET status = 'Provisioning', errorReason = NULL WHERE id = '099a5c93'", function (err) {
    if (err) {
        return console.error(err.message);
    }
    console.log(`Row(s) updated: ${this.changes}`);
    db.close();
});
