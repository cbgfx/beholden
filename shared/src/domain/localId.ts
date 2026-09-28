/**
 * Short random id for records the browser creates inside a saved document (notes, inventory
 * containers and items, sheet views). It only needs to be unique within that document; it is not
 * a database id.
 */
export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
