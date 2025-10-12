#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	ConfigEditor as AgToolkitConfigEditor,
	ArgParser,
	type ConfigItem,
	defineSchema,
	handleConfigCommand,
	resetGlobalConfig,
	writeGlobalConfig,
} from "ag-toolkit";
import { render } from "ink";
import App from "./app.js";
import {
	type AgrbConfig,
	CONFIG_DIR_NAME,
	CONFIG_FILE_NAME,
	defaultConfig,
	GLOBAL_CONFIG_PATH,
	getConfig,
} from "./lib/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const helpMessage = `
Usage
  $ agrb [options]

Options
    -t, --target <branch>    Target branch to rebase onto (optional, interactive selection if omitted)
    --allow-empty            Allow empty commits during cherry-pick
    --linear                 Use git rebase for linear history (default: cherry-pick)
    --continue-on-conflict   In linear mode, continue rebase on conflicts using 'ours' strategy.
    --on-conflict <strategy> In cherry-pick mode, specify conflict resolution strategy.
                             Strategies:
                               - pause (default): pause on conflict, allowing manual resolution.
                                 After resolving, press Enter to continue.
                               - skip: automatically skip the conflicting commit.
                               - ours: automatically resolve conflict using 'ours' strategy.
                               - theirs: automatically resolve conflict using 'theirs' strategy.
    --remote-target          Use remote branches for target selection
    --config <command>       Manage configuration. Commands: show, set, edit, reset
    --no-config              Disable loading of configuration files.
    --dry-run                Show the plan without making any changes
    -y, --yes                Skip confirmation prompts and proceed
    --autostash              Stash changes before running and (on success) pop after
    --push-with-lease        Push to origin with --force-with-lease after success
    --no-backup              Do not create a backup ref before hard reset
    -v, --version            Show version
    -h, --help               Show help

Examples
  $ agrb --target main
  $ agrb --target develop --linear
  $ agrb --linear --continue-on-conflict
  $ agrb --on-conflict pause
  $ agrb --on-conflict ours
  $ agrb --config show
  $ agrb --config set
`;

const schema = defineSchema({
	target: {
		type: "string",
		shortFlag: "t",
	},
	allowEmpty: {
		type: "boolean",
	},
	linear: {
		type: "boolean",
	},
	continueOnConflict: {
		type: "boolean",
	},
	onConflict: {
		type: "enum",
		enumValues: ["skip", "ours", "theirs", "pause"],
	},
	remoteTarget: {
		type: "boolean",
	},
	config: {
		type: "string",
	},
	noConfig: {
		type: "boolean",
	},
	dryRun: {
		type: "boolean",
	},
	yes: {
		type: "boolean",
		shortFlag: "y",
	},
	autostash: {
		type: "boolean",
	},
	pushWithLease: {
		type: "boolean",
	},
	noBackup: {
		type: "boolean",
	},
});

const agrbConfigItems: ConfigItem<AgrbConfig>[] = Object.keys(schema)
	.filter(
		(
			key,
		): key is Exclude<
			keyof typeof schema,
			"target" | "config" | "noConfig"
		> => {
			return key !== "target" && key !== "config" && key !== "noConfig";
		},
	)
	.map((key) => {
		const type = schema[key].type;
		return {
			key,
			type: type === "enum" ? "select" : type,
			options: type === "enum" ? schema[key].enumValues : undefined,
		};
	});

const AgrbConfigEditor = () => {
	return (
		<AgToolkitConfigEditor
			toolName="agrb"
			configItems={agrbConfigItems}
			defaultConfig={defaultConfig}
			loadConfig={async () => {
				const { config } = await getConfig();
				return config;
			}}
			writeConfig={(config) =>
				writeGlobalConfig(config, CONFIG_DIR_NAME, CONFIG_FILE_NAME)
			}
		/>
	);
};

try {
	const parser = new ArgParser({
		schema,
		helpMessage,
		version: packageJson.version,
	});

	const cli = parser.parse(process.argv.slice(2));

	if (cli.help) {
		console.log(cli.help);
		process.exit(0);
	}

	if (cli.version) {
		console.log(cli.version);
		process.exit(0);
	}

	if (cli.flags.config) {
		await handleConfigCommand(cli.flags.config, {
			getConfig,
			getGlobalConfigPath: () => GLOBAL_CONFIG_PATH,
			resetGlobalConfig: () =>
				resetGlobalConfig(defaultConfig, CONFIG_DIR_NAME, CONFIG_FILE_NAME),
			ConfigEditorComponent: AgrbConfigEditor,
		});
	} else {
		const { config } = cli.flags.noConfig
			? { config: defaultConfig }
			: await getConfig();

		const configurableFlags = [
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
		] as const;

		const flagProperties = Object.fromEntries(
			configurableFlags.map((flag) => [flag, cli.flags[flag] ?? config[flag]]),
		);

		const properties = {
			targetBranch: cli.flags.target,
			...flagProperties,
		};

		render(<App {...properties} />);
	}
} catch (error) {
	if (error instanceof Error) {
		console.error(`❌ ${error.message}`);
	} else {
		console.error(error);
	}
	process.exit(1);
}
