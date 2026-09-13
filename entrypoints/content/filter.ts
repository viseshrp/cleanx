import placeholderCss from "./placeholder.css?inline";
import { mediaIdentity, mediaOwner, mediaRoots, mediaType } from "./media";
import {
	DEFAULT_SETTINGS,
	type MediaType,
	type Settings,
} from "../shared/settings";
import type { PageContext } from "../shared/context";

type Item = {
	root: HTMLElement;
	host: HTMLElement;
	button: HTMLButtonElement;
	label: HTMLElement;
	type: MediaType;
	identity: string;
	blocked: boolean;
	autoplay: Map<HTMLVideoElement, boolean>;
};

const LABELS = { video: "Video", image: "Image", gif: "GIF" };
const MARK =
	'<svg viewBox="0 0 128 128" fill="none" aria-hidden="true"><path d="M85 38a34 34 0 1 0 0 52" stroke="currentColor" stroke-width="13" stroke-linecap="round"/><path d="m77 51 22 26M99 51 77 77" stroke="currentColor" stroke-width="10" stroke-linecap="round"/></svg>';

export function startFilter() {
	let settings: Settings = DEFAULT_SETTINGS;
	const items = new Map<HTMLElement, Item>();
	const revealed = new Set<string>();
	let scheduled: number | undefined;

	function pause(item: Item) {
		for (const video of item.root.querySelectorAll("video")) {
			if (!item.autoplay.has(video)) item.autoplay.set(video, video.autoplay);
			video.autoplay = false;
			if (!video.paused) video.pause();
		}
	}

	function restorePlayback(item: Item) {
		for (const [video, autoplay] of item.autoplay) video.autoplay = autoplay;
		item.autoplay.clear();
	}

	function updateItem(item: Item) {
		const username = mediaOwner(item.root).username;
		const enabled =
			settings[item.type] &&
			!(username && settings.whitelist.includes(username));
		const isRevealed = revealed.has(item.identity);
		item.blocked = Boolean(enabled && !isRevealed);
		item.root.dataset.cleanxState = item.blocked ? "hidden" : "visible";
		item.root.dataset.cleanxKind = item.type;
		item.host.hidden = !enabled;
		item.host.style.display = enabled ? "" : "none";
		item.host.toggleAttribute("revealed", isRevealed);
		item.label.textContent = isRevealed
			? `Hide ${LABELS[item.type].toLowerCase()}`
			: `${LABELS[item.type]} hidden`;
		item.button.setAttribute(
			"aria-label",
			`${isRevealed ? "Hide" : "Show"} ${LABELS[item.type].toLowerCase()}`,
		);
		if (item.blocked) pause(item);
		else restorePlayback(item);
	}

	function createItem(
		root: HTMLElement,
		type: MediaType,
		identity: string,
	): Item {
		const host = document.createElement("cleanx-placeholder");
		const shadow = host.attachShadow({ mode: "open" });
		// Static, extension-owned markup. No post text or user input enters innerHTML.
		shadow.innerHTML = `<style>${placeholderCss}</style><button type="button">${MARK}<strong></strong><small>Click to show</small></button>`;
		const button = shadow.querySelector("button") as HTMLButtonElement;
		const label = shadow.querySelector("strong") as HTMLElement;
		const item: Item = {
			root,
			host,
			button,
			label,
			type,
			identity,
			blocked: false,
			autoplay: new Map(),
		};
		host.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
		});
		button.addEventListener("click", () => {
			if (revealed.has(item.identity)) revealed.delete(item.identity);
			else revealed.add(item.identity);
			updateItem(item);
		});
		if (getComputedStyle(root).position === "static")
			root.dataset.cleanxPosition = "";
		root.dataset.cleanxRoot = "";
		root.append(host);
		return item;
	}

	function removeItem(item: Item) {
		restorePlayback(item);
		item.host.remove();
		for (const name of [
			"data-cleanx-root",
			"data-cleanx-position",
			"data-cleanx-state",
			"data-cleanx-kind",
		])
			item.root.removeAttribute(name);
	}

	function scan() {
		const roots = new Set(mediaRoots(document));
		for (const [root, item] of items) {
			if (!root.isConnected || !roots.has(root)) {
				removeItem(item);
				items.delete(root);
			}
		}
		for (const root of roots) {
			const type = mediaType(root);
			const identity = mediaIdentity(root, type);
			let item = items.get(root);
			if (!item) {
				item = createItem(root, type, identity);
				items.set(root, item);
			}
			item.type = type;
			item.identity = identity;
			// X can replace children while reusing their media wrapper.
			if (item.host.parentElement !== root) root.append(item.host);
			updateItem(item);
		}
	}

	function schedule() {
		if (scheduled !== undefined) return;
		scheduled = window.setTimeout(() => {
			scheduled = undefined;
			scan();
		}, 32);
	}

	const observer = new MutationObserver((changes) => {
		if (
			changes.some((change) => {
				if (change.type === "attributes") return true;
				return [...change.addedNodes, ...change.removedNodes].some(
					(node) =>
						!(
							node instanceof HTMLElement &&
							node.tagName === "CLEANX-PLACEHOLDER"
						),
				);
			})
		)
			schedule();
	});
	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["src", "poster", "href", "aria-label", "data-testid"],
	});

	function stopPlay(event: Event) {
		const video = event.target;
		if (!(video instanceof HTMLVideoElement)) return;
		for (const item of items.values()) {
			if (item.blocked && (item.root === video || item.root.contains(video))) {
				video.pause();
				return;
			}
		}
		// Cover a newly inserted player before the next batched scan.
		scan();
	}
	document.addEventListener("play", stopPlay, true);

	return {
		update(next: Settings) {
			settings = next;
			scan();
		},
		context(): PageContext {
			const counts = { video: 0, image: 0, gif: 0 };
			for (const item of items.values())
				if (item.blocked && item.root.isConnected) counts[item.type]++;
			return { url: location.href, title: document.title, counts };
		},
		stop() {
			observer.disconnect();
			clearTimeout(scheduled);
			document.removeEventListener("play", stopPlay, true);
			for (const item of items.values()) removeItem(item);
			items.clear();
			revealed.clear();
		},
	};
}
