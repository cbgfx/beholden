import { expect, it } from "vitest";
import { filterPlaces, placeFilterOptions, reconcilePlaceFilters, emptyPlaceFilters } from "./placeFilters";
const rows = [
  { id: "planes", name: "Planes", referenceType: "continents", parent: null },
  { id: "lower", name: "Lower Planes", referenceType: "countries", parent: { id: "planes" } },
  { id: "hells", name: "Nine Hells", referenceType: "locations", parent: { id: "lower" } },
  { id: "city", name: "Infernal City", referenceType: "points-of-interest", parent: { id: "hells" } },
  { id: "upper", name: "Upper Planes", referenceType: "countries", parent: { id: "planes" } },
  { id: "elysium", name: "Elysium", referenceType: "locations", parent: { id: "upper" } },
];
it("Country Lower Planes includes that country and its nested places", () => {
  expect(filterPlaces(rows, "", { ...emptyPlaceFilters(), countries: ["lower"] }).map((row) => row.id)).toEqual(["lower", "hells", "city"]);
});
it("combines filter fields with AND and selections in one field with OR", () => {
  expect(filterPlaces(rows, "", { ...emptyPlaceFilters(), countries: ["lower", "upper"], locations: ["hells"] }).map((row) => row.id)).toEqual(["hells", "city"]);
  expect(filterPlaces(rows, "", { ...emptyPlaceFilters(), countries: ["upper"], locations: ["hells"] })).toEqual([]);
});
it("supports every hierarchy level, name search, None, and clearing", () => {
  expect(filterPlaces(rows, "", { ...emptyPlaceFilters(), continents: ["planes"] })).toEqual(rows);
  expect(filterPlaces(rows, "", { ...emptyPlaceFilters(), "points-of-interest": ["city"] }).map((row) => row.id)).toEqual(["city"]);
  expect(filterPlaces(rows, "nine", { ...emptyPlaceFilters(), countries: ["lower"] }).map((row) => row.id)).toEqual(["hells"]);
  expect(filterPlaces(rows, "", { ...emptyPlaceFilters(), countries: ["__none__"] }).map((row) => row.id)).toEqual(["planes"]);
  expect(filterPlaces(rows, "", emptyPlaceFilters())).toEqual(rows);
});
it("terminates on malformed cyclic parent links", () => {
  const cycle = [{ id: "a", name: "A", referenceType: "locations", parent: { id: "b" } }, { id: "b", name: "B", referenceType: "locations", parent: { id: "a" } }];
  expect(filterPlaces(cycle, "", { ...emptyPlaceFilters(), countries: ["missing"] })).toEqual([]);
});

it("cascades choices through every level without hiding alternatives in the same picker", () => {
  const all = [...rows, { id: "world", name: "World", referenceType: "continents", parent: null },
    { id: "nation", name: "Nation", referenceType: "countries", parent: { id: "world" } },
    { id: "town", name: "Town", referenceType: "locations", parent: { id: "nation" } }];
  const filters = { ...emptyPlaceFilters(), continents: ["planes"], countries: ["lower"], locations: ["hells"] };
  expect(placeFilterOptions(all, filters, "continents").map((row) => row.id)).toEqual(["planes", "world"]);
  expect(placeFilterOptions(all, filters, "countries").map((row) => row.id)).toEqual(["lower", "upper"]);
  expect(placeFilterOptions(all, filters, "locations").map((row) => row.id)).toEqual(["hells"]);
  expect(placeFilterOptions(all, filters, "points-of-interest").map((row) => row.id)).toEqual(["city"]);
});
it("removes invalid downstream selections when a parent changes", () => {
  expect(reconcilePlaceFilters(rows, { ...emptyPlaceFilters(), countries: ["upper"], locations: ["hells"], "points-of-interest": ["city"] })).toEqual({ ...emptyPlaceFilters(), countries: ["upper"] });
});
it("supports multiple parents and clearing upstream selections", () => {
  const filters = { ...emptyPlaceFilters(), countries: ["lower", "upper"] };
  expect(placeFilterOptions(rows, filters, "locations").map((row) => row.id)).toEqual(["hells", "elysium"]);
  const cleared = { ...emptyPlaceFilters(), locations: ["hells"] };
  expect(reconcilePlaceFilters(rows, cleared)).toBe(cleared);
  expect(placeFilterOptions(rows, cleared, "countries").map((row) => row.id)).toEqual(["lower", "upper"]);
});
