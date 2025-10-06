import { isValidBranchName } from "ag-toolkit";
import { type SimpleGit, type SimpleGitOptions, simpleGit } from "simple-git";
export class GitOperations {
	private git: SimpleGit;

	private stripOriginPrefix(branch: string): string {
		return branch.startsWith("origin/")
			? branch.replace("origin/", "")
			: branch;
	}

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
		const branchName = this.stripOriginPrefix(branch);
		if (!isValidBranchName(branchName)) {
			throw new Error(`Invalid branch name: ${branchName}`);
		}
		try {
			await this.git.raw([
				"show-ref",
				"--verify",
				"--quiet",
				`refs/remotes/origin/${branchName}`,
			]);
			return true;
		} catch {
			try {
				await this.git.raw([
					"show-ref",
					"--verify",
					"--quiet",
					`refs/heads/${branchName}`,
				]);
				return true;
			} catch {
				return false;
			}
		}
	}

	private async resolveBranchRef(branch: string): Promise<string> {
		if (branch.startsWith("origin/")) {
			return branch;
		}
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

	async setupCherryPick(targetBranch: string): Promise<string> {
		const branchName = this.stripOriginPrefix(targetBranch);
		if (!isValidBranchName(branchName)) {
			throw new Error(`Invalid branch name: ${branchName}`);
		}
		const tempBranchName = `temp-rebase-${process.pid}`;
		const checkoutTarget = await this.resolveBranchRef(targetBranch);
		await this.git.checkout(["-b", tempBranchName, checkoutTarget]);
		return tempBranchName;
	}

	async getMergeBase(branch1: string, branch2: string): Promise<string> {
		const branchName1 = this.stripOriginPrefix(branch1);
		const branchName2 = this.stripOriginPrefix(branch2);
		if (!isValidBranchName(branchName1)) {
			throw new Error(`Invalid branch name: ${branchName1}`);
		}
		if (!isValidBranchName(branchName2)) {
			throw new Error(`Invalid branch name: ${branchName2}`);
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
		options?: { createBackup?: boolean },
	): Promise<void> {
		await this.git.checkout(currentBranch);
		if (options?.createBackup) {
			try {
				const currentSha = (await this.git.revparse([currentBranch])).trim();
				const safeBranch = currentBranch.replace(/\//g, "-");
				const tagName = `agrb-backup-${safeBranch}-${Date.now()}`;
				await this.git.addAnnotatedTag(
					tagName,
					`Backup before agrb reset: ${currentBranch} @ ${currentSha}`,
				);
			} catch (error) {
				throw new Error(
					`Failed to create backup tag: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}
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

	async performLinearRebase(
		currentBranch: string,
		targetBranch: string,
		progressCallback?: (message: string) => void,
		options?: { continueOnConflict?: boolean },
	): Promise<void> {
		const branchName = this.stripOriginPrefix(targetBranch);
		if (!isValidBranchName(branchName)) {
			throw new Error(`Invalid branch name: ${branchName}`);
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
					await this.git.checkout(["--ours", "."]);
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

	async getCommitSubject(sha: string): Promise<string> {
		const out = await this.git.raw(["show", "-s", "--format=%s", sha]);
		return out.trim();
	}

	async startAutostash(): Promise<string | null> {
		const label = `agrb-${process.pid}`;
		await this.git.raw(["stash", "push", "-u", "-m", label]);
		const list = await this.git.raw(["stash", "list", "--format=%gd %gs"]);
		const line = list
			.split("\n")
			.map((l) => l.trim())
			.find((l) => l.includes(label));
		if (!line) {
			return null;
		}
		const ref = line.split(" ")[0];
		return ref || null;
	}

	async popStash(stashRef: string): Promise<void> {
		await this.git.raw(["stash", "pop", stashRef]);
	}

	async pushWithLease(branch: string): Promise<void> {
		await this.git.push(["-u", "origin", branch, "--force-with-lease"]);
	}
}
