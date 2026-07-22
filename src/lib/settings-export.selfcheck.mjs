// ponytail: no test framework in this repo; smallest runnable check for the
// import/export parsing logic. Run with:
//   node --experimental-strip-types src/lib/settings-export.selfcheck.mjs
import assert from "node:assert";
import { buildSettingsExport, parseSettingsImport } from "./settings-export.ts";

// Round-trip: export what's "in storage", then re-parse it as an import.
const store = {
  "webcal:connections": JSON.stringify({ state: { connections: [{ id: "1" }] } }),
  "proton-cal:ui": JSON.stringify({ state: { view: "week" } }),
};
const exported = buildSettingsExport((key) => store[key] ?? null);
assert.equal(exported.version, 1);
assert.deepEqual(exported.data["webcal:connections"], { state: { connections: [{ id: "1" }] } });
assert.equal(exported.data["proton-cal:rules"], undefined);

const writes = parseSettingsImport(JSON.stringify(exported));
assert.equal(writes.length, 2);
assert.deepEqual(writes.find(([k]) => k === "proton-cal:ui"), ["proton-cal:ui", JSON.stringify({ state: { view: "week" } })]);

// Malformed files are rejected instead of silently wiping storage.
assert.throws(() => parseSettingsImport("{}"));
assert.throws(() => parseSettingsImport(JSON.stringify({ data: {} })));

console.log("settings-export self-check passed");
