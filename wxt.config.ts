import { defineConfig } from "wxt";

const version =
	process.env.RELEASE_VERSION ?? process.env.npm_package_version ?? "1.0.0";
const icons = Object.fromEntries(
	[16, 19, 32, 38, 48, 96, 128].map((size) => [size, `icon/${size}.png`]),
);

export default defineConfig({
	entrypointsDir: "entrypoints",
	outDirTemplate: "{{browser}}-mv{{manifestVersion}}{{modeSuffix}}",
	vite: () => ({ build: { sourcemap: false } }),
	manifest: {
		version,
		name: "CleanX",
		description:
			"A quieter X. Replace videos, images, and GIFs with placeholders. Keep media from the people you choose.",
		homepage_url: "https://github.com/viseshrp/cleanx",
		minimum_chrome_version: "120",
		permissions: ["storage", "declarativeContent"],
		host_permissions: ["https://x.com/*"],
		action: {
			default_title: "CleanX · A quieter X",
			// Supported by Chrome; absent from WXT's cross-browser manifest type.
			...{ default_state: "disabled" },
			default_icon: icons,
		},
		icons,
	},
});
