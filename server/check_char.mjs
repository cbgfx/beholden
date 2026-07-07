import Database from "better-sqlite3";
const dbPath = "C:/Users/cellu/AppData/Roaming/Beholden/beholden.db";
const db = new Database(dbPath, { readonly: true });
const row = db.prepare("SELECT id, name, updated_at, character_data_json FROM user_characters WHERE id = ?").get("b59d5eb8-9441-499d-bdcc-52b5185ae650");
if (!row) { console.log("NOT FOUND"); process.exit(0); }
console.log("name:", row.name, "updated_at:", new Date(row.updated_at).toISOString());
const data = JSON.parse(row.character_data_json);
console.log("top-level keys:", Object.keys(data));
console.log("proficiencies:", JSON.stringify(data.proficiencies));
console.log("spells count:", (data.spells || []).length, JSON.stringify((data.spells||[]).map(s=>s.name)));
console.log("inventory weapon names:", (data.inventory||[]).filter(i=>/longbow|shortbow/i.test(i.name||"")).map(i=>({name:i.name, equipState:i.equipState, linkedAmmoId:i.linkedAmmoId})));
console.log("campaignId:", data.campaignId);
db.close();
