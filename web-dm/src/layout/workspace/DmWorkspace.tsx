import { useColumnNavigation } from "@beholden/shared/ui/useColumnNavigation";
import { workspaceColumnIcon } from "./workspaceColumnPresentation";
import React from "react";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { Button } from "@/ui/Button";
import { LayoutEditorToolbar } from "@beholden/shared/ui/LayoutEditorToolbar";
import {
  defaultPreferences,
  movePanel,
  normalizePreferences,
  resizeColumns,
  type PanelAppearance,
  type WorkspaceView,
} from "./workspaceLayout";
import "./workspace.css";
import { useIsNarrow } from "@beholden/shared/ui/useIsNarrow";
import {
  ColumnHeading,
  ColumnTabs,
  showsColumnHeading,
  type ColumnView,
} from "@beholden/shared/ui/ColumnNavigation";
import { PanelCard } from "@beholden/shared/ui/LayoutPanelCard";
import { WorkspaceBottomBar } from "./WorkspaceBottomBar";

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
  allowLayoutEditing?: boolean;
  fixedLayout?: boolean;
  /** Show one saved column at a time without changing stored layout preferences. */
  compact?: boolean;
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
  allowLayoutEditing = true,
  fixedLayout = false,
  compact: compactRequested = false,
}: Props) {
  const t = useUiTranslation("dmUi");
  const narrow = useIsNarrow("(max-width: 1024px)");
  const compact = compactRequested || (narrow && !fixedLayout);
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
  const [editingRequested, setEditing] = React.useState(false);
  const editing = editingRequested && !compact;
  const [colorTarget, setColorTarget] = React.useState("all");
  const [showColors, setShowColors] = React.useState(false);
  const [drag, setDrag] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [retry, setRetry] = React.useState(0);
  const [revision, setRevision] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = React.useState({
    left: false,
    right: false,
  });
  React.useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const update = () =>
      setScrollEdges((previous) => {
        const left = element.scrollLeft > 2;
        const right =
          element.scrollWidth - element.clientWidth - element.scrollLeft > 2;
        return previous.left === left && previous.right === right
          ? previous
          : { left, right };
      });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    const columns = element.querySelector(".dm-workspace-columns");
    if (columns) observer?.observe(columns);
    window.addEventListener("resize", update);
    return () => {
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  });
  const endpoint = `/api/me/workspaces/${workspace}`;
  const normalized = normalizePreferences(preferences, defaults);
  const view = normalized.views.find((v) => v.id === normalized.activeId)!;
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const navigation = useColumnNavigation(
    `${workspace}:${view.id}`,
    view.columns.length,
    compact,
    scrollRef,
  );
  const columnView: ColumnView = {
    columns: view.columns.length,
    columnHeaders: view.columnHeaders,
    columnDefaults: view.columns.map((column) => {
      const first = panels.find((panel) => panel.id === column[0]);
      return {
        name: first ? t(first.title) : undefined,
        icon: workspaceColumnIcon(first?.id),
      };
    }),
  };
  const viewRef = React.useRef(view);
  viewRef.current = view;
  React.useEffect(() => {
    if (fixedLayout) {
      setPreferences(defaultPreferences(defaultsRef.current));
      setLoaded(true);
      setError(null);
      return;
    }
    let active = true;
    api<unknown>(endpoint)
      .then((value) => {
        if (!active) return;
        const next = normalizePreferences(value, defaultsRef.current);
        setRevision(
          value &&
            typeof value === "object" &&
            "revision" in value &&
            typeof value.revision === "string"
            ? value.revision
            : null,
        );
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
  }, [endpoint, fixedLayout, retry]);

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
      const result = await api<{ revision: string }>(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, expectedRevision: revision }),
      });
      if (result?.revision) setRevision(result.revision);
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
      ref={(node) => {
        rootRef.current = node;
        scrollRef.current =
          node?.closest<HTMLDivElement>(".shellLayout") ?? node;
      }}
      className={`dm-workspace${compact ? " is-compact" : ""}`}
      style={{
        ...appearanceStyle(view.appearance),
        boxShadow: `${scrollEdges.left ? "inset 10px 0 10px -8px rgba(56, 182, 255, 0.3)" : "inset 0 0 transparent"}, ${scrollEdges.right ? "inset -10px 0 10px -8px rgba(56, 182, 255, 0.3)" : "inset 0 0 transparent"}`,
        background: view.appearance.background
          ? `color-mix(in srgb, ${view.appearance.background} 65%, #000)`
          : undefined,
      }}
    >
      {!fixedLayout && (
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
          {!editing && allowLayoutEditing && !compact ? (
            <>
              <button
                className="dm-workspace-icon-button"
                type="button"
                disabled={!loaded || saving}
                onClick={() => setEditing(true)}
                title={t("Customize layout")}
                aria-label={t("Customize layout")}
              >
                <span aria-hidden="true">&#9998;</span>
              </button>
            </>
          ) : editing ? (
            <LayoutEditorToolbar
              activeView={{ ...view, columns: view.columns.length }}
              panels={panels.map((panel) => ({
                id: panel.id,
                title: t(panel.title),
              }))}
              minColumns={1}
              maxColumns={4}
              protectedView={false}
              canReset
              canDuplicate={normalized.views.length < 12}
              canDelete={normalized.views.length > 1}
              disabled={saving}
              onRename={(name) => updateView((v) => ({ ...v, name }))}
              onAddColumn={() =>
                updateView((v) => ({
                  ...v,
                  columns: resizeColumns(v.columns, v.columns.length + 1),
                }))
              }
              onRemoveColumn={() =>
                updateView((v) => ({
                  ...v,
                  columns: resizeColumns(v.columns, v.columns.length - 1),
                  columnHeaders: v.columnHeaders?.slice(
                    0,
                    v.columns.length - 1,
                  ),
                }))
              }
              onReset={() =>
                updateView((v) => ({
                  ...v,
                  columns: defaults.map((c) => [...c]),
                  columnHeaders: [],
                  colors: {},
                  appearance: {},
                }))
              }
              onDuplicate={() => {
                if (normalized.views.length >= 12) return;
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
              onDelete={() => {
                const remaining = normalized.views.filter(
                  (v) => v.id !== view.id,
                );
                setPreferences({ activeId: remaining[0].id, views: remaining });
              }}
              colorsOpen={showColors}
              colorTarget={colorTarget}
              globalColors={{
                accent: color.accent ?? view.appearance.accent ?? "#38b6ff",
                background:
                  color.background ?? view.appearance.background ?? "#182032",
                text: color.text ?? view.appearance.text ?? "#e8edf5",
              }}
              onToggleColors={() => setShowColors((value) => !value)}
              onColorTargetChange={setColorTarget}
              onColorChange={(key, value) =>
                setColor({ ...color, [key]: value })
              }
              onResetColors={() => setColor({})}
              trailing={
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? t("Saving...") : t("Done")}
                </Button>
              }
            />
          ) : null}
        </div>
      )}
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
      {header}
      <div
        className="dm-workspace-columns"
        style={
          {
            "--dm-columns": view.columns.length,
            ...(compact ? { gridTemplateColumns: "minmax(0, 1fr)" } : {}),
          } as React.CSSProperties
        }
      >
        {view.columns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            hidden={compact && navigation.active !== columnIndex}
            style={
              compact && navigation.active !== columnIndex
                ? { display: "none" }
                : undefined
            }
            data-workspace-column={columnIndex}
            className={`dm-workspace-column${editing ? " editing" : ""}`}
          >
            {showsColumnHeading(view, columnIndex, { compact, editing }) ? (
              <ColumnHeading
                view={columnView}
                index={columnIndex}
                editing={editing}
                accent="var(--dm-panel-accent, var(--campaign-accent, #38b6ff))"
                onChange={(header) =>
                  updateView((v) => ({
                    ...v,
                    columnHeaders: v.columns.map((_, index) =>
                      index === columnIndex
                        ? header
                        : (v.columnHeaders?.[index] ?? {}),
                    ),
                  }))
                }
              />
            ) : null}
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
                  {editing ? (
                    <PanelCard
                      title={t(panel.title)}
                      dragging={dragId === id}
                      rowRef={() => {}}
                      onPointerDown={(event) => {
                        if (event.button !== 0 || saving) return;
                        event.preventDefault();
                        setDrag({ id, x: event.clientX, y: event.clientY });
                      }}
                      onOpenColors={() => {
                        setColorTarget(id);
                        setShowColors(true);
                      }}
                      actions={
                        <details className="dm-workspace-move-menu">
                          <summary
                            aria-label={`${t("Move panel")}: ${t(panel.title)}`}
                          >
                            ...
                          </summary>
                          <div>
                            {(["left", "up", "down", "right"] as const).map(
                              (direction) => (
                                <button
                                  key={direction}
                                  type="button"
                                  aria-label={`${t(`Move ${direction}`)}: ${t(panel.title)}`}
                                  disabled={
                                    saving ||
                                    (direction === "left"
                                      ? columnIndex === 0
                                      : direction === "right"
                                        ? columnIndex ===
                                          view.columns.length - 1
                                        : direction === "up"
                                          ? index === 0
                                          : index === column.length - 1)
                                  }
                                  onClick={() =>
                                    nudge(id, columnIndex, index, direction)
                                  }
                                >
                                  {t(`Move ${direction}`)}
                                </button>
                              ),
                            )}
                          </div>
                        </details>
                      }
                    />
                  ) : (
                    panel.content
                  )}
                </section>
              );
            })}
            {editing && (
              <div className="dm-workspace-hint">{t("Drop a panel here")}</div>
            )}
          </div>
        ))}
      </div>
      {compact ? (
        <WorkspaceBottomBar>
          <ColumnTabs
            view={columnView}
            active={navigation.active}
            onSelect={navigation.select}
            accent="var(--dm-panel-accent, var(--campaign-accent, #38b6ff))"
          />
        </WorkspaceBottomBar>
      ) : null}
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
