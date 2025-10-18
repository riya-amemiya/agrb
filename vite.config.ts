import { defineConfig } from "vite";

export default defineConfig({
	build: {
		lib: {
			entry: "src/cli.tsx",
			formats: ["es"],
			fileName: () => "cli.js",
		},
		rollupOptions: {
			external: [/^node:.*/, "child_process", "events", "assert", "fs"],
		},
	},
});
