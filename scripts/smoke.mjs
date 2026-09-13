import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

// Adapted from TabMD's file-presence smoke check; inspect the shipped build too.
const required = ["package.json", "wxt.config.ts", "README.md", "entrypoints/background/index.ts", "entrypoints/popup/index.html"];
for (const file of required) assert.ok(existsSync(file), `Missing ${file}`);
const output = resolve(".output/chrome-mv3");
const manifest = JSON.parse(readFileSync(resolve(output, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, "CleanX");
assert.equal(manifest.action.default_popup, "popup.html");
assert.equal(manifest.action.default_state, "disabled");
assert.deepEqual(manifest.permissions, ["storage", "declarativeContent"]);
assert.deepEqual(manifest.host_permissions, ["https://x.com/*"]);
assert.equal(manifest.options_page, undefined);
assert.equal(manifest.options_ui, undefined);
assert.equal(manifest.chrome_url_overrides, undefined);
assert.equal(manifest.default_locale, undefined);
assert.equal(manifest.content_scripts.length, 1);
assert.deepEqual(manifest.content_scripts[0].matches, ["https://x.com/*"]);
assert.equal(manifest.content_scripts[0].run_at, "document_start");
assert.equal(manifest.web_accessible_resources, undefined);
assert.deepEqual(readdirSync(output).filter(path => path.endsWith(".html")), ["popup.html"]);
for (const path of Object.values(manifest.icons)) assert.ok(existsSync(resolve(output, path)), `Missing ${path}`);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, "Runtime dependencies must stay empty");
for (const file of readdirSync(".output").filter(path => path.endsWith(".zip"))) {
  const size = statSync(resolve(".output", file)).size;
  assert.ok(size <= 100 * 1024, `${file} exceeds 100 KiB`);
  console.log(`${file}: ${(size / 1024).toFixed(1)} KiB / 100 KiB`);
}
console.log("Smoke check passed: popup only, X only, narrow permissions, no runtime dependencies.");
