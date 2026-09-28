import type { ServerContext } from "../../server/context.js";

export type BinderRecordRow = { id: string; binder_id: string; record_type: string; name: string; icon?: string | null };

export function requireBinderRecord(
  db: ServerContext["db"], binderId: string, id: string | null | undefined, allowed?: string[],
) {
  if (!id) return null;
  const row = db.prepare(
    "SELECT id, binder_id, record_type, name FROM binder_records WHERE id = ? AND binder_id = ?",
  ).get(id, binderId) as BinderRecordRow | undefined;
  if (!row || (allowed && !allowed.includes(row.record_type))) {
    throw Object.assign(new Error("Referenced record is invalid or belongs to another Binder"), { status: 400 });
  }
  return row;
}

export function syncMentionField(
  ctx: ServerContext, binderId: string, sourceRecordId: string, sourceField: string,
  value: string | null | undefined,
) {
  ctx.db.prepare("DELETE FROM binder_record_mentions WHERE source_record_id=? AND source_field=?").run(sourceRecordId, sourceField);
  if (!value) return;
  const pattern = /\[([^\]]+)\]\(\/binder\/[^/]+\/[^/]+\/([^/?#)]+)[^)]*\)/g;
  const insert = ctx.db.prepare(`
    INSERT INTO binder_record_mentions
      (id,source_record_id,source_field,target_record_id,target_external_id,label,occurrence_key,created_at)
    VALUES (?,?,?,?,NULL,?,?,?)
  `);
  let match: RegExpExecArray | null;
  let occurrence = 0;
  while ((match = pattern.exec(value)) !== null) {
    const target = requireBinderRecord(ctx.db, binderId, decodeURIComponent(match[2]!));
    if (!target) continue;
    insert.run(ctx.helpers.uid(), sourceRecordId, sourceField, target.id, match[1]!.replace(/^@/, ""), `${target.id}:${occurrence++}`, ctx.helpers.now());
  }
}
