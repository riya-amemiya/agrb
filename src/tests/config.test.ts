import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import {
	CONFIG_DIR_NAME,
	CONFIG_FILE_NAME,
	configKeys,
	defaultConfig,
	GLOBAL_CONFIG_PATH,
	getConfig,
	LOCAL_CONFIG_FILE_NAME,
	picklist,
	validateConfig,
} from "../lib/config.js";

describe("picklist", () => {
	const validator = picklist(["a", "b"] as const, "not allowed");

	test("accepts listed values", () => {
		expect(validator.validate("a")).toBe(true);
		expect(validator.validate("b")).toBe(true);
	});

	test("rejects values outside the list", () => {
		expect(validator.validate("c")).toBe(false);
		expect(validator.validate("")).toBe(false);
	});

	test("exposes the string type and custom message", () => {
		expect(validator.type).toBe("string");
		expect(validator.message).toBe("not allowed");
	});
});

describe("validateConfig", () => {
	test("accepts an empty object", () => {
		expect(validateConfig({})).toEqual({});
	});

	test("accepts the default config", () => {
		expect(validateConfig(defaultConfig)).toEqual(defaultConfig);
	});

	test("accepts every onConflict strategy", () => {
		for (const onConflict of ["skip", "ours", "theirs", "pause"]) {
			expect(validateConfig({ onConflict })).toEqual({ onConflict });
		}
	});

	test("rejects an unknown onConflict strategy", () => {
		expect(() => validateConfig({ onConflict: "merge" })).toThrow(
			"Configuration errors:",
		);
	});

	test("rejects values of the wrong type", () => {
		expect(() => validateConfig({ linear: "true" })).toThrow(
			"Configuration errors:",
		);
		expect(() => validateConfig({ schemaVersion: "1" })).toThrow(
			"Configuration errors:",
		);
	});
});

describe("config constants", () => {
	test("defaults to pausing on conflicts without destructive options", () => {
		expect(defaultConfig).toEqual({
			allowEmpty: false,
			linear: false,
			continueOnConflict: false,
			remoteTarget: false,
			onConflict: "pause",
			dryRun: false,
			yes: false,
			autostash: false,
			pushWithLease: false,
			noBackup: false,
		});
	});

	test("lists every default key in configKeys", () => {
		expect<string[]>([...configKeys].sort()).toEqual(
			[...Object.keys(defaultConfig), "schemaVersion"].sort(),
		);
	});

	test("stores the global config under the tool directory", () => {
		expect(GLOBAL_CONFIG_PATH).toBe(
			path.join(homedir(), ".config", CONFIG_DIR_NAME, CONFIG_FILE_NAME),
		);
		expect(LOCAL_CONFIG_FILE_NAME).toBe(".agrbrc");
	});
});

describe("getConfig", () => {
	const directories: string[] = [];

	const makeProject = () => {
		const directory = mkdtempSync(path.join(tmpdir(), "agrb-config-test-"));
		directories.push(directory);
		return directory;
	};

	afterEach(() => {
		for (const directory of directories.splice(0)) {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	test("applies a local .agrbrc found in a parent directory", async () => {
		const project = makeProject();
		const nested = path.join(project, "packages", "app");
		mkdirSync(nested, { recursive: true });
		writeFileSync(
			path.join(project, LOCAL_CONFIG_FILE_NAME),
			JSON.stringify({ linear: true, onConflict: "theirs" }),
		);

		const { config, sources } = await getConfig(nested);

		expect(config.linear).toBe(true);
		expect(config.onConflict).toBe("theirs");
		expect(sources.linear).toBe("local");
		expect(sources.onConflict).toBe("local");
	});

	test("rejects an invalid local config", async () => {
		const project = makeProject();
		writeFileSync(
			path.join(project, LOCAL_CONFIG_FILE_NAME),
			JSON.stringify({ onConflict: "merge" }),
		);

		await expect(getConfig(project)).rejects.toThrow(
			"Error reading or parsing config file",
		);
	});

	test("rejects a local config that is not valid JSON", async () => {
		const project = makeProject();
		writeFileSync(path.join(project, LOCAL_CONFIG_FILE_NAME), "{");

		await expect(getConfig(project)).rejects.toThrow(
			"Error reading or parsing config file",
		);
	});
});
