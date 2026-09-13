export const MEDIA_TYPES = ["video", "image", "gif"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
export type Settings = Record<MediaType, boolean> & { whitelist: string[] };

export const STORAGE_KEYS = {
	video: "cleanx:video",
	image: "cleanx:image",
	gif: "cleanx:gif",
	whitelist: "cleanx:whitelist",
} as const;

export const DEFAULT_SETTINGS: Settings = {
	video: true,
	image: true,
	gif: true,
	whitelist: [],
};

export function normalizeUsername(value: string): string | null {
	const username = value.trim().replace(/^@/, "").toLowerCase();
	return /^[a-z0-9_]{1,15}$/.test(username) ? username : null;
}

export function parseWhitelist(value: string): {
	usernames: string[];
	invalid: string[];
} {
	const usernames = new Set<string>();
	const invalid: string[] = [];
	for (const token of value.split(/[\s,;]+/).filter(Boolean)) {
		const username = normalizeUsername(token);
		if (username) usernames.add(username);
		else invalid.push(token);
	}
	return { usernames: [...usernames], invalid };
}

// The typed-default and normalization pattern comes from TabMD's local storage.
export function normalizeSettings(raw: Record<string, unknown>): Settings {
	const whitelist = raw[STORAGE_KEYS.whitelist];
	return {
		video:
			typeof raw[STORAGE_KEYS.video] === "boolean"
				? (raw[STORAGE_KEYS.video] as boolean)
				: true,
		image:
			typeof raw[STORAGE_KEYS.image] === "boolean"
				? (raw[STORAGE_KEYS.image] as boolean)
				: true,
		gif:
			typeof raw[STORAGE_KEYS.gif] === "boolean"
				? (raw[STORAGE_KEYS.gif] as boolean)
				: true,
		whitelist: Array.isArray(whitelist)
			? [
					...new Set(
						whitelist.flatMap((value) =>
							typeof value === "string" ? (normalizeUsername(value) ?? []) : [],
						),
					),
				]
			: [],
	};
}

export async function readSettings(): Promise<Settings> {
	return normalizeSettings(
		await chrome.storage.local.get(Object.values(STORAGE_KEYS)),
	);
}

export async function writeSetting<K extends keyof Settings>(
	key: K,
	value: Settings[K],
): Promise<void> {
	// Independent keys keep simultaneous popup edits from overwriting another toggle.
	await chrome.storage.local.set({ [STORAGE_KEYS[key]]: value });
}
