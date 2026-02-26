const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.serialize(() => {
    db.run(`
        INSERT INTO templates (id, createdAt, updatedAt, deletedAt, templateName, templateCode, schemaVariables, templateLayout, version, status, isTimeBased, validFrom, validTo)
        SELECT id, createdAt, updatedAt, deletedAt, templateName, templateCode, schemaVariables, templateLayout, version, status, isTimeBased, validFrom, validTo 
        FROM templates_old
    `, (err) => {
        if (err) {
            console.error("Insert error:", err.message);
        } else {
            console.log("Migration complete!");
            db.run(`DROP TABLE templates_old`);
            console.log("Old table dropped.");
        }
    });
});
db.close();
