import Database from "better-sqlite3";
const dbPath = "C:/Users/cellu/AppData/Roaming/Beholden/backups/beholden-pre-zombie-note-cleanup-2026-06-27.db";
const db = new Database(dbPath, { readonly: true });
const row = db.prepare("SELECT id, name, updated_at, character_data_json FROM user_characters WHERE id = ?").get("b59d5eb8-9441-499d-bdcc-52b5185ae650");
if (!row) { console.log("NOT FOUND IN BACKUP"); process.exit(0); }
console.log("name:", row.name, "updated_at:", new Date(row.updated_at).toISOString());
const data = JSON.parse(row.character_data_json);
console.log("proficiencies.weapons:", JSON.stringify(data.proficiencies?.weapons));
console.log("proficiencies.armor:", JSON.stringify(data.proficiencies?.armor));
db.close();
