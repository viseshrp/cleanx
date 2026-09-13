import { normalizeUsername, type MediaType } from "../shared/settings";

const VIDEO = '[data-testid="videoComponent"], [data-testid="videoPlayer"]';
const CANDIDATES = `${VIDEO}, [data-testid="tweetPhoto"], [data-testid="card.wrapper"] img, article video`;

export function mediaRoots(scope: ParentNode): HTMLElement[] {
	const roots = new Set<HTMLElement>();
	for (const candidate of scope.querySelectorAll<HTMLElement>(CANDIDATES)) {
		// X uses both nesting orders. One outer player gets one placeholder.
		let video = candidate.closest<HTMLElement>(VIDEO);
		if (video) {
			let outer = video.parentElement?.closest<HTMLElement>(VIDEO);
			while (outer) {
				video = outer;
				outer = video.parentElement?.closest<HTMLElement>(VIDEO);
			}
			roots.add(video);
		} else if (candidate.matches("img")) {
			// Card image containers also paint the same image as a CSS background.
			const src = candidate.getAttribute("src");
			if (src && !/\/profile_images\/|\/emoji\//.test(src))
				roots.add(candidate.parentElement ?? candidate);
		} else if (candidate.matches("video")) {
			if (candidate.parentElement) roots.add(candidate.parentElement);
		} else if (!candidate.querySelector(VIDEO)) roots.add(candidate);
	}
	return [...roots];
}

export function mediaType(root: HTMLElement): MediaType {
	const assets = [root, ...root.querySelectorAll("img, video, source")];
	if (
		assets.some((element) =>
			["src", "poster"].some((attribute) =>
				/(?:\/tweet_video(?:_thumb)?\/|\.gif(?:[?#]|$)|[?&]format=gif(?:&|$))/i.test(
					element.getAttribute(attribute) ?? "",
				),
			),
		)
	)
		return "gif";

	if (
		root.matches(VIDEO) ||
		root.matches("video") ||
		root.querySelector("video")
	) {
		// Ordinary videos can also loop and be muted. Only explicit GIF markers count.
		const labels = [...root.querySelectorAll("[aria-label], span")];
		if (
			labels.some((element) =>
				/^(?:play |pause )?gif$/i.test(
					(
						element.getAttribute("aria-label") ??
						element.textContent ??
						""
					).trim(),
				),
			)
		)
			return "gif";
		return "video";
	}
	return "image";
}

function postPath(href: string | null): string | null {
	if (!href) return null;
	try {
		const url = new URL(href, "https://x.com");
		return url.hostname === "x.com"
			? (url.pathname.match(/^\/[a-z0-9_]{1,15}\/status\/\d+/i)?.[0] ?? null)
			: null;
	} catch {
		return null;
	}
}

export function mediaOwner(root: HTMLElement): {
	username: string | null;
	post: string | null;
} {
	const directPost = postPath(
		root.closest("a[href]")?.getAttribute("href") ?? null,
	);
	if (directPost)
		return {
			username: normalizeUsername(directPost.split("/")[1]),
			post: directPost,
		};

	// The nearest ancestor with an author header is the quoted post, when present.
	for (
		let parent = root.parentElement;
		parent && parent !== document.body;
		parent = parent.parentElement
	) {
		const header = parent.querySelector('[data-testid="User-Name"]');
		if (header) {
			const links = [...header.querySelectorAll("a[href]")];
			const post =
				links
					.map((link) => postPath(link.getAttribute("href")))
					.find(Boolean) ?? null;
			if (post)
				return { username: normalizeUsername(post.split("/")[1]), post };
			for (const link of links) {
				const href = link.getAttribute("href") ?? "";
				const match = /^\/(\w{1,15})\/?$/.exec(href);
				if (match) return { username: normalizeUsername(match[1]), post: null };
			}
			// Never inherit an outer author's whitelist when a quote header is unresolved.
			return { username: null, post: null };
		}
		if (parent.matches('article, [data-testid="tweet"]')) break;
	}
	return { username: null, post: null };
}

export function mediaIdentity(root: HTMLElement, type: MediaType): string {
	const owner = mediaOwner(root);
	const element = root.matches("img, video")
		? root
		: root.querySelector("video, img");
	const source =
		element?.getAttribute("poster") || element?.getAttribute("src") || "";
	// X changes image resolution and video blob URLs as items enter the viewport.
	const asset = source.startsWith("blob:") ? "video" : source.split("?")[0];
	return `${owner.post ?? owner.username ?? "unknown"}:${type}:${asset}`;
}
