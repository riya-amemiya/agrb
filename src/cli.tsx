#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "ink";
import App from "./app.js";
import { ArgParser } from "./lib/arg-parser.js";

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
    -v, --version            Show version
    -h, --help               Show help

Examples
  $ agrb --target main
  $ agrb --target develop --linear
  $ agrb --linear --continue-on-conflict
  $ agrb --on-conflict pause
  $ agrb --on-conflict ours
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

	render(
		<App
			targetBranch={cli.flags.target}
			allowEmpty={cli.flags.allowEmpty}
			linear={cli.flags.linear}
			continueOnConflict={cli.flags.continueOnConflict}
			remoteTarget={cli.flags.remoteTarget}
			onConflict={cli.flags.onConflict}
		/>,
	);
} catch (error) {
	if (error instanceof Error) {
		console.error(`❌ ${error.message}`);
		process.exit(1);
	}
	console.error(error);
	process.exit(1);
}
