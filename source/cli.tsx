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

	Examples
	  $ auto-rebase --target main
	  $ auto-rebase --target develop
	  $ auto-rebase
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

render(<App targetBranch={cli.flags.target} />);
