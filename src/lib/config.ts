import { getGlobalConfigPath, loadConfig } from "ag-toolkit";
import {
	boolean,
	type InferOutput,
	number,
	object,
	optional,
	picklist,
	safeParse,
} from "valibot";

export const CONFIG_FILE_NAME = "config.json";
export const CONFIG_DIR_NAME = "agrb";
export const LOCAL_CONFIG_FILE_NAME = ".agrbrc";

const onConflictValues = ["skip", "ours", "theirs", "pause"] as const;

const configSchema = object({
	allowEmpty: optional(boolean()),
	linear: optional(boolean()),
	continueOnConflict: optional(boolean()),
	remoteTarget: optional(boolean()),
	onConflict: optional(picklist(onConflictValues)),
	dryRun: optional(boolean()),
	yes: optional(boolean()),
	autostash: optional(boolean()),
	pushWithLease: optional(boolean()),
	noBackup: optional(boolean()),
	schemaVersion: optional(number()),
});

export type AgrbConfig = InferOutput<typeof configSchema>;

export const configKeys = [
	"allowEmpty",
	"linear",
	"continueOnConflict",
	"remoteTarget",
	"onConflict",
	"dryRun",
	"yes",
	"autostash",
	"pushWithLease",
	"noBackup",
	"schemaVersion",
] as const;

export interface ConfigResult {
	config: AgrbConfig;
	sources: Partial<Record<keyof AgrbConfig, "default" | "global" | "local">>;
}

export const defaultConfig: Omit<AgrbConfig, "schemaVersion"> = {
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
};

export const validateConfig = (config: unknown): AgrbConfig => {
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
	return result.output;
};

export const getConfig = async (cwd: string = process.cwd()) => {
	return loadConfig(
		{
			toolName: CONFIG_DIR_NAME,
			configFile: CONFIG_FILE_NAME,
			localConfigFile: LOCAL_CONFIG_FILE_NAME,
			defaultConfig,
			validate: validateConfig,
		},
		cwd,
	);
};

export const GLOBAL_CONFIG_PATH = getGlobalConfigPath(
	CONFIG_DIR_NAME,
	CONFIG_FILE_NAME,
);
