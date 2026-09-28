/**
 * A reporter for `node --test` that stays silent while everything passes.
 *
 * The default `spec` reporter prints one line per test — roughly 43 KB for this
 * suite — which is noise in a terminal and expensive when an agent reads it.
 * This prints only what you actually need: failures (with their error and
 * location) and the final tally. Use `npm run test:verbose` for the full list.
 */
export default async function* quietTestReporter(source) {
  let failures = 0;

  for await (const event of source) {
    switch (event.type) {
      case "test:fail": {
        const error = event.data.details?.error;
        // A suite fails because a test inside it failed; that inner failure is
        // reported on its own, so skip the echo.
        if (error?.failureType === "subtestsFailed") break;
        failures += 1;
        const where = event.data.file ? `${event.data.file}:${event.data.line ?? 0}` : "unknown file";
        yield `\n✖ ${event.data.name}\n  ${where}\n`;
        yield `${String(error?.stack ?? error?.message ?? error ?? "")
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n")}\n`;
        break;
      }

      // Anything a test wrote to stdout/stderr is deliberate; keep it.
      case "test:stderr":
      case "test:stdout":
        yield event.data.message;
        break;

      // Emitted once per file and once for the whole run; the run-level one has no file.
      case "test:summary": {
        if (event.data.file) break;
        const { tests, passed, failed, skipped, todo } = event.data.counts;
        const seconds = (event.data.duration_ms / 1000).toFixed(1);
        const extra = [skipped ? `${skipped} skipped` : "", todo ? `${todo} todo` : ""].filter(Boolean).join(", ");
        yield `${failed > 0 ? "FAIL" : "PASS"} ${passed}/${tests} passed`
          + (failed > 0 ? `, ${failed} failed` : "")
          + (extra ? `, ${extra}` : "")
          + ` in ${seconds}s\n`;
        break;
      }

      default:
        break;
    }
  }

  if (failures > 0) yield "";
}
