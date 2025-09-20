import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

const ensureDir = async (path: string) => {
	await fs.mkdir(path, { recursive: true });
};

const writeJsonFile = async (filePath: string, data: unknown) => {
	await ensureDir(dirname(filePath));
	await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};

const run = async () => {
	const tmpRoot = join(process.cwd(), ".tmp-valibot-check");
	const tmpHome = join(tmpRoot, "home");

	await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
	await ensureDir(tmpHome);

	process.env.HOME = tmpHome;

	const { getConfig, defaultConfig } = await import("../src/lib/config.ts");

	const dirNoConfig = join(tmpRoot, "no-config");
	const dirLocalConfig = join(tmpRoot, "local-config");
	const dirInvalidLocal = join(tmpRoot, "invalid-local");
	await ensureDir(dirNoConfig);
	await ensureDir(dirLocalConfig);
	await ensureDir(dirInvalidLocal);

	const assert = (condition: unknown, message: string) => {
		if (!condition) {
			throw new Error(message);
		}
	};

	// Case 1: No local config => ensure no 'local' sources
	const r1 = await getConfig(dirNoConfig);
	console.log("case1 sources:", r1.sources);
	for (const k of Object.keys(
		defaultConfig,
	) as (keyof typeof defaultConfig)[]) {
		assert(
			r1.sources[k] !== "local",
			`case1 ${String(k)} should not be 'local'`,
		);
	}

	// Case 2: Local config overrides any non-local sources
	await writeJsonFile(join(dirLocalConfig, ".agrbrc"), {
		allowEmpty: true,
		onConflict: "skip",
	});
	const r2 = await getConfig(dirLocalConfig);
	console.log("case2 config:", r2.config);
	console.log("case2 sources:", r2.sources);
	assert(
		r2.config.allowEmpty === true,
		"case2 allowEmpty should be true from local",
	);
	assert(
		r2.sources.allowEmpty === "local",
		"case2 sources.allowEmpty should be 'local'",
	);
	assert(
		r2.config.onConflict === "skip",
		"case2 onConflict should be 'skip' from local",
	);
	assert(
		r2.sources.onConflict === "local",
		"case2 sources.onConflict should be 'local'",
	);

	// Case 3: Invalid local config should throw with readable message
	await writeJsonFile(join(dirInvalidLocal, ".agrbrc"), {
		onConflict: "invalid_value",
	});
	let threw = false;
	try {
		await getConfig(dirInvalidLocal);
	} catch (err) {
		threw = true;
		console.log(
			"case3 error message:",
			err instanceof Error ? err.message : String(err),
		);
	}
	assert(threw, "case3 should throw due to invalid onConflict value");

	console.log("ALL TESTS PASSED");
};

run().catch((err) => {
	console.error("TEST FAILED:", err);
	process.exit(1);
});
