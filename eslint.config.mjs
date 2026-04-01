import js from "@eslint/js";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";
import unicornPlugin from "eslint-plugin-unicorn";

export default [
	{
		ignores: [
			"jest.config.ts",
			"tmp/**",
			"src/tests/**",
			".dependency-cruiser.js",
			"cjs.build.mjs",
			"eslint.config.mjs",
			"vite.config.ts",
			"dist/**",
		],
	},
	js.configs.recommended,
	unicornPlugin.configs.recommended,
	{
		files: ["src/**/*.ts", "src/**/*.tsx"],
		languageOptions: {
			sourceType: "module",
			ecmaVersion: 2024,
			globals: {
				process: "readonly",
				console: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				Buffer: "readonly",
			},
			parser: typescriptEslintParser,
			parserOptions: {
				project: "./tsconfig.json",
			},
		},
		plugins: {
			"@typescript-eslint": typescriptEslintPlugin,
		},
		rules: {
			...typescriptEslintPlugin.configs.recommended.rules,
			"unicorn/filename-case": [
				"error",
				{
					cases: {
						camelCase: true,
						pascalCase: true,
					},
				},
			],
		},
	},
];
