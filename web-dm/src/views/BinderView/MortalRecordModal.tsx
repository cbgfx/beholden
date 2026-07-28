import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Drawer } from "@/components/overlay/Drawer";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { TextArea } from "@/ui/TextArea";
import { theme } from "@/theme/theme";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import type { BinderMortal, BinderMortalInput, MortalOptions, MortalType } from "@/services/binderMortalApi";

type Option = SearchableSelectOption;

function SearchableOption(props: {
  id: string;
  label: string;
  selectedId: string;
  options: Option[];
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  return <div style={propertyRowStyle}>
    <label htmlFor={props.id} style={propertyLabelStyle}>{props.label}</label>
    <SearchableSelect id={props.id} value={props.selectedId} onChange={props.onChange} options={props.options} disabled={props.disabled} />
  </div>;
}

const labelStyle: React.CSSProperties = {
  color: theme.colors.muted,
  fontSize: "var(--fs-small)",
  fontWeight: 750,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const propertyRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "112px minmax(0, 1fr)",
  alignItems: "center",
  gap: 12,
  minHeight: 42,
};

const propertyLabelStyle: React.CSSProperties = {
  color: theme.colors.muted,
  fontSize: "var(--fs-body)",
  fontWeight: 700,
};

export function MortalRecordModal(props: {
  isOpen: boolean;
  record: BinderMortal | null;
  binderCurrentDate: number | null;
  options: MortalOptions;
  requireNpcStatblock?: boolean;
  onClose: () => void;
  onSave: (input: BinderMortalInput, image: File | null) => Promise<void>;
}) {
  const grouped = useMemo(() => ({
    races: props.options.records.filter((item) => item.type === "race"),
    positions: props.options.records.filter((item) => item.type === "position"),
    organizations: props.options.records.filter((item) => item.type === "organization"),
    locations: props.options.records.filter((item) => ["continent", "country", "location", "poi"].includes(item.type)),
  }), [props.options]);
  const [name, setName] = useState("");
  const [mortalType, setMortalType] = useState<MortalType>("npc");
  const [raceId, setRaceId] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [birthDate, setBirthDate] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [className, setClassName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [monsterId, setMonsterId] = useState("");
  const [notes, setNotes] = useState("");
  const [dmNotes, setDmNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncedRecordKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!props.isOpen) {
      syncedRecordKeyRef.current = null;
      return;
    }
    // A background reload (e.g. this tab regaining focus after the native file picker closes)
    // hands down new `options`/`grouped.races` references without the record actually changing.
    // Only re-sync form state on an open/record transition, not on every such reference change —
    // otherwise an in-progress portrait selection gets silently wiped mid-edit.
    const recordKey = props.record?.id ?? "new";
    if (syncedRecordKeyRef.current === recordKey) return;
    syncedRecordKeyRef.current = recordKey;
    const linkedPlayer = props.options.players.find((player) => player.id === props.record?.player?.id);
    const matchingRace = linkedPlayer
      ? grouped.races.find((race) => race.name.toLocaleLowerCase() === linkedPlayer.species?.trim().toLocaleLowerCase())
      : undefined;
    setName(props.record?.name ?? "");
    setMortalType(props.record?.mortalType ?? "npc");
    setRaceId(matchingRace?.id ?? props.record?.race?.id ?? "");
    const linkedGender = linkedPlayer?.gender === "male" || linkedPlayer?.gender === "female" ? linkedPlayer.gender : null;
    setGender(linkedGender ?? props.record?.gender ?? (props.record ? "" : "male"));
    const linkedAge = Number(linkedPlayer?.age?.replaceAll(",", ""));
    const linkedYear = linkedPlayer?.campaignCurrentDate ?? props.binderCurrentDate;
    const linkedBirthDate = Number.isFinite(linkedAge) && linkedYear !== null && Number.isFinite(linkedYear)
      ? String(linkedYear - linkedAge)
      : null;
    setBirthDate(linkedBirthDate ?? props.record?.birthDate ?? "");
    setDeathDate(props.record?.deathDate ?? "");
    setLocationId(props.record?.location?.id ?? "");
    setOrganizationId(props.record?.organization?.id ?? "");
    setPositionId(props.record?.position?.id ?? "");
    setClassName(props.record?.className ?? "");
    setPlayerId(props.record?.player?.id ?? "");
    setMonsterId(props.record?.monsterId ?? "");
    setNotes(props.record?.notes ?? "");
    setDmNotes(props.record?.dmNotes ?? "");
    setImage(null);
    setImagePreview(linkedPlayer?.imageUrl ?? props.record?.imageUrl ?? null);
    const born = Number(props.record?.birthDate?.replaceAll(",", ""));
    const end = props.record?.deathDate
      ? Number(props.record.deathDate.replaceAll(",", ""))
      : props.binderCurrentDate;
    setAgeInput(linkedPlayer?.age ?? (Number.isFinite(born) && end !== null && Number.isFinite(end) ? String(Math.max(0, end - born)) : ""));
    setError(null);
  }, [props.isOpen, props.record, props.options.players, grouped.races, props.binderCurrentDate]);

  useEffect(() => () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  function selectPortrait(file: File | null) {
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function resetPortraitSelection() {
    setImage(null);
    setImagePreview(props.record?.imageUrl ?? null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !gender) return;
    if (props.requireNpcStatblock && mortalType === "npc" && !monsterId) {
      setError("Choose a statblock before creating this Important NPC.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await props.onSave({
        name: name.trim(),
        mortalType,
        raceId: raceId || null,
        gender,
        birthDate: birthDate.trim() || null,
        deathDate: deathDate.trim() || null,
        locationId: locationId || null,
        organizationId: organizationId || null,
        positionId: positionId || null,
        className: mortalType === "player_character" ? className.trim() || null : null,
        notes: notes.trim() || null,
        dmNotes: dmNotes.trim() || null,
        playerId: mortalType === "player_character" ? playerId || null : null,
        monsterId: mortalType === "npc" ? monsterId || null : null,
      }, image);
      props.onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save Mortal.");
    } finally {
      setSaving(false);
    }
  }

  const property = (label: string, control: React.ReactNode) =>
    <div style={propertyRowStyle}><div style={propertyLabelStyle}>{label}</div><div style={{ minWidth: 0 }}>{control}</div></div>;
  const playerLabel = (player: MortalOptions["players"][number]) =>
    `${player.characterName || "Unnamed character"} — ${player.playerName || "No player name"} (${player.campaignName})`;

  const dead = Boolean(deathDate.trim());
  const birthYear = Number(birthDate);
  const endYear = dead ? Number(deathDate) : props.binderCurrentDate;
  const age = birthDate.trim() && Number.isFinite(birthYear) && endYear !== null && Number.isFinite(endYear)
    ? Math.max(0, endYear - birthYear)
    : null;
  const availablePlayers = props.options.players.filter((player) => !player.linkedMortalId || player.id === props.record?.player?.id);

  function setAgeAndBirth(value: string, selectedPlayerId = playerId) {
    setAgeInput(value);
    const numericAge = Number(value.replaceAll(",", "").trim());
    if (!value.trim()) return;
    const selectedPlayer = props.options.players.find((player) => player.id === selectedPlayerId);
    const currentYear = selectedPlayer?.campaignCurrentDate ?? props.binderCurrentDate;
    if (Number.isFinite(numericAge) && numericAge >= 0 && currentYear !== null && Number.isFinite(currentYear)) {
      setBirthDate(String(currentYear - numericAge));
    }
  }

  function linkPlayer(nextPlayerId: string) {
    setPlayerId(nextPlayerId);
    const player = props.options.players.find((item) => item.id === nextPlayerId);
    if (!player) return;
    const matchingRace = grouped.races.find((race) => race.name.toLocaleLowerCase() === player.species?.trim().toLocaleLowerCase());
    if (matchingRace) setRaceId(matchingRace.id);
    if (player.gender === "male" || player.gender === "female") setGender(player.gender);
    if (player.imageUrl) setImagePreview(player.imageUrl);
    if (player.age) setAgeAndBirth(player.age, player.id);
  }

  const footer = <div style={{ display: "grid", gap: 8, width: "100%" }}>
    {error ? <div role="alert" style={{ color: theme.colors.red, fontSize: "var(--fs-small)", textAlign: "right" }}>{error}</div> : null}
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <Button type="button" variant="ghost" onClick={props.onClose} disabled={saving}>Cancel</Button>
      <Button type="submit" form="binder-mortal-form" disabled={saving || !name.trim() || !gender || Boolean(props.requireNpcStatblock && mortalType === "npc" && !monsterId)}>{saving ? "Saving…" : props.record ? "Save Changes" : props.requireNpcStatblock ? "Create Important NPC" : "Create Mortal"}</Button>
    </div>
  </div>;

  return <Drawer isOpen={props.isOpen} onClose={props.onClose} title={props.record ? "Edit Mortal" : "New Mortal"} footer={footer} width="min(440px, 94vw)">
    <form id="binder-mortal-form" onSubmit={(event) => void submit(event)} style={{ display: "grid", gap: 5 }}>
      <div style={{ display: "grid", gridTemplateColumns: "78px minmax(0, 1fr)", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(event) => {
            selectPortrait(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
          disabled={saving}
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={saving}
          title={imagePreview ? "Change portrait" : "Add portrait"}
          aria-label={imagePreview ? "Change portrait" : "Add portrait"}
          style={{ width: 78, height: 78, padding: 0, borderRadius: 10, border: `2px dashed ${imagePreview ? theme.colors.accentHighlight : theme.colors.panelBorder}`, background: imagePreview ? "#000" : theme.colors.inputBg, color: theme.colors.muted, cursor: saving ? "default" : "pointer", overflow: "hidden" }}
        >
          {imagePreview
            ? <img src={imagePreview} alt="Mortal portrait" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ opacity: 0.55 }}>Portrait</span>}
        </button>
        <Input
          aria-label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          maxLength={160}
          disabled={saving}
          placeholder="Mortal name"
          style={{ fontSize: "var(--fs-title)", fontWeight: 850 }}
        />
      </div>
      {property("Type", <Select style={{ width: "100%" }} value={mortalType} onChange={(event) => setMortalType(event.target.value as MortalType)} disabled={saving}><option value="npc">NPC</option><option value="player_character">Player Character</option></Select>)}
      {mortalType === "player_character"
        ? property("Existing player", <SearchableSelect value={playerId} onChange={linkPlayer} disabled={saving} options={availablePlayers.map((player) => ({ id: player.id, name: playerLabel(player) }))} />)
        : <SearchableOption id="mortal-monster" label={`Statblock${props.requireNpcStatblock ? " *" : ""}`} selectedId={monsterId} options={props.options.monsters ?? []} onChange={setMonsterId} disabled={saving} />}
      {mortalType === "player_character" && (() => {
        const linkedClassName = playerId ? props.options.players.find((player) => player.id === playerId)?.className : null;
        return property("Class", linkedClassName
          ? <Input value={linkedClassName} disabled readOnly title="Derived from the linked player character" />
          : <Input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="e.g. Wizard" disabled={saving} />);
      })()}
      <SearchableOption id="mortal-race" label="Race" selectedId={raceId} options={grouped.races} onChange={setRaceId} disabled={saving} />
      {property("Gender", <Select value={gender} onChange={(event) => setGender(event.target.value as typeof gender)} disabled={saving}><option value="" disabled>Select gender</option><option value="male">Male</option><option value="female">Female</option></Select>)}
      {property("Age", <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Input value={ageInput} onChange={(event) => setAgeAndBirth(event.target.value)} inputMode="numeric" placeholder={age === null ? "None" : String(age)} disabled={saving} style={{ width: 90 }} />
        <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 5, fontSize: "var(--fs-small)", lineHeight: 1.35, fontWeight: 800, color: "#fff", background: dead ? theme.colors.red : theme.colors.green }}>{dead ? "Dead" : "Alive"}</span>
      </div>)}
      {property("Date of birth", <Input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} placeholder="None" disabled={saving} />)}
      {property("Date of death", <Input value={deathDate} onChange={(event) => setDeathDate(event.target.value)} placeholder="None" disabled={saving} />)}
      <SearchableOption id="mortal-location" label="Location" selectedId={locationId} options={grouped.locations} onChange={setLocationId} disabled={saving} />
      <SearchableOption id="mortal-organization" label="Organization" selectedId={organizationId} options={grouped.organizations} onChange={setOrganizationId} disabled={saving} />
      <SearchableOption id="mortal-position" label="Position" selectedId={positionId} options={grouped.positions} onChange={setPositionId} disabled={saving} />
      {image ? <button type="button" onClick={resetPortraitSelection} disabled={saving} style={{ justifySelf: "start", padding: 0, border: 0, background: "none", color: theme.colors.muted, cursor: "pointer", font: "inherit", fontSize: "var(--fs-small)" }}>Undo portrait selection</button> : null}
      <details open={Boolean(props.record?.notes || props.record?.dmNotes)} style={{ marginTop: 8, borderTop: `1px solid ${theme.colors.panelBorder}`, paddingTop: 10 }}>
        <summary style={{ color: theme.colors.muted, cursor: "pointer", fontWeight: 750, padding: "4px 0 8px" }}>Notes</summary>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}><div style={labelStyle}>Notes</div><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="None" disabled={saving} /></div>
          <div style={{ display: "grid", gap: 6 }}><div style={labelStyle}>DM Notes</div><TextArea value={dmNotes} onChange={(event) => setDmNotes(event.target.value)} rows={3} placeholder="None" disabled={saving} /></div>
        </div>
      </details>
    </form>
  </Drawer>;
}
