import {
	chromium,
	expect,
	test,
	type BrowserContext,
	type Page,
	type Worker,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixture = readFileSync("tests/e2e/fixtures/feed.html", "utf8");
const clip = readFileSync("tests/e2e/fixtures/clip.webm");
const illustration =
	'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#dfeee5"/><circle cx="450" cy="72" r="30" fill="#e6bc7a"/><path d="M0 250 160 80 330 280 440 150 600 300H0" fill="#70a88a"/><path d="M0 300 220 160 440 300" fill="#407c60"/></svg>';
let context: BrowserContext;
let background: Worker;
let page: Page;
let popup: Page;
let extensionId: string;

// TabMD's persistent-context loader, exercising the production build on account-free fixtures.
test.beforeEach(async () => {
	const extensionPath = resolve(".output/chrome-mv3");
	context = await chromium.launchPersistentContext("", {
		channel: "chromium",
		headless: true,
		args: [
			`--disable-extensions-except=${extensionPath}`,
			`--load-extension=${extensionPath}`,
		],
	});
	await context.route("https://x.com/**", (route) => {
		const pathname = new URL(route.request().url()).pathname;
		if (pathname === "/clip.webm")
			return route.fulfill({ contentType: "video/webm", body: clip });
		if (pathname.endsWith(".svg"))
			return route.fulfill({
				contentType: "image/svg+xml",
				body: illustration,
			});
		return route.fulfill({ contentType: "text/html", body: fixture });
	});
	await context.route("https://example.org/**", (route) =>
		route.fulfill({ contentType: "text/html", body: "<h1>Another site</h1>" }),
	);
	background =
		context.serviceWorkers()[0] ??
		(await context.waitForEvent("serviceworker"));
	extensionId = new URL(background.url()).host;
	page = await context.newPage();
	await page.goto("https://x.com/home");
	await expect(page.locator("cleanx-placeholder")).toHaveCount(5);
	popup = await context.newPage();
	await page.bringToFront();
	await popup.goto(`chrome-extension://${extensionId}/popup.html`);
	await expect(popup.getByText("Active on X", { exact: true })).toBeVisible();
});
test.afterEach(async () => {
	await context.close();
});

const root = (post: string) => page.locator(`#${post} [data-cleanx-root]`);

test("renders the popup in both themes and keeps post media hidden and paused", async () => {
	await expect(popup.locator("h1")).toHaveText("CleanX");
	await expect(popup.locator("#hidden-total")).toHaveText("5 hidden");
	await expect(popup.getByRole("switch")).toHaveCount(3);
	await expect(page.locator(".avatar")).toBeVisible();
	await expect(
		page.getByText("Keep this link and its headline readable"),
	).toBeVisible();
	await expect(
		page.locator("#photo-post img[alt='A green landscape']"),
	).toBeHidden();
	await expect
		.poll(() =>
			page
				.locator("video")
				.evaluateAll((videos) =>
					videos.every(
						(video) =>
							video instanceof HTMLVideoElement &&
							video.paused &&
							!video.autoplay,
					),
				),
		)
		.toBe(true);
	await page
		.locator("#video-post video")
		.evaluate(async (video: HTMLVideoElement) => {
			await video.play().catch((error) => {
				if (error.name !== "AbortError") throw error;
			});
		});
	await expect
		.poll(() =>
			page
				.locator("#video-post video")
				.evaluate((video: HTMLVideoElement) => video.paused),
		)
		.toBe(true);
	for (const colorScheme of ["light", "dark"] as const) {
		await popup.emulateMedia({ colorScheme });
		await page.emulateMedia({ colorScheme });
		const dimensions = await popup.evaluate(() => ({
			width: document.body.scrollWidth,
			height: document.body.scrollHeight,
		}));
		expect(dimensions.width).toBeLessThanOrEqual(360);
		expect(dimensions.height).toBeLessThanOrEqual(560);
		await popup
			.locator("body")
			.screenshot({ path: `test-results/popup-${colorScheme}.png` });
		await page
			.locator("#photo-post")
			.screenshot({ path: `test-results/placeholder-${colorScheme}.png` });
	}
});

test("toggles each media type independently and persists across X tabs and reloads", async () => {
	for (const [type, post] of [
		["video", "video-post"],
		["image", "photo-post"],
		["gif", "gif-post"],
	]) {
		await popup.locator(`#${type}`).uncheck();
		await expect(root(post)).toHaveAttribute("data-cleanx-state", "visible");
		for (const [otherType, otherPost] of [
			["video", "video-post"],
			["image", "photo-post"],
			["gif", "gif-post"],
		]) {
			if (otherType !== type)
				await expect(root(otherPost)).toHaveAttribute(
					"data-cleanx-state",
					"hidden",
				);
		}
		await popup.locator(`#${type}`).check();
		await expect(root(post)).toHaveAttribute("data-cleanx-state", "hidden");
	}
	const second = await context.newPage();
	await second.goto("https://x.com/alice");
	await popup.locator("#image").uncheck();
	await expect(
		second.locator("#photo-post [data-cleanx-root]"),
	).toHaveAttribute("data-cleanx-state", "visible");
	await page.reload();
	await expect(root("photo-post")).toHaveAttribute(
		"data-cleanx-state",
		"visible",
	);
	expect(
		await background.evaluate(
			async () =>
				(await chrome.storage.local.get("cleanx:image"))["cleanx:image"],
		),
	).toBe(false);
});

test("reveals one item, hides it again, and resets temporary reveals on reload", async () => {
	await page
		.locator("#photo-post")
		.getByRole("button", { name: "Show image", exact: true })
		.click();
	await expect(root("photo-post")).toHaveAttribute(
		"data-cleanx-state",
		"visible",
	);
	await expect(root("quote-post")).toHaveAttribute(
		"data-cleanx-state",
		"hidden",
	);
	expect(page.url()).toBe("https://x.com/home");
	await page
		.locator("#photo-post")
		.getByRole("button", { name: "Hide image", exact: true })
		.click();
	await expect(root("photo-post")).toHaveAttribute(
		"data-cleanx-state",
		"hidden",
	);
	await page
		.locator("#photo-post")
		.getByRole("button", { name: "Show image", exact: true })
		.click();
	await page.reload();
	await expect(root("photo-post")).toHaveAttribute(
		"data-cleanx-state",
		"hidden",
	);
});

test("whitelists authors independently of quoted posts and rejects invalid input", async () => {
	await popup.locator("#whitelist").fill("@ALICE,alice");
	await popup.getByRole("button", { name: "Save usernames" }).click();
	await expect(root("photo-post")).toHaveAttribute(
		"data-cleanx-state",
		"visible",
	);
	await expect(root("quote-post")).toHaveAttribute(
		"data-cleanx-state",
		"hidden",
	);
	await popup.locator("#whitelist").fill("alice, @DAVE");
	await popup.getByRole("button", { name: "Save usernames" }).click();
	await expect(root("quote-post")).toHaveAttribute(
		"data-cleanx-state",
		"visible",
	);
	await expect(root("video-post")).toHaveAttribute(
		"data-cleanx-state",
		"hidden",
	);
	await popup.locator("#whitelist").fill("https://x.com/bob");
	await popup.getByRole("button", { name: "Save usernames" }).click();
	await expect(popup.locator("#whitelist-error")).toBeVisible();
	expect(
		await background.evaluate(
			async () =>
				(await chrome.storage.local.get("cleanx:whitelist"))[
					"cleanx:whitelist"
				],
		),
	).toEqual(["alice", "dave"]);
	await popup.locator("#whitelist").fill("");
	await popup.getByRole("button", { name: "Save usernames" }).click();
	await expect(root("photo-post")).toHaveAttribute(
		"data-cleanx-state",
		"hidden",
	);
});

test("handles new and recycled media, including X's reversed player nesting", async () => {
	await page.evaluate(() => {
		const article = document.createElement("article");
		article.id = "new-post";
		article.innerHTML =
			'<div data-testid="User-Name"><a href="/frank/status/999">Frank</a></div><div class="media" data-testid="videoPlayer"><div data-testid="videoComponent"><video poster="/tweet_video_thumb/loop.svg" src="/clip.webm" autoplay muted loop></video></div></div>';
		document.querySelector("main")?.append(article);
	});
	await expect(page.locator("#new-post cleanx-placeholder")).toHaveCount(1);
	await expect(root("new-post")).toHaveAttribute("data-cleanx-kind", "gif");
	await page
		.locator("#new-post")
		.getByRole("button", { name: "Show gif", exact: true })
		.click();
	await expect(root("new-post")).toHaveAttribute(
		"data-cleanx-state",
		"visible",
	);
	await page.locator("#new-post video").evaluate((video: HTMLVideoElement) => {
		video.poster = "/ext_tw_video_thumb/new.svg";
	});
	await expect(root("new-post")).toHaveAttribute("data-cleanx-kind", "video");
	await expect(root("new-post")).toHaveAttribute("data-cleanx-state", "hidden");
	await page.evaluate(() => {
		history.pushState({}, "", "/alice");
		document.title = "Alice / X";
	});
	await page.bringToFront();
	await popup.reload();
	await expect(popup.locator("#page-title")).toHaveText("Alice");
	await expect(popup.locator("#page-path")).toHaveText("x.com/alice");
});

test("disables its action and popup controls away from X", async () => {
	const rules = await background.evaluate(
		() =>
			new Promise<chrome.events.Rule[]>((resolve) =>
				chrome.declarativeContent.onPageChanged.getRules(resolve),
			),
	);
	expect(rules).toHaveLength(1);
	expect(rules[0].conditions[0].pageUrl).toMatchObject({
		hostEquals: "x.com",
		schemes: ["https"],
	});
	await page.goto("https://example.org/");
	await expect(page.locator("cleanx-placeholder")).toHaveCount(0);
	await page.bringToFront();
	await popup.reload();
	await expect(popup.locator("#active-state")).toHaveText("Inactive");
	await expect(popup.getByRole("switch").first()).toBeDisabled();
	const tabId = await background.evaluate(
		async () =>
			(await chrome.tabs.query({ active: true, currentWindow: true }))[0].id,
	);
	expect(
		await background.evaluate((id) => chrome.action.isEnabled(id), tabId),
	).toBe(false);
});
