import { beforeEach } from "vitest";

// These suites render with createRoot and React.act directly, rather than a
// testing library that configures React's act environment for us.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  // Some tests restore stubbed globals during cleanup. Reapply for every test.
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
