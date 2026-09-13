import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			reportsDirectory: "coverage",
			include: ["entrypoints/**/*.ts"],
			// Entrypoint wrappers are exercised by the real extension in Playwright.
			exclude: [
				"entrypoints/content/index.ts",
				"entrypoints/popup/index.ts",
				"entrypoints/background/index.ts",
			],
			thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
		},
	},
});
