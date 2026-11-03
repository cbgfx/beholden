import {
  collectBinderBacklinks,
  type BacklinkSource,
} from "@beholden/shared/domain/binderBacklinks";
import { BacklinkList } from "@beholden/shared/ui/BacklinkList";

/** Build only from the already-authorized Player Binder response. Never request DM sources. */
export function PlayerBinderBacklinks(props: {
  characterId: string;
  binderId: string;
  targetId: string;
  mortals: Array<{
    id: string;
    name: string;
    description: string | null;
    backstory: string | null;
  }>;
  campaigns: Array<{ id: string; name: string; story: string | null }>;
  records: Array<{
    id: string;
    name: string;
    type: string;
    description: string | null;
  }>;
}) {
  const route = (section: string, id: string) =>
    `/characters/${props.characterId}/binder?${new URLSearchParams({ section, recordId: id })}`;
  const sources: BacklinkSource[] = [
    ...props.mortals.map((row) => ({
      id: row.id,
      name: row.name,
      type: "mortal",
      route: route("mortals", row.id),
      field: "description",
      text: row.description || row.backstory,
    })),
    ...props.campaigns.map((row) => ({
      id: row.id,
      name: row.name,
      type: "campaign",
      route: route("campaigns", row.id),
      field: "campaign_story",
      text: row.story,
    })),
    ...props.records.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      route: route(row.type === "deity" ? "deities" : "places", row.id),
      field: "description",
      text: row.description,
    })),
  ];
  return (
    <BacklinkList
      rows={collectBinderBacklinks(sources, props.binderId, props.targetId)}
      targetId={props.targetId}
    />
  );
}
