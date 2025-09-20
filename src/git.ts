import { type SimpleGit, type SimpleGitOptions, simpleGit } from "simple-git";
import { isValidBranchName } from "./lib/isValidBranchName.js";

export class GitOperations {
	private git: SimpleGit;

	constructor(workingDir?: string) {
		const options: SimpleGitOptions = {
			baseDir: workingDir || process.cwd(),
			binary: "git",
			maxConcurrentProcesses: 1,
			config: [],
			trimmed: false,
		};
		this.git = simpleGit(options);
	}

	async getCurrentBranch(): Promise<string> {
		const status = await this.git.status();
		return status.current || "HEAD";
	}

	async isWorkdirClean(): Promise<boolean> {
		const status = await this.git.status();
		return status.isClean();
	}

	async getAllBranches(): Promise<string[]> {
		const branches = await this.git.branch(["-r"]);
		return branches.all
			.filter(
				(branch) =>
					typeof branch === "string" &&
					branch.startsWith("origin/") &&
					!branch.includes("HEAD"),
			)
			.map((branch) => (branch as string).replace("origin/", ""));
	}

	async getLocalBranches(): Promise<string[]> {
		const branches = await this.git.branch(["-l"]);
		return branches.all
			.filter(
				(branch) => typeof branch === "string" && !branch.includes("HEAD"),
			)
			.map((branch) => (branch as string).replace("* ", ""));
	}

	async fetchAll(): Promise<void> {
		await this.git.fetch(["--all"]);
	}

	async branchExists(branch: string): Promise<boolean> {
		if (!isValidBranchName(branch)) {
			throw new Error(`Invalid branch name: ${branch}`);
		}
		try {
			await this.git.raw([
				"show-ref",
				"--verify",
				"--quiet",
				`refs/remotes/origin/${branch}`,
			]);
			return true;
		} catch {
			try {
				await this.git.raw([
					"show-ref",
					"--verify",
					"--quiet",
					`refs/heads/${branch}`,
				]);
				return true;
			} catch {
				return false;
			}
		}
	}

	private async resolveBranchRef(branch: string): Promise<string> {
		try {
			await this.git.raw([
				"show-ref",
				"--verify",
				"--quiet",
				`refs/remotes/origin/${branch}`,
			]);
			return `origin/${branch}`;
		} catch {
			return branch;
		}
	}

	// --- Cherry-pick rebase methods ---

	async setupCherryPick(targetBranch: string): Promise<string> {
		if (!isValidBranchName(targetBranch)) {
			throw new Error(`Invalid branch name: ${targetBranch}`);
		}
		const tempBranchName = `temp-rebase-${process.pid}`;
		const checkoutTarget = await this.resolveBranchRef(targetBranch);
		await this.git.checkout(["-b", tempBranchName, checkoutTarget]);
		return tempBranchName;
	}

	async getMergeBase(branch1: string, branch2: string): Promise<string> {
		if (!isValidBranchName(branch1)) {
			throw new Error(`Invalid branch name: ${branch1}`);
		}
		if (!isValidBranchName(branch2)) {
			throw new Error(`Invalid branch name: ${branch2}`);
		}
		const baseBranch = await this.resolveBranchRef(branch1);
		const result = await this.git.raw(["merge-base", baseBranch, branch2]);
		return result.trim();
	}

	async getCommitsToCherryPick(from: string, to: string): Promise<string[]> {
		const result = await this.git.raw([
			"rev-list",
			"--reverse",
			"--no-merges",
			`${from}..${to}`,
		]);
		return result.trim().split("\n").filter(Boolean);
	}

	async cherryPick(
		commitSha: string,
		options?: { allowEmpty?: boolean },
	): Promise<void> {
		const args = ["cherry-pick"];
		if (options?.allowEmpty) {
			args.push("--allow-empty");
		}
		args.push(commitSha);
		await this.git.raw(args);
	}

	async continueCherryPick(): Promise<void> {
		await this.git.raw(["cherry-pick", "--continue"]);
	}

	async skipCherryPick(): Promise<void> {
		await this.git.raw(["cherry-pick", "--skip"]);
	}

	async abortCherryPick(): Promise<void> {
		try {
			await this.git.raw(["cherry-pick", "--abort"]);
		} catch {}
	}

	async resolveConflictWithStrategy(
		strategy: "ours" | "theirs",
	): Promise<void> {
		await this.git.checkout([`--${strategy}`, "."]);
		await this.git.add(".");
	}

	async finishCherryPick(
		currentBranch: string,
		tempBranchName: string,
	): Promise<void> {
		await this.git.checkout(currentBranch);
		await this.git.raw(["reset", "--hard", tempBranchName]);
	}

	async cleanupCherryPick(
		tempBranchName: string,
		originalBranch: string,
	): Promise<void> {
		try {
			const current = await this.getCurrentBranch();
			if (current === tempBranchName) {
				await this.git.checkout(originalBranch);
			}
			await this.git.branch(["-D", tempBranchName]);
		} catch {}
	}

	// --- Linear rebase method ---

	async performLinearRebase(
		currentBranch: string,
		targetBranch: string,
		progressCallback?: (message: string) => void,
		options?: { continueOnConflict?: boolean },
	): Promise<void> {
		if (!isValidBranchName(targetBranch)) {
			throw new Error(`Invalid branch name: ${targetBranch}`);
		}
		try {
			progressCallback?.("Fetching all branches...");
			await this.fetchAll();

			progressCallback?.("Checking if target branch exists...");
			if (!(await this.branchExists(targetBranch))) {
				throw new Error(`Target branch '${targetBranch}' does not exist`);
			}

			progressCallback?.("Starting linear rebase...");
			await this.git.checkout(currentBranch);

			const rebaseTarget = await this.resolveBranchRef(targetBranch);

			const rebaseArgs = ["rebase", rebaseTarget];
			if (options?.continueOnConflict) {
				rebaseArgs.push("-X", "ours");
			}

			await this.git.raw(rebaseArgs);
			progressCallback?.("Linear rebase completed successfully");
		} catch (error) {
			if (options?.continueOnConflict) {
				try {
					progressCallback?.(
						"Conflicts detected, auto-resolving and continuing...",
					);
					await this.git.add(".");
					await this.git.raw(["rebase", "--continue"]);
					progressCallback?.(
						"Linear rebase completed with conflicts auto-resolved",
					);
				} catch (e) {
					try {
						await this.git.raw(["rebase", "--abort"]);
					} catch {}
					throw new Error(
						`Linear rebase failed during continue: ${
							e instanceof Error ? e.message : String(e)
						}`,
					);
				}
			} else {
				try {
					await this.git.raw(["rebase", "--abort"]);
				} catch {}
				throw new Error(
					`Linear rebase failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}
	}
}
