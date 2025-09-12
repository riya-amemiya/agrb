#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";

const cli = meow(
	`
	Usage
	  $ agrb [options]

	Options
		--target <branch>    Target branch to rebase onto (optional, interactive selection if omitted)
		--allow-empty        Allow empty commits during cherry-pick
		--linear             Use git rebase for linear history (default: cherry-pick)
		--continue-on-conflict   Continue rebase even on conflicts (forces conflict resolution)
		--remote-target      Use remote branches for target selection

	Examples
	  $ agrb --target main
	  $ agrb --target develop --linear
	  $ agrb --linear --continue-on-conflict
	  $ agrb --remote-target
	  $ agrb --allow-empty
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
			linear: {
				type: "boolean",
			},
			continueOnConflict: {
				type: "boolean",
			},
			remoteTarget: {
				type: "boolean",
			},
		},
	},
);

render(
	<App
		targetBranch={cli.flags.target}
		allowEmpty={cli.flags.allowEmpty}
		linear={cli.flags.linear}
		continueOnConflict={cli.flags.continueOnConflict}
		remoteTarget={cli.flags.remoteTarget}
	/>,
);
