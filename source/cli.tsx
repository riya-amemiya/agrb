#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";

const cli = meow(
	`
	Usage
	  $ auto-rebase [options]

	Options
		--target <branch>    Target branch to rebase onto (optional, interactive selection if omitted)
		--allow-empty        Allow empty commits during cherry-pick
		--skip               Skip empty commits during cherry-pick

	Examples
	  $ auto-rebase --target main
	  $ auto-rebase --target develop
	  $ auto-rebase --allow-empty
	  $ auto-rebase --skip
`,
	{
		importMeta: import.meta,
		flags: {
			target: {
				type: "string",
				shortFlag: "t",
			},
			allowEmpty: {
				type: "boolean",
			},
			skip: {
				type: "boolean",
			},
		},
	},
);

render(<App targetBranch={cli.flags.target} allowEmpty={cli.flags.allowEmpty} skip={cli.flags.skip} />);
