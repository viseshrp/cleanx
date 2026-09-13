# Storage

All preferences live in `chrome.storage.local` on this Chrome profile.
They are shared by X tabs in the profile and survive browser restarts.
No account, cloud sync, export service, or server is involved.

| Key | Type | Default |
| --- | --- | --- |
| `cleanx:video` | Boolean; true hides videos | `true` |
| `cleanx:image` | Boolean; true hides post and preview images | `true` |
| `cleanx:gif` | Boolean; true hides GIFs | `true` |
| `cleanx:whitelist` | Array of lowercase usernames | `[]` |

Each switch writes only its own key, so concurrent edits to different switches
do not overwrite one another. A username submission replaces the whole saved
list. Storage change listeners apply preferences to every open X tab.

Username input accepts commas, semicolons, whitespace, new lines, and one optional
leading `@`. Names contain 1–15 ASCII letters, numbers, or underscores and are
deduplicated without case sensitivity. Invalid input leaves the previous list
active and displays an inline error. Clearing the field and saving clears the list.
Draft input remains intact if another popup updates a switch.

Missing or malformed toggle values use the blocking default. Malformed saved
username entries are ignored. The popup reports storage failures and rolls back
failed switch changes. No post text, media, URLs, browsing history, or counts are
persisted. Temporary reveals exist only in the content script's memory and reset
on a full page reload.
