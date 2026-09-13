# Reused foundation

CleanX follows [TabMD](https://github.com/viseshrp/tabmd) at
`179dfdaeb8220701bd998f8c518f7a1e1c168cfb` and
[NuffTabs](https://github.com/viseshrp/nufftabs). Both local reference checkouts
were checked against their GitHub main branches before reuse.

| Source | Reused in CleanX | Adaptation |
| --- | --- | --- |
| TabMD and NuffTabs layout | `entrypoints/`, `public/icon/`, `scripts/`, `tests/{unit,integration,e2e,helpers}/`, `docs/` | Only popup, content script, background worker, and shared helpers |
| TabMD package and lockfile | WXT, pnpm, TypeScript, Biome, Vitest, Playwright and commands | Same installed versions, pinned; no runtime dependencies |
| TabMD config | WXT output naming, version override, TS config, Biome, Codecov | Chrome only; exact X host; no options, new tab, OAuth, or backup permissions |
| TabMD workflows | CI, tag-created draft releases, published-release ZIP upload | Frozen install, Node 22, actual extension tests, 100 KiB package budget |
| TabMD scripts | `version-from-tag.mjs`, `generate-icons.mjs`, `smoke.mjs` | New SVG artwork and extension-specific artifact checks |
| TabMD storage | Typed defaults, normalization, local storage, change listeners | Three independent toggle keys and one username list |
| NuffTabs interaction patterns | Plain functions and browser event handlers | No classes, adapters, or UI framework |
| TabMD license and ignore files | `LICENSE`, `.gitignore` | Same MIT owner; generated output remains ignored |

WXT is build tooling. The popup and content logic use native DOM and Chrome
APIs. The only packaged HTML page is `popup.html`. Tests run the production
extension against synthetic X-shaped pages, without logging into an account.
