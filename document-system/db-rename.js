const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.serialize(() => {
    db.run('ALTER TABLE "templates" RENAME TO "templates_old"', (err) => {
        if (err) console.error("Rename failed:", err.message);
        else console.log("Rename success");
    });
});
db.close();
