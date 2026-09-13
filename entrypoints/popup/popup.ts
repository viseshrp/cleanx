// biome-ignore-all lint/style/noNonNullAssertion: This module owns its fixed HTML; missing elements are programming errors.
import { isXUrl, type PageContext } from "../shared/context";
import {
	DEFAULT_SETTINGS,
	MEDIA_TYPES,
	parseWhitelist,
	readSettings,
	type Settings,
	STORAGE_KEYS,
	writeSetting,
} from "../shared/settings";

export async function setupPopup() {
	const controls =
		document.querySelector<HTMLFieldSetElement>("#media-controls")!;
	const whitelistControls = document.querySelector<HTMLFieldSetElement>(
		"#whitelist-controls",
	)!;
	const whitelist = document.querySelector<HTMLTextAreaElement>("#whitelist")!;
	const error = document.querySelector<HTMLElement>("#error")!;
	const whitelistError =
		document.querySelector<HTMLElement>("#whitelist-error")!;
	const status = document.querySelector<HTMLElement>("#save-state")!;
	const save = document.querySelector<HTMLButtonElement>("#save-whitelist")!;
	const reload = document.querySelector<HTMLButtonElement>("#reload")!;
	const activeState = document.querySelector<HTMLElement>("#active-state")!;
	let settings: Settings = DEFAULT_SETTINGS;
	let tabId: number | undefined;
	let dirty = false;
	let contextRevision = 0;

	function showError(message: string) {
		error.textContent = message;
		error.hidden = false;
	}

	function renderSettings() {
		for (const type of MEDIA_TYPES)
			document.querySelector<HTMLInputElement>(`#${type}`)!.checked =
				settings[type];
		if (!dirty)
			whitelist.value = settings.whitelist
				.map((username) => `@${username}`)
				.join(", ");
		const count = settings.whitelist.length;
		document.querySelector("#whitelist-count")!.textContent =
			`${count} ${count === 1 ? "person" : "people"}`;
	}

	async function refreshContext() {
		if (tabId === undefined) return;
		const revision = ++contextRevision;
		try {
			const context: PageContext = await chrome.tabs.sendMessage(
				tabId,
				"cleanx:context",
			);
			if (revision !== contextRevision) return;
			if (!context || !isXUrl(context.url)) throw new Error("No X context");
			const title = context.title
				.replace(/^\(\d+\)\s*/, "")
				.replace(/\s*\/ X$/, "");
			document.querySelector("#page-title")!.textContent = title || "X";
			document.querySelector("#page-title")!.setAttribute("title", title);
			document.querySelector("#page-path")!.textContent =
				`x.com${new URL(context.url).pathname}`;
			document.querySelector("#hidden-total")!.textContent =
				`${Object.values(context.counts).reduce((sum, count) => sum + count, 0)} hidden`;
			for (const type of MEDIA_TYPES)
				document.querySelector(`#${type}-count`)!.textContent = settings[type]
					? `${context.counts[type]} hidden on this page`
					: "Showing";
			activeState.textContent = "Active on X";
			activeState.dataset.active = "true";
			reload.hidden = true;
		} catch {
			if (revision !== contextRevision) return;
			activeState.textContent = "Reload needed";
			activeState.dataset.active = "false";
			document.querySelector("#page-title")!.textContent =
				"Reload X to connect CleanX";
			document.querySelector("#hidden-total")!.textContent = "—";
			reload.hidden = false;
		}
	}

	try {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (!isXUrl(tab?.url) || tab?.id === undefined) {
			activeState.textContent = "Inactive";
			document.querySelector("#page-title")!.textContent =
				"Open x.com to use CleanX";
			return;
		}
		tabId = tab.id;
		settings = await readSettings();
		renderSettings();
		controls.disabled = false;
		whitelistControls.disabled = false;
		await refreshContext();
	} catch {
		showError("Could not load settings. Close and reopen CleanX to try again.");
		return;
	}

	for (const type of MEDIA_TYPES) {
		const input = document.querySelector<HTMLInputElement>(`#${type}`)!;
		input.addEventListener("change", async () => {
			input.disabled = true;
			error.hidden = true;
			try {
				await writeSetting(type, input.checked);
				settings[type] = input.checked;
				await refreshContext();
			} catch {
				input.checked = settings[type];
				showError("Could not save that toggle. Try again.");
			} finally {
				input.disabled = false;
			}
		});
	}

	whitelist.addEventListener("input", () => {
		dirty = true;
		status.textContent = "Unsaved changes";
		whitelistError.hidden = true;
		whitelist.removeAttribute("aria-invalid");
	});
	document
		.querySelector("#whitelist-form")!
		.addEventListener("submit", async (event) => {
			event.preventDefault();
			const { usernames, invalid } = parseWhitelist(whitelist.value);
			if (invalid.length) {
				whitelistError.textContent = `Check ${invalid.slice(0, 3).join(", ")}. Use 1–15 letters, numbers, or underscores per username.`;
				whitelistError.hidden = false;
				whitelist.setAttribute("aria-invalid", "true");
				return;
			}
			save.disabled = true;
			error.hidden = true;
			const submitted = whitelist.value;
			try {
				await writeSetting("whitelist", usernames);
				settings.whitelist = usernames;
				dirty = submitted !== whitelist.value;
				status.textContent = dirty ? "Unsaved changes" : "Usernames saved";
				renderSettings();
				await refreshContext();
			} catch {
				showError(
					"Could not save usernames. Your previous list is still active.",
				);
			} finally {
				save.disabled = false;
			}
		});

	reload.addEventListener("click", async () => {
		try {
			await chrome.tabs.reload(tabId as number);
			window.close();
		} catch {
			showError("Could not reload this tab. Reload X from Chrome.");
		}
	});

	async function onStorage(
		changes: Record<string, chrome.storage.StorageChange>,
		area: string,
	) {
		if (
			area !== "local" ||
			!Object.values(STORAGE_KEYS).some((key) => key in changes)
		)
			return;
		try {
			settings = await readSettings();
			renderSettings();
			await refreshContext();
		} catch {
			showError(
				"Could not refresh saved settings. Reopen CleanX to try again.",
			);
		}
	}
	chrome.storage.onChanged.addListener(onStorage);
	window.addEventListener(
		"pagehide",
		() => chrome.storage.onChanged.removeListener(onStorage),
		{ once: true },
	);
}
