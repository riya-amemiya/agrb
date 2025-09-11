#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";

const cli = meow(
	`
	Usage
	  $ auto-rebase [options]

	Options
		--target <branch>    Target branch to rebase onto (required)

	Examples
	  $ auto-rebase --target main
	  $ auto-rebase --target develop
`,
	{
		importMeta: import.meta,
		flags: {
			target: {
				type: "string",
				shortFlag: "t",
			},
		},
	},
);

if (!cli.flags.target) {
	console.error("Error: Target branch is required. Use --target flag");
	process.exit(1);
}

render(<App targetBranch={cli.flags.target} />);
