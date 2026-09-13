import "./style.css";
import { startFilter } from "./filter";
import { readSettings, STORAGE_KEYS } from "../shared/settings";

export default defineContentScript({
	matches: ["https://x.com/*"],
	runAt: "document_start",
	async main(ctx) {
		const filter = startFilter();
		let revision = 0;
		async function refresh() {
			const current = ++revision;
			try {
				const settings = await readSettings();
				if (current === revision && !ctx.isInvalid) filter.update(settings);
			} catch {
				// Storage can disappear when the extension is reloaded; restore the page.
				filter.stop();
			}
		}
		function onStorage(
			changes: Record<string, chrome.storage.StorageChange>,
			area: string,
		) {
			if (
				area === "local" &&
				Object.values(STORAGE_KEYS).some((key) => key in changes)
			)
				void refresh();
		}
		function onMessage(
			message: unknown,
			_sender: chrome.runtime.MessageSender,
			respond: (value: unknown) => void,
		) {
			if (message === "cleanx:context") {
				void refresh().then(() => respond(filter.context()));
				return true;
			}
		}
		chrome.storage.onChanged.addListener(onStorage);
		chrome.runtime.onMessage.addListener(onMessage);
		ctx.onInvalidated(() => {
			revision++;
			chrome.storage.onChanged.removeListener(onStorage);
			chrome.runtime.onMessage.removeListener(onMessage);
			filter.stop();
		});
		await refresh();
	},
});
