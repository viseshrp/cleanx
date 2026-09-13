# Reused foundation

CleanX follows [TabMD](https://github.com/viseshrp/tabmd) at
`179dfdaeb8220701bd998f8c518f7a1e1c168cfb` and
[NuffTabs](https://github.com/viseshrp/nufftabs) at
`8187d19f2276cadcad6025472b786360eb1f182c`. Both local reference checkouts
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
| TabMD ignore file and MIT attribution | `.gitignore`, `LICENSE` | Preserve the original CleanX copyright and credit reused MIT sources |

WXT is build tooling. The popup and content logic use native DOM and Chrome
APIs. The only packaged HTML page is `popup.html`. Tests run the production
extension against synthetic X-shaped pages, without logging into an account.

Test helpers reuse TabMD's `flushMicrotasks` verbatim and its local-storage
change-event mock, trimmed to the APIs CleanX needs. The original e2e loader
was extended to test production code and synthetic media rather than separate
test-only extension pages.
