import { vi } from "vitest";

type StorageRecord = Record<string, unknown>;
type Listener = (
	changes: Record<string, chrome.storage.StorageChange>,
	area: string,
) => void;

// The local-storage event model is reused from TabMD's mock_chrome helper.
export function createMockChrome() {
	const storageData: StorageRecord = {};
	const listeners = new Set<Listener>();
	return {
		storageData,
		listeners,
		storage: {
			local: {
				get: vi.fn(async () => ({ ...storageData })),
				set: vi.fn(async (payload: StorageRecord) => {
					const changes: Record<string, chrome.storage.StorageChange> = {};
					for (const [key, value] of Object.entries(payload)) {
						changes[key] = { oldValue: storageData[key], newValue: value };
						storageData[key] = value;
					}
					for (const listener of listeners) listener(changes, "local");
				}),
			},
			onChanged: {
				addListener: (listener: Listener) => listeners.add(listener),
				removeListener: (listener: Listener) => listeners.delete(listener),
			},
		},
		tabs: {
			query: vi.fn(
				async (): Promise<Partial<chrome.tabs.Tab>[]> => [
					{ id: 7, url: "https://x.com/home" },
				],
			),
			sendMessage: vi.fn(async () => ({
				url: "https://x.com/home",
				title: "(3) Home / X",
				counts: { image: 3, video: 2, gif: 1 },
			})),
			reload: vi.fn(async () => {}),
		},
	};
}
