import React from "react";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { Button } from "@/ui/Button";
import { IconCopy, IconTrash } from "@/icons";
import {
  defaultPreferences,
  movePanel,
  normalizePreferences,
  resizeColumns,
  type PanelAppearance,
  type WorkspaceView,
} from "./workspaceLayout";
import "./workspace.css";

function IconEditCrayon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="M15 5l4 4" />
    </svg>
  );
}

/** Palette by Delapouite, CC BY 3.0 — https://game-icons.net/1x1/delapouite/palette.html */
function IconPalette({ size = 19 }: { size?: number }) {
  const gradientId = React.useId();
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff5d5d" /><stop offset=".28" stopColor="#f5c451" /><stop offset=".52" stopColor="#4ade80" /><stop offset=".75" stopColor="#38b6ff" /><stop offset="1" stopColor="#a78bfa" /></linearGradient></defs>
      <path fill={`url(#${gradientId})`} d="M274.2 41.6C173.6 41.2 88.5 125.5 48 233.8 7.5 338.9 48.9 473.8 138.3 471.3c89.4-2.5 18.1-99.6 65.5-146.1 34.7-34 90.6-20.1 129.2-7.3 48.7 16.1 105.3-39.4 96.2-90.7C414.4 143 308.9 73 222.2 72.7c17.7-20.6 35-31.2 52-31.1zm60.8 39.9c20.4 0 36.9 16.5 36.9 36.9s-16.5 36.9-36.9 36.9-36.9-16.5-36.9-36.9 16.5-36.9 36.9-36.9zm-119.9 4.5c20.4 0 36.9 16.5 36.9 36.9s-16.5 36.9-36.9 36.9-36.9-16.5-36.9-36.9 16.5-36.9 36.9-36.9zm-88.3 79.6c20.4 0 36.9 16.5 36.9 36.9s-16.5 36.9-36.9 36.9-36.9-16.5-36.9-36.9 16.5-36.9 36.9-36.9zm294.5 4.4c20.4 0 36.9 16.5 36.9 36.9s-16.5 36.9-36.9 36.9-36.9-16.5-36.9-36.9 16.5-36.9 36.9-36.9zM114.2 341.9c26.9 0 48.7 18.3 48.7 40.9s-21.8 40.9-48.7 40.9-48.7-18.3-48.7-40.9 21.8-40.9 48.7-40.9z" />
    </svg>
  );
}

function IconReset({ size = 18 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /></svg>;
}

export type WorkspacePanel = {
  id: string;
  title: string;
  column: number;
  content: React.ReactNode;
};
type Props = {
  workspace: string;
  panels: WorkspacePanel[];
  defaultColumns?: number;
  header?: React.ReactNode;
};

function appearanceStyle(value: PanelAppearance): React.CSSProperties {
  return {
    ...(value.accent
      ? { "--dm-panel-accent": value.accent, "--campaign-accent": value.accent }
      : {}),
    ...(value.background ? { "--dm-panel-background": value.background } : {}),
    ...(value.text
      ? {
          "--dm-text": value.text,
          "--dm-muted": `color-mix(in srgb, ${value.text} 65%, transparent)`,
        }
      : {}),
  } as React.CSSProperties;
}

export function DmWorkspace(props: Props) {
  const { user } = useAuth();
  return <WorkspaceEditor key={`${user?.id}:${props.workspace}`} {...props} />;
}

function WorkspaceEditor({
  workspace,
  panels,
  defaultColumns = 3,
  header,
}: Props) {
  const t = useUiTranslation("dmUi");
  const defaults = Array.from({ length: defaultColumns }, (_, i) =>
    panels.filter((p) => p.column === i).map((p) => p.id),
  );
  const defaultsRef = React.useRef(defaults);
  defaultsRef.current = defaults;
  const [preferences, setPreferences] = React.useState(() =>
    defaultPreferences(defaults),
  );
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [colorTarget, setColorTarget] = React.useState("all");
  const [showColors, setShowColors] = React.useState(false);
  const [drag, setDrag] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [retry, setRetry] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = React.useState({ left: false, right: false });
  React.useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const update = () => setScrollEdges((previous) => {
      const left = element.scrollLeft > 2;
      const right = element.scrollWidth - element.clientWidth - element.scrollLeft > 2;
      return previous.left === left && previous.right === right ? previous : { left, right };
    });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    const columns = element.querySelector(".dm-workspace-columns");
    if (columns) observer?.observe(columns);
    window.addEventListener("resize", update);
    return () => { element.removeEventListener("scroll", update); window.removeEventListener("resize", update); observer?.disconnect(); };
  });
  const endpoint = `/api/me/workspaces/${workspace}`;
  const normalized = normalizePreferences(preferences, defaults);
  const view = normalized.views.find((v) => v.id === normalized.activeId)!;
  const viewRef = React.useRef(view);
  viewRef.current = view;
  React.useEffect(() => {
    let active = true;
    api<unknown>(endpoint)
      .then((value) => {
        if (!active) return;
        const next = normalizePreferences(value, defaultsRef.current);
        setPreferences(next);
        setLoaded(true);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Could not load layouts.");
      });
    return () => {
      active = false;
    };
  }, [endpoint, retry]);

  function updateView(update: (current: WorkspaceView) => WorkspaceView) {
    setPreferences((current) => ({
      ...current,
      views: current.views.map((v) =>
        v.id === current.activeId ? update(v) : v,
      ),
    }));
  }
  async function save(next = normalized) {
    setSaving(true);
    setError(null);
    try {
      await api(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setPreferences(next);
      setEditing(false);
      setShowColors(false);
    } catch {
      setError(
        "Could not save layouts. Your changes are still here; try again.",
      );
      setEditing(true);
    } finally {
      setSaving(false);
    }
  }

  const dragId = drag?.id;
  React.useEffect(() => {
    if (!dragId) return;
    const move = (event: PointerEvent) => {
      setDrag({ id: dragId, x: event.clientX, y: event.clientY });
      const scroll = rootRef.current?.closest<HTMLElement>(".shellLayout");
      if (scroll) {
        const bounds = scroll.getBoundingClientRect();
        if (event.clientY < bounds.top + 50) scroll.scrollBy(0, -18);
        else if (event.clientY > bounds.bottom - 50) scroll.scrollBy(0, 18);
      }
    };
    const finish = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const target = element?.closest<HTMLElement>("[data-workspace-column]");
      if (target && rootRef.current?.contains(target)) {
        const column = Number(target.dataset.workspaceColumn);
        const row = element?.closest<HTMLElement>("[data-workspace-panel]");
        let beforeId = row?.dataset.workspacePanel;
        if (
          row &&
          beforeId !== dragId &&
          event.clientY >
            row.getBoundingClientRect().top +
              row.getBoundingClientRect().height / 2
        ) {
          const ids = viewRef.current.columns[column].filter(
            (id) => id !== dragId,
          );
          beforeId = ids[ids.indexOf(beforeId!) + 1];
        }
        const nextColumns = movePanel(
          viewRef.current.columns,
          dragId,
          column,
          beforeId,
        );
        setPreferences((current) => ({
          ...current,
          views: current.views.map((v) =>
            v.id === current.activeId ? { ...v, columns: nextColumns } : v,
          ),
        }));
      }
      setDrag(null);
    };
    const cancel = () => setDrag(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
    };
  }, [dragId]);

  function nudge(
    id: string,
    column: number,
    index: number,
    direction: "up" | "down" | "left" | "right",
  ) {
    updateView((current) => {
      if (direction === "left" || direction === "right")
        return {
          ...current,
          columns: movePanel(
            current.columns,
            id,
            column + (direction === "left" ? -1 : 1),
          ),
        };
      const next = current.columns.map((c) => [...c]);
      const to = index + (direction === "up" ? -1 : 1);
      if (to >= 0 && to < next[column].length)
        [next[column][index], next[column][to]] = [
          next[column][to],
          next[column][index],
        ];
      return { ...current, columns: next };
    });
  }
  const color =
    colorTarget === "all" ? view.appearance : (view.colors[colorTarget] ?? {});
  const setColor = (value: PanelAppearance) =>
    updateView((v) =>
      colorTarget === "all"
        ? { ...v, appearance: value }
        : { ...v, colors: { ...v.colors, [colorTarget]: value } },
    );

  return (
    <div
      ref={rootRef}
      className="dm-workspace"
      style={{
        ...appearanceStyle(view.appearance),
        boxShadow: `${scrollEdges.left ? "inset 10px 0 10px -8px rgba(56, 182, 255, 0.3)" : "inset 0 0 transparent"}, ${scrollEdges.right ? "inset -10px 0 10px -8px rgba(56, 182, 255, 0.3)" : "inset 0 0 transparent"}`,
        background: view.appearance.background
          ? `color-mix(in srgb, ${view.appearance.background} 65%, #000)`
          : undefined,
      }}
    >
      <div className={`dm-workspace-toolbar${editing ? " is-editing" : ""}`}>
        {!editing && (
          <select
            aria-label={t("Layout")}
            value={view.id}
            disabled={!loaded || saving}
            onChange={(event) => {
              const next = { ...normalized, activeId: event.target.value };
              setPreferences(next);
              void save(next);
            }}
          >
            {normalized.views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id === "default" ? t(v.name) : v.name}
              </option>
            ))}
          </select>
        )}
        {!editing ? (
          <>
            <button
              className="dm-workspace-icon-button"
              type="button"
              disabled={!loaded || saving}
              onClick={() => setEditing(true)}
              title={t("Customize layout")}
              aria-label={t("Customize layout")}
            >
              <IconEditCrayon />
            </button>
          </>
        ) : (
          <>
            <input
              aria-label={t("Layout name")}
              value={
                preferences.views.find((v) => v.id === view.id)?.name ??
                view.name
              }
              maxLength={60}
              disabled={saving}
              onChange={(event) =>
                updateView((v) => ({ ...v, name: event.target.value }))
              }
            />
            <label title={t("Columns")}>
              <select
                aria-label={t("Columns")}
                value={view.columns.length}
                disabled={saving}
                onChange={(event) =>
                  updateView((v) => ({
                    ...v,
                    columns: resizeColumns(
                      v.columns,
                      Number(event.target.value),
                    ),
                  }))
                }
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              className="dm-workspace-icon-button dm-workspace-palette-button"
              type="button"
              disabled={saving}
              onClick={() => setShowColors((value) => !value)}
              title={t("Colours")}
              aria-label={t("Colours")}
            >
              <IconPalette />
            </button>
            <button
              className="dm-workspace-icon-button"
              type="button"
              disabled={saving || normalized.views.length >= 12}
              onClick={() => {
                const copy = {
                  ...view,
                  id: crypto.randomUUID(),
                  name: `${view.name} (${t("copy")})`.slice(0, 60),
                };
                setPreferences({
                  activeId: copy.id,
                  views: [...normalized.views, copy],
                });
              }}
              title={t("Duplicate")}
              aria-label={t("Duplicate")}
            >
              <IconCopy size={18} />
            </button>
            <button
              className="dm-workspace-icon-button"
              type="button"
              disabled={saving}
              onClick={() =>
                updateView((v) => ({
                  ...v,
                  columns: defaults.map((c) => [...c]),
                  colors: {},
                  appearance: {},
                }))
              }
              title={t("Reset layout")}
              aria-label={t("Reset layout")}
            >
              <IconReset />
            </button>
            <button
              className="dm-workspace-icon-button is-danger"
              type="button"
              disabled={saving || normalized.views.length <= 1}
              onClick={() => {
                const remaining = normalized.views.filter(
                  (v) => v.id !== view.id,
                );
                setPreferences({ activeId: remaining[0].id, views: remaining });
              }}
              title={t("Delete layout")}
              aria-label={t("Delete layout")}
            >
              <IconTrash size={18} />
            </button>
            <Button
              variant="ghost"
              disabled={
                saving ||
                !preferences.views.find((v) => v.id === view.id)?.name.trim()
              }
              onClick={() => void save()}
              style={{
                color: "var(--dm-panel-accent, var(--campaign-accent, #a78bfa))",
                borderColor: "color-mix(in srgb, var(--dm-panel-accent, var(--campaign-accent, #a78bfa)) 50%, transparent)",
                background: "color-mix(in srgb, var(--dm-panel-accent, var(--campaign-accent, #a78bfa)) 12%, transparent)",
                fontWeight: 800,
              }}
            >
              {saving ? t("Saving...") : t("Done")}
            </Button>
          </>
        )}
      </div>
      {error && (
        <div role="alert" style={{ color: "#ff5d5d" }}>
          {t(error)}{" "}
          {!loaded && (
            <Button
              variant="ghost"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t("Retry")}
            </Button>
          )}
        </div>
      )}
      {editing && showColors && (
        <div className="dm-workspace-colors">
          <select
            aria-label={t("Colour target")}
            value={colorTarget}
            onChange={(event) => setColorTarget(event.target.value)}
            disabled={saving}
          >
            <option value="all">{t("All panels")}</option>
            {panels.map((panel) => (
              <option key={panel.id} value={panel.id}>
                {t(panel.title)}
              </option>
            ))}
          </select>
          {(
            [
              ["accent", "Accent", "#a78bfa"],
              ["background", "Panel background", "#182032"],
              ["text", "Text", "#e8edf5"],
            ] as const
          ).map(([key, label, fallback]) => (
            <label key={key}>
              {t(label)}{" "}
              <input
                type="color"
                aria-label={t(label)}
                value={color[key] ?? view.appearance[key] ?? fallback}
                disabled={saving}
                onChange={(event) =>
                  setColor({ ...color, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => setColor({})}
          >
            {t("Reset colours")}
          </Button>
        </div>
      )}
      {editing && (
        <p className="dm-workspace-hint">
          {t(
            "Drag a panel by its handle, or use the arrows to move it. Save when finished.",
          )}
        </p>
      )}
      {header}
      <div
        className="dm-workspace-columns"
        style={{ "--dm-columns": view.columns.length } as React.CSSProperties}
      >
        {view.columns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            data-workspace-column={columnIndex}
            className={`dm-workspace-column${editing ? " editing" : ""}`}
          >
            {column.map((id, index) => {
              const panel = panels.find((p) => p.id === id);
              if (!panel) return null;
              return (
                <section
                  key={id}
                  data-workspace-panel={id}
                  aria-label={t(panel.title)}
                  className="dm-workspace-panel"
                  style={{
                    ...appearanceStyle(view.colors[id] ?? {}),
                    opacity: dragId === id ? 0.45 : 1,
                  }}
                >
                  {editing && (
                    <div className="dm-workspace-panel-tools">
                      <button
                        type="button"
                        aria-label={`${t("Move panel")}: ${t(panel.title)}`}
                        disabled={saving}
                        style={{ touchAction: "none", cursor: "grab" }}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return;
                          event.preventDefault();
                          setDrag({ id, x: event.clientX, y: event.clientY });
                        }}
                      >
                        ⠿
                      </button>
                      <span>{t(panel.title)}</span>
                      {(
                        [
                          ["left", "←"],
                          ["up", "↑"],
                          ["down", "↓"],
                          ["right", "→"],
                        ] as const
                      ).map(([direction, symbol]) => (
                        <button
                          key={direction}
                          type="button"
                          aria-label={`${t(`Move ${direction}`)}: ${t(panel.title)}`}
                          disabled={
                            saving ||
                            (direction === "left"
                              ? columnIndex === 0
                              : direction === "right"
                                ? columnIndex === view.columns.length - 1
                                : direction === "up"
                                  ? index === 0
                                  : index === column.length - 1)
                          }
                          onClick={() =>
                            nudge(id, columnIndex, index, direction)
                          }
                        >
                          {symbol}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-label={`${t("Colours")}: ${t(panel.title)}`}
                        onClick={() => {
                          setColorTarget(id);
                          setShowColors(true);
                        }}
                      >
                        ◉
                      </button>
                    </div>
                  )}
                  {panel.content}
                </section>
              );
            })}
            {editing && (
              <div className="dm-workspace-hint">{t("Drop a panel here")}</div>
            )}
          </div>
        ))}
      </div>
      {drag && (
        <div
          className="dm-workspace-drag"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
        >
          {t(panels.find((p) => p.id === drag.id)?.title ?? "Panel")}
        </div>
      )}
    </div>
  );
}
