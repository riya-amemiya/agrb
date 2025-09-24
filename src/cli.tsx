#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { render } from "ink";
import App from "./app.js";
import { ConfigEditor } from "./components/ConfigEditor.js";
import { ArgParser } from "./lib/arg-parser.js";
import {
	defaultConfig,
	GLOBAL_CONFIG_PATH,
	getConfig,
	resetGlobalConfig,
} from "./lib/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

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

const schema = {
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
		type: "string",
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
} as const;

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

	(async () => {
		if (cli.flags.config) {
			const command = cli.flags.config;
			switch (command) {
				case "show": {
					const { config, sources } = await getConfig();
					console.log(chalk.bold("Current effective configuration:"));
					const sourceColors = {
						default: chalk.gray,
						global: chalk.blue,
						local: chalk.green,
					};
					for (const key in config) {
						const k = key as keyof typeof config;
						const source = sources[k] || "default";
						const color = sourceColors[source];
						console.log(
							`  ${chalk.cyan(k)}: ${chalk.yellow(
								String(config[k]),
							)} ${color(`(${source})`)}`,
						);
					}
					break;
				}
				case "edit": {
					// biome-ignore lint/complexity/useLiteralKeys: ignore
					const editor = process.env["EDITOR"] || "vim";
					try {
						execSync(`${editor} ${GLOBAL_CONFIG_PATH}`, { stdio: "inherit" });
					} catch {
						console.error(`Failed to open editor: ${editor}`);
						process.exit(1);
					}
					break;
				}
				case "reset": {
					await resetGlobalConfig();
					console.log(
						`✅ Configuration reset to default: ${GLOBAL_CONFIG_PATH}`,
					);
					break;
				}
				case "set": {
					render(<ConfigEditor />);
					return;
				}
				default:
					console.error(`Unknown config command: ${command}`);
					console.log("Available commands: show, edit, reset, set");
					process.exit(1);
			}
			return;
		}

		const { config } = cli.flags.noConfig
			? { config: defaultConfig }
			: await getConfig();

		const props = {
			targetBranch: cli.flags.target,
			allowEmpty: cli.flags.allowEmpty ?? config.allowEmpty,
			linear: cli.flags.linear ?? config.linear,
			continueOnConflict:
				cli.flags.continueOnConflict ?? config.continueOnConflict,
			remoteTarget: cli.flags.remoteTarget ?? config.remoteTarget,
			onConflict: cli.flags.onConflict ?? config.onConflict,
			dryRun: cli.flags.dryRun ?? config.dryRun,
			yes: cli.flags.yes ?? config.yes,
			autostash: cli.flags.autostash ?? config.autostash,
			pushWithLease: cli.flags.pushWithLease ?? config.pushWithLease,
			noBackup: cli.flags.noBackup ?? config.noBackup,
		};

		render(
			<App
				targetBranch={props.targetBranch}
				allowEmpty={props.allowEmpty}
				linear={props.linear}
				continueOnConflict={props.continueOnConflict}
				remoteTarget={props.remoteTarget}
				onConflict={props.onConflict}
				dryRun={props.dryRun}
				yes={props.yes}
				autostash={props.autostash}
				pushWithLease={props.pushWithLease}
				noBackup={props.noBackup}
			/>,
		);
	})();
} catch (error) {
	if (error instanceof Error) {
		console.error(`❌ ${error.message}`);
	} else {
		console.error(error);
	}
	process.exit(1);
}
