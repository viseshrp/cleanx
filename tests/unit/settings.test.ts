import { afterEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_SETTINGS,
	normalizeSettings,
	normalizeUsername,
	parseWhitelist,
	readSettings,
	STORAGE_KEYS,
	writeSetting,
} from "../../entrypoints/shared/settings";
import { isXUrl } from "../../entrypoints/shared/context";

afterEach(() => vi.unstubAllGlobals());

describe("settings", () => {
	it("blocks all three types by default and rejects corrupt values", () => {
		expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
		expect(
			normalizeSettings({
				"cleanx:video": "false",
				"cleanx:image": null,
				"cleanx:gif": 0,
				"cleanx:whitelist": "alice",
			}),
		).toEqual(DEFAULT_SETTINGS);
	});
	it("keeps toggles independent and normalizes persisted usernames", () => {
		expect(
			normalizeSettings({
				"cleanx:video": false,
				"cleanx:image": true,
				"cleanx:gif": false,
				"cleanx:whitelist": ["@Alice", "alice", "b_o_b", null, 12, "bad-name"],
			}),
		).toEqual({
			video: false,
			image: true,
			gif: false,
			whitelist: ["alice", "b_o_b"],
		});
	});
	it("parses whitespace, commas, semicolons, casing and optional @ prefixes", () => {
		expect(parseWhitelist(" @Alice, alice\nBOB_2;carol ")).toEqual({
			usernames: ["alice", "bob_2", "carol"],
			invalid: [],
		});
		expect(
			parseWhitelist("@@bad,https://x.com/alice a-username a1234567890123456"),
		).toEqual({
			usernames: [],
			invalid: [
				"@@bad",
				"https://x.com/alice",
				"a-username",
				"a1234567890123456",
			],
		});
		expect(parseWhitelist("  ")).toEqual({ usernames: [], invalid: [] });
		expect(normalizeUsername("A12345678901234")).toBe("a12345678901234");
	});
	it("reads local storage and writes only the changed field", async () => {
		const get = vi.fn().mockResolvedValue({ "cleanx:video": false });
		const set = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("chrome", { storage: { local: { get, set } } });
		expect(await readSettings()).toEqual({ ...DEFAULT_SETTINGS, video: false });
		expect(get).toHaveBeenCalledWith(Object.values(STORAGE_KEYS));
		await writeSetting("image", false);
		expect(set).toHaveBeenCalledWith({ "cleanx:image": false });
	});
});

describe("X context", () => {
	it.each([
		"https://x.com/home",
		"https://x.com/alice/status/123",
	])("accepts %s", (url) => expect(isXUrl(url)).toBe(true));
	it.each([
		undefined,
		"",
		"invalid",
		"http://x.com/home",
		"https://x.com.evil.test",
		"https://other.test/x.com",
		"https://twitter.com",
		"https://sub.x.com",
	])("rejects %s", (url) => expect(isXUrl(url)).toBe(false));
});
