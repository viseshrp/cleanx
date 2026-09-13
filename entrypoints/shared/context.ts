import { normalizeUsername, type MediaType } from "./settings";

export type PageContext = {
	url: string;
	title: string;
	counts: Record<MediaType, number>;
};

export function isXUrl(value: string | undefined): boolean {
	try {
		const url = new URL(value ?? "");
		return url.protocol === "https:" && url.hostname === "x.com";
	} catch {
		return false;
	}
}

export function profileFromUrl(value: string): string | null {
	if (!isXUrl(value)) return null;
	const [name, section] = new URL(value).pathname.split("/").filter(Boolean);
	if (
		!name ||
		/^(home|explore|search|notifications|messages|settings|i|compose|login|logout|tos|privacy)$/i.test(
			name,
		)
	)
		return null;
	if (
		section &&
		!["status", "media", "with_replies", "highlights", "articles"].includes(
			section,
		)
	)
		return null;
	return normalizeUsername(name);
}
