#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";

const cli = meow(
	`
	Usage
	  $ garb [options]

	Options
		--target <branch>    Target branch to rebase onto (optional, interactive selection if omitted)
		--allow-empty        Allow empty commits during cherry-pick
		--skip               Skip empty commits during cherry-pick
		--linear             Use git rebase for linear history (default: cherry-pick)
		--continue-on-conflict   Continue rebase even on conflicts (forces conflict resolution)
		--remote-target      Use remote branches for target selection

	Examples
	  $ garb --target main
	  $ garb --target develop --linear
	  $ garb --linear --continue-on-conflict
	  $ garb --remote-target
	  $ garb --allow-empty
	  $ garb --skip
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
		skip={cli.flags.skip}
		linear={cli.flags.linear}
		continueOnConflict={cli.flags.continueOnConflict}
		remoteTarget={cli.flags.remoteTarget}
	/>,
);
