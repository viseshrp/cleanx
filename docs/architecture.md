# Architecture

CleanX is a Chrome Manifest V3 extension built with the WXT/pnpm layout shared
by TabMD and NuffTabs. Only `popup.html` is packaged as a UI page. Runtime code
uses functions, native DOM elements, and Chrome APIs.

## Components

| Component | Responsibility |
| --- | --- |
| `background/index.ts` | Register a declarative rule that enables the toolbar action only on HTTPS `x.com` |
| `content/index.ts` | Start on X, read settings, subscribe to storage, answer popup context requests, clean up on invalidation |
| `content/media.ts` | Find media boundaries, distinguish explicit GIFs, resolve media authors and stable identities |
| `content/filter.ts` | Maintain placeholders, pause blocked players, honor the whitelist and temporary reveals |
| `popup/` and `shared/` | Display current-page counts; persist three independent switches and the username list |

## Media handling

The content script recognizes `tweetPhoto`, `videoPlayer`, `videoComponent`,
article videos, images within `card.wrapper`, and media images linked to post
status URLs in search/profile grids. X uses both nesting orders
for its player wrappers; CleanX chooses the outer player and creates one
placeholder. Card image containers are covered because X also paints the image
as a CSS background. Profile avatars and banners are outside these targets.

GIF identification uses `.gif`, `format=gif`, `tweet_video`,
`tweet_video_thumb`, and explicit GIF labels on a player. Ordinary looping,
muted videos remain videos. Video thumbnail paths such as `ext_tw_video_thumb`
and `amplify_video_thumb` are classified as videos even before a player exists. This keeps the GIF and video switches independent.

A photo's own status link is the first source for its author. Otherwise the
nearest ancestor containing `User-Name` supplies the author. That nearest
boundary keeps quoted posts separate from the containing post. Unknown authors
receive the normal blocking settings.

Each media root gets an extension-owned Shadow DOM placeholder. CSS hides its
original children without replacing or reparenting X's content. This preserves
X's layout and event handlers. Revealing the media exposes the original content
and changes the placeholder to a small hide-again button. Placeholder clicks
stop before X's link handlers.

The filter tracks media wrappers in a map and temporary reveals in a set for the
current document. A `MutationObserver` batches relevant DOM changes into a scan
at most once per 32 milliseconds. Detached wrappers are removed from the map.
No idle polling, timers for background refresh, network calls, or post history
are used. Popup counts describe currently mounted, blocked media, not all posts
that have ever appeared in an infinite feed.

Blocked videos have autoplay disabled and are paused. A capture listener also
pauses later `play` events, including players inserted before the next scan.
The original autoplay value is restored when blocking ends. CleanX does not
force a newly revealed video to play.

## Permissions

| Permission | Reason |
| --- | --- |
| `storage` | Store the switches and usernames locally |
| `declarativeContent` | Enable the toolbar action on X without monitoring browsing history |
| `https://x.com/*` host access | Run the content script and obtain the active X tab's URL/title |

There is no `tabs`, `scripting`, `webRequest`, cookie, identity, or all-sites
permission. The manifest disables the action by default. An exact-host rule
enables it only on HTTPS `x.com`; subdomains and lookalike domains do not match.
The popup separately verifies its active tab before enabling controls.

Chrome API details: [action](https://developer.chrome.com/docs/extensions/reference/api/action),
[declarativeContent](https://developer.chrome.com/docs/extensions/reference/api/declarativeContent).
WXT entrypoint conventions: [entrypoints](https://wxt.dev/guide/essentials/entrypoints).
