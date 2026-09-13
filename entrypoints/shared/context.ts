import type { MediaType } from "./settings";

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
