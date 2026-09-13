export default defineBackground(() => {
	chrome.runtime.onInstalled.addListener(() => {
		chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
			chrome.declarativeContent.onPageChanged.addRules([
				{
					id: "cleanx-on-x",
					conditions: [
						new chrome.declarativeContent.PageStateMatcher({
							pageUrl: { hostEquals: "x.com", schemes: ["https"] },
						}),
					],
					actions: [new chrome.declarativeContent.ShowAction()],
				},
			]);
		});
	});
});
