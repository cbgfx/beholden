import * as React from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { expandSchool } from "../../domain/compendium/expandSchool";
import type { useCompendiumSpellSearch } from "../../domain/compendium/useSpellSearch";
import { togglePillStyle } from "../../ui/browserStyles";
import { useInfiniteScroll } from "../../ui/useInfiniteScroll";
import { COMPENDIUM_COLORS as C, CompendiumSelect, searchInputStyle } from "./compendiumStyle";

export type SpellSearch = ReturnType<typeof useCompendiumSpellSearch>;

const COMPONENTS = [
  { label: "V", name: "Verbal" },
  { label: "S", name: "Somatic" },
  { label: "M", name: "Material" },
] as const;

/**
 * The spell browser's search box and filters: level, school, class, ruleset, components,
 * concentration and ritual.
 */
export function SpellFilterBar({ search }: { search: SpellSearch }) {
  const translateUi = useUiTranslation("sharedUi");
  const pill = (active: boolean, color: string) => togglePillStyle(active, color, C.panelBorder, C.muted);
  const selectStyle = { width: "100%" };
  const componentState = {
    V: [search.filterV, search.setFilterV],
    S: [search.filterS, search.setFilterS],
    M: [search.filterM, search.setFilterM],
  } as const;

  return (
    <>
      <input value={search.q} placeholder={translateUi("Search spells...")} onChange={(event) => search.setQ(event.target.value)} style={searchInputStyle} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        <CompendiumSelect value={search.level} onChange={(event) => search.setLevel(event.target.value)} style={selectStyle} title={translateUi("Filter by level")}>
          <option value="all">{translateUi("All Levels")}</option>
          <option value="0">{translateUi("Cantrip")}</option>
          {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
            <option key={level} value={String(level)}>{translateUi("Level {{value1}}", { value1: level })}</option>
          ))}
        </CompendiumSelect>
        <CompendiumSelect value={search.schoolFilter} onChange={(event) => search.setSchoolFilter(event.target.value)} style={selectStyle} title={translateUi("Filter by school")}>
          {search.schoolOptions.map((school) => (
            <option key={school} value={school}>{school === "all" ? translateUi("All Schools") : expandSchool(school)}</option>
          ))}
        </CompendiumSelect>
        <CompendiumSelect value={search.classFilter} onChange={(event) => search.setClassFilter(event.target.value)} style={selectStyle} title={translateUi("Filter by class")}>
          {search.classOptions.map((cls) => (
            <option key={cls} value={cls}>{cls === "all" ? translateUi("All Classes") : cls}</option>
          ))}
        </CompendiumSelect>
        {search.availableRulesets.length > 1 && (
          <CompendiumSelect
            value={search.rulesetFilter}
            onChange={(event) => search.setRulesetFilter(event.target.value as "5e" | "5.5e" | "")}
            style={selectStyle}
            title={translateUi("Filter by ruleset")}
          >
            <option value="">{translateUi("All Rulesets")}</option>
            <option value="5.5e">5.5e</option>
            <option value="5e">5e</option>
          </CompendiumSelect>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {COMPONENTS.map(({ label, name }) => {
          const [active, setActive] = componentState[label];
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActive(!active)}
              title={active
                ? translateUi("Showing {{value1}} component spells", { value1: translateUi(name) })
                : translateUi("Hiding {{value1}} component spells", { value1: translateUi(name) })}
              style={pill(active, C.accent)}
            >
              {label}
            </button>
          );
        })}
        <button type="button" onClick={() => search.setFilterConcentration(!search.filterConcentration)} style={pill(search.filterConcentration, C.highlight)}>
          {translateUi("Concentration")}
        </button>
        <button type="button" onClick={() => search.setFilterRitual(!search.filterRitual)} style={pill(search.filterRitual, C.highlight)}>
          {translateUi("Ritual")}
        </button>
        {search.hasActiveFilters && (
          <button type="button" onClick={search.clearFilters} style={pill(false, C.highlight)}>
            {translateUi("Clear")}
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Infinite scrolling for the spell list, plus a return to the top whenever the search changes:
 * a new search starts from page one, and a reader left halfway down the old list would otherwise
 * immediately page the new one back to that depth.
 */
export function useSpellListScroll(search: SpellSearch) {
  const { containerRef, onScroll } = useInfiniteScroll({
    hasMore: search.hasMore,
    loadingMore: search.loadingMore,
    loadMore: search.loadMore,
  });
  const { q, level, schoolFilter, classFilter, filterV, filterS, filterM, filterConcentration, filterRitual, rulesetFilter } = search;
  React.useEffect(() => {
    const element = containerRef.current;
    if (element) element.scrollTop = 0;
  }, [containerRef, q, level, schoolFilter, classFilter, filterV, filterS, filterM, filterConcentration, filterRitual, rulesetFilter]);
  return { containerRef, onScroll };
}
