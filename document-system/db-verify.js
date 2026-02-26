const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS templates_old`);
    db.all("SELECT * FROM templates", (err, rows) => {
        if (err) console.error(err);
        else console.log(`Migrated ${rows.length} templates successfully.`);
    });
});
