export function now() {
  return Date.now();
}

export function uid() {
  // Node 20+ exposes crypto as a global. If not available, this will throw loudly.
  return crypto.randomUUID();
}
