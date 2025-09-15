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
    --continue-on-conflict   Continue rebase even on conflicts (forces conflict resolution)
    --remote-target          Use remote branches for target selection
    -v, --version            Show version
    -h, --help               Show help

Examples
  $ agrb --target main
  $ agrb --target develop --linear
  $ agrb --linear --continue-on-conflict
  $ agrb --remote-target
  $ agrb --allow-empty
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
	remoteTarget: {
		type: "boolean",
	},
} as const;

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
	/>,
);
