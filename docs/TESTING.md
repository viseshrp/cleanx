# Testing

## Automated checks

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm quality
pnpm test
pnpm test:e2e
pnpm package
```

Unit and integration tests use Vitest and jsdom. Statement, branch, function,
and line coverage must each reach 90%. Only WXT entrypoint wrappers are excluded
from coverage; the production extension browser tests exercise those wrappers.
Coverage reports are generated in `coverage/`.

| Area | Checks |
| --- | --- |
| Settings and context | All-on defaults, independent writes, malformed storage, username parsing, exact X host validation |
| Media filter | Photos/previews, video/GIF distinction, both X player nesting orders, media-search grids, author matching, quote boundaries, autoplay, DOM replacement and cleanup |
| Popup | Current page/counts, toggles, validation, failed writes, unsaved drafts, cross-popup storage changes, disconnected-tab recovery |
| Production extension | Each switch, multi-tab updates, reload persistence, temporary reveal/reset, quoted whitelists, dynamic media, SPA page context, non-X deactivation, two themes and popup dimensions |
| Package | MV3, one popup HTML page, exact X host, narrow permissions, content script match, icons, no runtime dependencies, 100 KiB ZIP limit |

Playwright loads `.output/chrome-mv3` in a temporary Chromium profile. Requests
for X are intercepted and fulfilled with `tests/e2e/fixtures/feed.html`, a
synthetic SVG, and a one-second generated WebM. Tests require no X account and
never access a real feed. Chrome storage and content scripts are real extension
APIs, not mocks, in this suite. The popup's actual HTML/JS is loaded with the
fixture X tab active.

`test-results/` contains failure traces and screenshots. The theme test also
captures the popup and placeholder in both themes; reviewed copies are in
`docs/screenshots/`. Generated test profiles and output are not committed.

## Live Chrome check

A logged-in Chrome session was used on September 13, 2026 to install the unpacked
extension, inspect the actual X DOM, and operate the native popup. Checked:

1. Photos and videos are covered on the home timeline while text and avatars remain visible.
2. Video and image switches update the existing page independently; the popup counts follow.
3. Saving a username restores that author's media, and clearing the list restores blocking.
4. Real X player nesting informed the deduplication regression test.
5. Media-search thumbnail markup informed the GIF/video/image grid regression test.

The user's test switches were restored to all-on and the temporary username list
was cleared. No posts, likes, follows, messages, or account settings were changed.
The synthetic browser suite covers the full toggle matrix and failure paths.
Live popup checks used the first unpacked build. Final selector and sizing fixes
were verified in fresh Chromium profiles; reload the installed extension after
rebuilding to apply those changes to an already-running Chrome profile.

## Recheck after X changes

Open a feed, a quoted post, and a profile or search media grid. Inspect
`data-cleanx-root`, `data-cleanx-kind`, and `data-cleanx-state` on media wrappers.
A single player should have one placeholder even if X nests its player wrappers.
Confirm both a video and a GIF before trusting changes to GIF detection. Add the
new DOM shape to the synthetic fixtures before changing selectors.

CleanX hides and pauses media; tests do not claim that it prevents X's network
requests or saves a measured amount of bandwidth.
