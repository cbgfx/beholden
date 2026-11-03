export interface BacklinkContext {
  field: string;
  occurrence: number;
  before: string;
  mention: string;
  after: string;
}

export interface BinderBacklink {
  id: string;
  name: string;
  type: string;
  route: string;
  fields: string[];
  contexts: BacklinkContext[];
}

export interface BacklinkSource {
  id: string;
  name: string;
  type: string;
  route: string;
  field: string;
  text: string | null;
}

function plainText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/(?:\*\*|__|(?<!\w)\*(?!\s)|(?<!\s)\*(?!\w))/g, "")
    .replace(/^\s*(?:#{1,6}\s+|[-*]\s+|:::toggle\s*|:::\s*)/gm, "");
}

/** Derive excerpts from current text, not a cached label or a stale mention index. */
export function collectBinderBacklinks(
  sources: BacklinkSource[],
  binderId: string,
  targetId: string,
): BinderBacklink[] {
  const groups = new Map<string, BinderBacklink>();
  for (const source of sources) {
    if (!source.text) continue;
    const pattern =
      /\[([^\]]+)\]\(\/binder\/([^/]+)\/[^/]+\/([^/?#)]+)[^)]*\)/g;
    let occurrence = 0;
    for (const match of source.text.matchAll(pattern)) {
      try {
        if (
          decodeURIComponent(match[2]!) !== binderId ||
          decodeURIComponent(match[3]!) !== targetId
        )
          continue;
      } catch {
        continue;
      }
      const preceding = plainText(source.text.slice(0, match.index));
      const following = plainText(
        source.text.slice(match.index! + match[0].length),
      );
      const beforeSentence = preceding.split(/\n|(?<=[.!?])\s+/).at(-1) ?? "";
      const afterSentence = following.split(/\n|(?<=[.!?])\s+/)[0] ?? "";
      const context: BacklinkContext = {
        field: source.field,
        occurrence: occurrence++,
        before:
          `${beforeSentence.length > 110 ? "…" : ""}${beforeSentence.slice(-110)}`
            .replace(/\s+/g, " ")
            .trimStart(),
        mention: match[1]!.replace(/^@/, ""),
        after:
          `${afterSentence.slice(0, 150)}${afterSentence.length > 150 ? "…" : ""}`
            .replace(/\s+/g, " ")
            .trimEnd(),
      };
      const key = `${source.type}:${source.id}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          id: source.id,
          name: source.name,
          type: source.type,
          route: source.route,
          fields: [],
          contexts: [],
        };
        groups.set(key, group);
      }
      if (!group.fields.includes(source.field)) group.fields.push(source.field);
      group.contexts.push(context);
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function backlinkDestination(
  route: string,
  targetId: string,
  context: BacklinkContext,
): string {
  const [path, query] = route.split("?");
  const params = new URLSearchParams(query);
  params.set("mentionTarget", targetId);
  params.set("mentionField", context.field);
  params.set("mentionOccurrence", String(context.occurrence));
  return `${path}?${params}`;
}
