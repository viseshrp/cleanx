// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setupPopup } from "../../entrypoints/popup/popup";
import { createMockChrome } from "../helpers/mock_chrome";
import { flushMicrotasks } from "../helpers/flush";

const html = readFileSync("entrypoints/popup/index.html", "utf8");
let mock: ReturnType<typeof createMockChrome>;
const element = <T extends HTMLElement = HTMLElement>(id: string) =>
	document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const textarea = () => element<HTMLTextAreaElement>("whitelist");
const submit = async () => {
	element("whitelist-form").dispatchEvent(
		new Event("submit", { cancelable: true }),
	);
	await flushMicrotasks(20);
};
const typeList = (value: string) => {
	textarea().value = value;
	textarea().dispatchEvent(new Event("input"));
};

beforeEach(() => {
	document.documentElement.innerHTML = html;
	mock = createMockChrome();
	vi.stubGlobal("chrome", mock);
});
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("shows current page, independent toggles, local usernames, and hidden counts", async () => {
	mock.storageData["cleanx:whitelist"] = ["alice"];
	mock.storageData["cleanx:gif"] = false;
	await setupPopup();
	expect(element("page-title").textContent).toBe("Home");
	expect(element("page-path").textContent).toBe("x.com/home");
	expect(element("hidden-total").textContent).toBe("6 hidden");
	expect(element("active-state").textContent).toBe("Active on X");
	expect(input("video").checked).toBe(true);
	expect(input("gif").checked).toBe(false);
	expect(element("gif-count").textContent).toBe("Showing");
	expect(element("whitelist-count").textContent).toBe("1 person");
	expect(textarea().value).toBe("@alice");
});
it.each([
	{ tabs: [] },
	{ tabs: [{ id: 7, url: "https://example.org" }] },
	{ tabs: [{ url: "https://x.com/home" }] },
])("stays disabled without a valid X tab: %j", async ({ tabs }) => {
	mock.tabs.query.mockResolvedValue(tabs);
	await setupPopup();
	expect(element<HTMLFieldSetElement>("media-controls").disabled).toBe(true);
	expect(element("active-state").textContent).toBe("Inactive");
	expect(mock.storage.local.get).not.toHaveBeenCalled();
});
it("provides a reload action when the existing X tab has no content script", async () => {
	mock.tabs.sendMessage.mockRejectedValue(
		new Error("Receiving end does not exist"),
	);
	const close = vi.spyOn(window, "close").mockImplementation(() => {});
	await setupPopup();
	expect(element("reload").hidden).toBe(false);
	element("reload").click();
	await flushMicrotasks();
	expect(mock.tabs.reload).toHaveBeenCalledWith(7);
	expect(close).toHaveBeenCalled();
});
it("handles a failed reload without losing access to controls", async () => {
	mock.tabs.sendMessage.mockRejectedValue(new Error("No receiver"));
	mock.tabs.reload.mockRejectedValue(new Error("Tab closed"));
	await setupPopup();
	element("reload").click();
	await flushMicrotasks();
	expect(element("error").textContent).toContain("Could not reload");
});
it("persists a toggle and rolls back visibly if storage fails", async () => {
	await setupPopup();
	input("video").checked = false;
	input("video").dispatchEvent(new Event("change"));
	await flushMicrotasks(20);
	expect(mock.storage.local.set).toHaveBeenCalledWith({
		"cleanx:video": false,
	});
	expect(input("video").disabled).toBe(false);
	mock.storage.local.set.mockRejectedValueOnce(new Error("Disk full"));
	input("video").checked = true;
	input("video").dispatchEvent(new Event("change"));
	await flushMicrotasks(20);
	expect(input("video").checked).toBe(false);
	expect(element("error").textContent).toContain("Could not save that toggle");
});
it("validates usernames before writing and supports clearing the list", async () => {
	await setupPopup();
	typeList("bad-name @@bad https://x.com/abc");
	await submit();
	expect(mock.storage.local.set).not.toHaveBeenCalled();
	expect(textarea().getAttribute("aria-invalid")).toBe("true");
	typeList("@ALICE, bob\nalice");
	await submit();
	expect(mock.storageData["cleanx:whitelist"]).toEqual(["alice", "bob"]);
	expect(element("save-state").textContent).toBe("Usernames saved");
	expect(textarea().getAttribute("aria-invalid")).toBeNull();
	typeList("");
	await submit();
	expect(mock.storageData["cleanx:whitelist"]).toEqual([]);
});
it("preserves a draft during external settings updates and failed saves", async () => {
	await setupPopup();
	typeList("@alice");
	await mock.storage.local.set({ "cleanx:image": false });
	await flushMicrotasks(20);
	expect(textarea().value).toBe("@alice");
	expect(element("save-state").textContent).toBe("Unsaved changes");
	mock.storage.local.set.mockRejectedValueOnce(new Error("Disk full"));
	await submit();
	expect(element("error").textContent).toContain(
		"previous list is still active",
	);
	expect(element<HTMLButtonElement>("save-whitelist").disabled).toBe(false);
});
it("does not mark new typing as saved while a previous submission is pending", async () => {
	await setupPopup();
	let finish: () => void = () => {};
	mock.storage.local.set.mockImplementationOnce(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
	);
	typeList("alice");
	element("whitelist-form").dispatchEvent(
		new Event("submit", { cancelable: true }),
	);
	typeList("alice, bob");
	finish();
	await flushMicrotasks(20);
	expect(element("save-state").textContent).toBe("Unsaved changes");
	expect(textarea().value).toBe("alice, bob");
});
it("ignores unrelated storage events and reports read failures", async () => {
	await setupPopup();
	const getCount = mock.storage.local.get.mock.calls.length;
	for (const listener of mock.listeners) {
		listener({ other: {} }, "local");
		listener({ "cleanx:image": {} }, "sync");
	}
	expect(mock.storage.local.get).toHaveBeenCalledTimes(getCount);
	mock.storage.local.get.mockRejectedValue(new Error("Storage unavailable"));
	for (const listener of mock.listeners)
		listener({ "cleanx:image": {} }, "local");
	await flushMicrotasks(20);
	expect(element("error").textContent).toContain("Could not refresh");
});
it("shows startup errors and rejects invalid content-script context", async () => {
	mock.storage.local.get.mockRejectedValueOnce(new Error("No storage"));
	await setupPopup();
	expect(element("error").textContent).toContain("Could not load settings");
	mock.tabs.sendMessage.mockResolvedValueOnce({
		url: "https://other.test",
		title: "",
		counts: { video: 0, image: 0, gif: 0 },
	});
	await setupPopup();
	expect(element("active-state").textContent).toBe("Reload needed");
});
