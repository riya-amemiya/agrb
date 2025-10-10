import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";
import unicornPlugin from "eslint-plugin-unicorn";

const compat = new FlatCompat();

export default [
	js.configs.recommended,
	unicornPlugin.configs.recommended,
	...compat.extends("plugin:@typescript-eslint/recommended"),
	{
		ignores: [
			"jest.config.ts",
			"tmp/",
			"src/tests/",
			".dependency-cruiser.js",
			"cjs.build.mjs",
			"eslint.config.mjs",
		],
	},
	{
		languageOptions: {
			sourceType: "module",
			ecmaVersion: 2024,
			parser: typescriptEslintParser,
			parserOptions: {
				project: "./tsconfig.json",
			},
		},
		plugins: {
			"@typescript-eslint": typescriptEslintPlugin,
		},
		rules: {
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
