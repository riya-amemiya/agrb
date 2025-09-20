import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
	boolean,
	number,
	object,
	optional,
	picklist,
	safeParse,
} from "valibot";

const CONFIG_FILE_NAME = "config.json";
const CONFIG_DIR_NAME = "agrb";
const LOCAL_CONFIG_FILE_NAME = ".agrbrc";

const onConflictValues = ["skip", "ours", "theirs", "pause"] as const;
type OnConflictStrategy = (typeof onConflictValues)[number];

// valibot schema (all fields optional to allow partial configs)
const configSchema = object({
	allowEmpty: optional(boolean()),
	linear: optional(boolean()),
	continueOnConflict: optional(boolean()),
	remoteTarget: optional(boolean()),
	onConflict: optional(picklist(onConflictValues)),
	schemaVersion: optional(number()),
});

export const configKeys = [
	"allowEmpty",
	"linear",
	"continueOnConflict",
	"remoteTarget",
	"onConflict",
	"schemaVersion",
] as const;

export interface AgreConfig {
	allowEmpty?: boolean;
	linear?: boolean;
	continueOnConflict?: boolean;
	remoteTarget?: boolean;
	onConflict?: OnConflictStrategy;
	schemaVersion?: number;
}

export interface ConfigResult {
	config: AgreConfig;
	sources: Partial<Record<keyof AgreConfig, "default" | "global" | "local">>;
}

export const defaultConfig: Omit<AgreConfig, "schemaVersion"> = {
	allowEmpty: false,
	linear: false,
	continueOnConflict: false,
	remoteTarget: false,
	onConflict: "pause",
};

const validateConfig = (config: unknown): AgreConfig => {
	const result = safeParse(configSchema, config);
	if (!result.success) {
		const errors = result.issues.map((issue) => {
			const path = issue.path
				?.map((p) => {
					if ("key" in p && p.key !== undefined) {
						return String(p.key);
					}
					if ("index" in p && p.index !== undefined) {
						return String(p.index);
					}
					return p.type;
				})
				.filter(Boolean)
				.join(".");
			return `'${path || "root"}': ${issue.message}`;
		});
		throw new Error(`Configuration errors:\n- ${errors.join("\n- ")}`);
	}
	return result.output as AgreConfig;
};

const readConfigFile = async (filePath: string): Promise<AgreConfig | null> => {
	try {
		const content = await fs.readFile(filePath, "utf-8");
		return validateConfig(JSON.parse(content));
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return null;
		}
		throw new Error(
			`Error reading or parsing config file at ${filePath}: ${
				error instanceof Error ? error.message : String(error)
			}
`,
		);
	}
};

const findUp = async (
	name: string,
	startDir: string,
): Promise<string | null> => {
	let dir = resolve(startDir);
	const stopDir = resolve(homedir(), "..");

	while (dir !== stopDir) {
		const filePath = join(dir, name);
		try {
			await fs.access(filePath);
			return filePath;
		} catch {
			dir = dirname(dir);
		}
	}
	return null;
};

export const getConfig = async (
	cwd: string = process.cwd(),
): Promise<ConfigResult> => {
	const globalConfigPath = join(
		homedir(),
		".config",
		CONFIG_DIR_NAME,
		CONFIG_FILE_NAME,
	);

	const globalConfig = await readConfigFile(globalConfigPath);
	const localConfigPath = await findUp(LOCAL_CONFIG_FILE_NAME, cwd);
	const localConfig = localConfigPath
		? await readConfigFile(localConfigPath)
		: null;

	const config: AgreConfig = {
		...defaultConfig,
		...(globalConfig || {}),
		...(localConfig || {}),
	};

	const sources: ConfigResult["sources"] = {};
	for (const key of configKeys) {
		const k = key as keyof AgreConfig;
		if (localConfig && Object.hasOwn(localConfig, k)) {
			sources[k] = "local";
		} else if (globalConfig && Object.hasOwn(globalConfig, k)) {
			sources[k] = "global";
		} else if (Object.hasOwn(defaultConfig, k)) {
			sources[k] = "default";
		}
	}

	return {
		config,
		sources,
	};
};

export const GLOBAL_CONFIG_PATH = join(
	homedir(),
	".config",
	CONFIG_DIR_NAME,
	CONFIG_FILE_NAME,
);

export const writeGlobalConfig = async (config: AgreConfig): Promise<void> => {
	try {
		await fs.mkdir(dirname(GLOBAL_CONFIG_PATH), { recursive: true });
		await fs.writeFile(
			GLOBAL_CONFIG_PATH,
			JSON.stringify(config, null, 2),
			"utf-8",
		);
	} catch (error) {
		throw new Error(
			`Failed to write config file: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
};

export const resetGlobalConfig = async (): Promise<void> => {
	await writeGlobalConfig(defaultConfig);
};
