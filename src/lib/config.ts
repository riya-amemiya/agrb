import { getGlobalConfigPath, loadConfig } from "ag-toolkit";
import {
	boolean,
	number,
	object,
	optional,
	type SchemaToInterface,
	string,
	type ValidateReturnType,
} from "umt/Validate";

export const CONFIG_FILE_NAME = "config.json";
export const CONFIG_DIR_NAME = "agrb";
export const LOCAL_CONFIG_FILE_NAME = ".agrbrc";

const onConflictValues = ["skip", "ours", "theirs", "pause"] as const;

export const picklist = <T extends readonly unknown[]>(
	values: T,
	message?: string,
): ValidateReturnType<string> => ({
	type: "string",
	message,
	validate: (value) => values.includes(value),
});

const configSchema = object({
	allowEmpty: optional(boolean()),
	linear: optional(boolean()),
	continueOnConflict: optional(boolean()),
	remoteTarget: optional(boolean()),
	onConflict: optional(string([picklist(onConflictValues)])),
	dryRun: optional(boolean()),
	yes: optional(boolean()),
	autostash: optional(boolean()),
	pushWithLease: optional(boolean()),
	noBackup: optional(boolean()),
	schemaVersion: optional(number()),
});

export type AgrbConfig = SchemaToInterface<typeof configSchema>;

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
	const result = configSchema(config as AgrbConfig);
	if (!result.validate) {
		const error = result.message;
		throw new Error(`Configuration errors:\n- ${error}`);
	}
	return result.type;
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
