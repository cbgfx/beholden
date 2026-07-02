import { asArray } from "../../lib/text.js";

export class UnknownXmlFieldError extends Error {
  public readonly entityType: string;
  public readonly entityName: string;
  public readonly path: string;
  public readonly unknownKeys: string[];

  constructor(entityType: string, entityName: string, path: string, unknownKeys: string[]) {
    super(
      `Unknown XML field(s) [${unknownKeys.join(", ")}] on ${entityType} "${entityName}" at ${path}. ` +
        `If this is intentionally ignored, add it to the known-keys list with a comment explaining why; ` +
        `otherwise implement handling for it.`,
    );
    this.name = "UnknownXmlFieldError";
    this.entityType = entityType;
    this.entityName = entityName;
    this.path = path;
    this.unknownKeys = unknownKeys;
  }
}

export function assertKnownXmlKeys(
  obj: unknown,
  knownKeys: readonly string[],
  context: { entityType: string; entityName: string; path: string },
  warnings?: string[],
): void {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return;
  const known = new Set(knownKeys);
  const unknown = Object.keys(obj as Record<string, unknown>).filter((k) => !known.has(k));
  if (unknown.length === 0) return;
  if (warnings !== undefined) {
    warnings.push(
      `Unknown XML field(s) [${unknown.join(", ")}] on ${context.entityType} "${context.entityName}" at ${context.path} — field(s) were ignored.`,
    );
  } else {
    throw new UnknownXmlFieldError(context.entityType, context.entityName, context.path, unknown);
  }
}

export function assertKnownXmlKeysEach(
  value: unknown,
  knownKeys: readonly string[],
  context: { entityType: string; entityName: string; path: string },
  warnings?: string[],
): void {
  for (const item of asArray<unknown>(value as unknown[] | unknown | null | undefined)) {
    assertKnownXmlKeys(item, knownKeys, context, warnings);
  }
}
