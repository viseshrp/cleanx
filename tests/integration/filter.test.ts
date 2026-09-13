// biome-ignore-all lint/style/noNonNullAssertion: This module owns its fixed HTML; missing elements are programming errors.
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startFilter } from "../../entrypoints/content/filter";
import {
	mediaIdentity,
	mediaOwner,
	mediaRoots,
	mediaType,
} from "../../entrypoints/content/media";
import { DEFAULT_SETTINGS } from "../../entrypoints/shared/settings";

const fixture = readFileSync("tests/e2e/fixtures/feed.html", "utf8");
let filter: ReturnType<typeof startFilter>;
const photo = () =>
	document.querySelector<HTMLElement>(
		'#photo-post [data-testid="tweetPhoto"]',
	)!;
const video = () =>
	document.querySelector<HTMLElement>(
		'#video-post [data-testid="videoComponent"]',
	)!;
const gif = () =>
	document.querySelector<HTMLElement>(
		'#gif-post [data-testid="videoComponent"]',
	)!;
const click = (root: HTMLElement) =>
	(
		root
			.querySelector("cleanx-placeholder")!
			.shadowRoot!.querySelector("button") as HTMLButtonElement
	).click();
const tick = async () => {
	await new Promise((resolve) => setTimeout(resolve, 70));
};

beforeEach(() => {
	document.documentElement.innerHTML = fixture;
	vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
	filter = startFilter();
	filter.update({ ...DEFAULT_SETTINGS });
});
afterEach(() => {
	filter.stop();
	vi.restoreAllMocks();
});

describe("media filtering", () => {
	it("hides photos, preview images, videos, and GIFs without duplicate video placeholders", () => {
		expect(mediaRoots(document)).toHaveLength(5);
		expect(filter.context().counts).toEqual({ image: 3, video: 1, gif: 1 });
		expect(
			document.querySelector(".avatar")!.closest("[data-cleanx-root]"),
		).toBeNull();
		expect(document.querySelectorAll("cleanx-placeholder")).toHaveLength(5);
	});
	it("treats a looping muted ordinary video separately from a GIF", () => {
		expect(mediaType(video())).toBe("video");
		expect(mediaType(gif())).toBe("gif");
		filter.update({ ...DEFAULT_SETTINGS, video: false });
		expect(video().dataset.cleanxState).toBe("visible");
		expect(gif().dataset.cleanxState).toBe("hidden");
		filter.update({ ...DEFAULT_SETTINGS, image: false, gif: false });
		expect(filter.context().counts).toEqual({ image: 0, video: 1, gif: 0 });
	});
	it("temporarily reveals and hides a single item, retaining the choice after a rescan", async () => {
		click(photo());
		expect(photo().dataset.cleanxState).toBe("visible");
		expect(filter.context().counts.image).toBe(2);
		photo().querySelector("img")!.src = "/media/landscape.svg?name=large";
		await tick();
		expect(photo().dataset.cleanxState).toBe("visible");
		click(photo());
		expect(photo().dataset.cleanxState).toBe("hidden");
	});
	it("whitelists the quote's own author, not its parent or mentioned users", () => {
		const quote = document.querySelector<HTMLElement>(
			'#quote-post [data-testid="tweetPhoto"]',
		)!;
		expect(mediaOwner(quote)).toEqual({
			username: "dave",
			post: "/dave/status/105",
		});
		filter.update({ ...DEFAULT_SETTINGS, whitelist: ["alice"] });
		expect(photo().dataset.cleanxState).toBe("visible");
		expect(quote.dataset.cleanxState).toBe("hidden");
		filter.update({ ...DEFAULT_SETTINGS, whitelist: ["dave"] });
		expect(photo().dataset.cleanxState).toBe("hidden");
		expect(quote.dataset.cleanxState).toBe("visible");
	});
	it("handles new posts, recycled wrappers, late GIF classification, and removed nodes", async () => {
		const copy = document
			.querySelector("#video-post")!
			.cloneNode(true) as HTMLElement;
		copy.id = "later-post";
		copy.querySelector("cleanx-placeholder")!.remove();
		document.querySelector("main")!.append(copy);
		await tick();
		expect(filter.context().counts.video).toBe(2);
		const root = copy.querySelector<HTMLElement>(
			'[data-testid="videoComponent"]',
		)!;
		root.querySelector("video")!.poster = "/tweet_video_thumb/new.gif";
		await tick();
		expect(root.dataset.cleanxKind).toBe("gif");
		expect(filter.context().counts).toEqual({ image: 3, video: 1, gif: 2 });
		copy.remove();
		await tick();
		expect(filter.context().counts.gif).toBe(1);
	});
	it("reattaches a placeholder after X replaces its children", async () => {
		const root = photo();
		root.innerHTML = '<img src="/media/different.svg">';
		await tick();
		expect(root.querySelectorAll("cleanx-placeholder")).toHaveLength(1);
		expect(root.dataset.cleanxState).toBe("hidden");
	});
	it("prevents autoplay and restores the original attribute when unblocked", () => {
		const player = video().querySelector("video")!;
		expect(player.autoplay).toBe(false);
		player.dispatchEvent(new Event("play"));
		expect(player.pause).toHaveBeenCalled();
		filter.update({ ...DEFAULT_SETTINGS, video: false });
		expect(player.autoplay).toBe(true);
		player.dispatchEvent(new Event("play"));
		document.body.dispatchEvent(new Event("play"));
	});
	it("pauses players that appear before the scheduled scan", () => {
		const root = document.createElement("article");
		root.innerHTML = "<div><video autoplay></video></div>";
		document.body.append(root);
		const player = root.querySelector("video")!;
		Object.defineProperty(player, "paused", { value: false });
		player.dispatchEvent(new Event("play"));
		expect(player.pause).toHaveBeenCalled();
		expect(player.autoplay).toBe(false);
	});
	it("restores DOM markers and original autoplay on shutdown", () => {
		filter.stop();
		expect(document.querySelector("cleanx-placeholder")).toBeNull();
		expect(document.querySelector("[data-cleanx-root]")).toBeNull();
		expect(document.querySelector<HTMLVideoElement>("video")!.autoplay).toBe(
			true,
		);
	});
});

describe("X media discovery", () => {
	it("covers media-search thumbnails while keeping their types and authors separate", () => {
		const grid = document.createElement("section");
		grid.innerHTML =
			'<a href="/alice/status/991/photo/1"><div><img src="/tweet_video_thumb/a.jpg"></div><span>GIF</span></a><a href="/bob/status/992/photo/1"><div><img src="/ext_tw_video_thumb/b.jpg"></div><span>0:59</span></a><a href="/carol/status/993/photo/1"><div><img src="/media/c.jpg"></div></a>';
		document.body.append(grid);
		filter.update(DEFAULT_SETTINGS);
		const roots = mediaRoots(grid);
		expect(roots.map((root) => mediaType(root))).toEqual([
			"gif",
			"video",
			"image",
		]);
		expect(roots.map((root) => mediaOwner(root).username)).toEqual([
			"alice",
			"bob",
			"carol",
		]);
		filter.update({ ...DEFAULT_SETTINGS, gif: false });
		expect(roots.map((root) => root.dataset.cleanxState)).toEqual([
			"visible",
			"hidden",
			"hidden",
		]);
		filter.update({ ...DEFAULT_SETTINGS, whitelist: ["bob"] });
		expect(roots.map((root) => root.dataset.cleanxState)).toEqual([
			"hidden",
			"visible",
			"hidden",
		]);
	});
	it("uses explicit GIF sources or badges and handles unloaded players", () => {
		const root = document.createElement("div");
		for (const source of [
			"/media/thing.gif",
			"/media/thing?format=gif&name=small",
			"/tweet_video/thing.mp4",
		]) {
			root.innerHTML = `<img src="${source}">`;
			expect(mediaType(root)).toBe("gif");
		}
		for (const badge of [
			"<span>GIF</span>",
			'<span aria-label="Play GIF"></span>',
		]) {
			root.innerHTML = `<video></video>${badge}`;
			expect(mediaType(root)).toBe("gif");
		}
		root.innerHTML = "<video loop muted></video>";
		expect(mediaType(root)).toBe("video");
		root.innerHTML = "";
		root.dataset.testid = "videoPlayer";
		expect(mediaType(root)).toBe("video");
	});
	it("excludes card avatars and supports a bare video wrapper", () => {
		const root = document.createElement("article");
		root.innerHTML =
			'<div data-testid="card.wrapper"><img src="/profile_images/a.png"><img src="/emoji/a.png"><img></div><section><video></video></section>';
		expect(mediaRoots(root)).toHaveLength(1);
	});
	it("does not count a video twice when X nests it inside tweetPhoto", () => {
		const root = document.createElement("div");
		root.innerHTML =
			'<div data-testid="tweetPhoto"><div data-testid="videoPlayer"><video></video></div></div>';
		expect(mediaRoots(root)).toHaveLength(1);
		root.innerHTML =
			'<div data-testid="videoPlayer"><div data-testid="videoComponent"><video></video></div></div>';
		expect(mediaRoots(root)).toHaveLength(1);
		expect(mediaRoots(root)[0].dataset.testid).toBe("videoPlayer");
	});
	it("identifies authors from photo links or headers, failing closed for unknown quotes", () => {
		const wrapper = document.createElement("article");
		document.body.append(wrapper);
		for (const href of [
			"https://other.test/alice/status/123",
			"http://[bad",
			"/unknown",
			"",
		]) {
			wrapper.innerHTML = `<a href="${href}"><div id="target"></div></a>`;
			expect(
				mediaOwner(wrapper.querySelector("#target") as HTMLElement).username,
			).toBeNull();
		}
		wrapper.innerHTML =
			'<div data-testid="User-Name"><a href="/Alice">Alice</a></div><div id="target"></div>';
		expect(mediaOwner(wrapper.querySelector("#target") as HTMLElement)).toEqual(
			{ username: "alice", post: null },
		);
		wrapper.innerHTML =
			'<div data-testid="User-Name"><a href="/Alice">Alice</a></div><blockquote><div data-testid="User-Name">Loading</div><div id="target"></div></blockquote>';
		expect(
			mediaOwner(wrapper.querySelector("#target") as HTMLElement).username,
		).toBeNull();
	});
	it("creates stable media identities when X changes image resolution", () => {
		const root = photo();
		const first = mediaIdentity(root, "image");
		root
			.querySelector("img")!
			.setAttribute("src", "/media/landscape.svg?name=large");
		expect(mediaIdentity(root, "image")).toBe(first);
		const empty = document.createElement("div");
		expect(mediaIdentity(empty, "image")).toBe("unknown:image:");
		empty.innerHTML = '<video src="blob:local"></video>';
		expect(mediaIdentity(empty, "video")).toBe("unknown:video:video");
	});
});
