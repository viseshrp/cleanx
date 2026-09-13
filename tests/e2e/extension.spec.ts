import { chromium, expect, test } from "@playwright/test";
import { resolve } from "node:path";

// Reuse TabMD's persistent-context extension loading, with the real production build.
test("loads the production popup and limits activation to X", async () => {
	const extensionPath = resolve(".output/chrome-mv3");
	const context = await chromium.launchPersistentContext("", {
		channel: "chromium",
		headless: true,
		args: [
			`--disable-extensions-except=${extensionPath}`,
			`--load-extension=${extensionPath}`,
		],
	});
	try {
		const background =
			context.serviceWorkers()[0] ??
			(await context.waitForEvent("serviceworker"));
		const id = new URL(background.url()).host;
		const popup = await context.newPage();
		await popup.goto(`chrome-extension://${id}/popup.html`);
		await expect(popup.locator("h1")).toHaveText("CleanX");
		const manifest = await background.evaluate(() =>
			chrome.runtime.getManifest(),
		);
		expect(manifest.action?.default_state).toBe("disabled");
		expect(manifest.host_permissions).toEqual(["https://x.com/*"]);
	} finally {
		await context.close();
	}
});
