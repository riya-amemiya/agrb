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
			"@typescript-eslint/no-explicit-any": "off",
			"no-constant-condition": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"unicorn/filename-case": [
				"error",
				{
					cases: {
						camelCase: true,
						pascalCase: true,
					},
				},
			],
			"unicorn/no-null": "off",
			"unicorn/prefer-spread": "off",
			"unicorn/no-array-reduce": "off",
			"unicorn/prefer-module": "off",
			"unicorn/prefer-number-properties": "off",
			"unicorn/no-nested-ternary": "off",
			"unicorn/number-literal-case": "off",
		},
	},
];
