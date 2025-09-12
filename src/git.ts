import { type SimpleGit, type SimpleGitOptions, simpleGit } from "simple-git";
export interface GitConfig {
	userName: string;
	userEmail: string;
}

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

	async createTemporaryBranch(name: string, fromBranch: string): Promise<void> {
		await this.git.checkout(["-b", name, `origin/${fromBranch}`]);
	}

	async getMergeBase(branch1: string, branch2: string): Promise<string> {
		const result = await this.git.raw([
			"merge-base",
			`origin/${branch1}`,
			branch2,
		]);
		return result.trim();
	}

	async getCommitsBetween(from: string, to: string): Promise<string[]> {
		const result = await this.git.raw([
			"rev-list",
			"--reverse",
			`${from}..${to}`,
		]);
		return result.trim().split("\n").filter(Boolean);
	}

	async isCommitMerge(commitSha: string): Promise<boolean> {
		try {
			await this.git.raw(["rev-parse", "--verify", `${commitSha}^2`]);
			return true;
		} catch {
			return false;
		}
	}

	async cherryPick(commitSha: string): Promise<void> {
		await this.git.raw(["cherry-pick", commitSha]);
	}

	async abortCherryPick(): Promise<void> {
		try {
			await this.git.raw(["cherry-pick", "--abort"]);
		} catch {}
	}

	async branchExists(branch: string): Promise<boolean> {
		try {
			await this.git.raw([
				"show-ref",
				"--verify",
				"--quiet",
				`refs/remotes/origin/${branch}`,
			]);
			return true;
		} catch {
			return false;
		}
	}

	async performLocalRebase(
		currentBranch: string,
		targetBranch: string,
		progressCallback?: (message: string) => void,
		options?: {
			allowEmpty?: boolean;
			linear?: boolean;
			continueOnConflict?: boolean;
		},
	): Promise<void> {
		const tempBranchName = `temp-rebase-${process.pid}`;

		try {
			progressCallback?.("Fetching all branches...");
			await this.fetchAll();

			progressCallback?.("Checking if target branch exists...");
			if (!(await this.branchExists(targetBranch))) {
				throw new Error(`Target branch '${targetBranch}' does not exist`);
			}

			if (options?.linear) {
				return await this.performLinearRebase(
					currentBranch,
					targetBranch,
					progressCallback,
					options,
				);
			}

			progressCallback?.("Finding merge base and commits...");
			const mergeBase = await this.getMergeBase(targetBranch, currentBranch);
			const commits = await this.getCommitsBetween(mergeBase, currentBranch);

			progressCallback?.("Creating temporary branch...");
			await this.createTemporaryBranch(tempBranchName, targetBranch);

			progressCallback?.("Applying commits...");
			for (const commit of commits) {
				if (await this.isCommitMerge(commit)) {
					progressCallback?.(`Skipping merge commit: ${commit}`);
					continue;
				}

				progressCallback?.(`Applying commit: ${commit}`);
				try {
					if (options?.allowEmpty) {
						await this.git.raw(["cherry-pick", "--allow-empty", commit]);
					} else {
						await this.cherryPick(commit);
					}
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					if (
						errorMessage.includes("empty") ||
						errorMessage.includes("CONFLICT")
					) {
						try {
							await this.git.raw(["cherry-pick", "--skip"]);
							continue;
						} catch {}
					}
					await this.abortCherryPick();
					await this.git.checkout(currentBranch);
					throw new Error(
						`Failed to cherry-pick commit ${commit}: ${errorMessage}`,
					);
				}
			}

			progressCallback?.("Updating current branch...");
			await this.git.checkout(currentBranch);
			await this.git.raw(["reset", "--hard", tempBranchName]);

			progressCallback?.("Rebase completed successfully");
		} finally {
			try {
				await this.git.raw(["branch", "-D", tempBranchName]);
			} catch {}
		}
	}

	async performLinearRebase(
		currentBranch: string,
		targetBranch: string,
		progressCallback?: (message: string) => void,
		options?: { continueOnConflict?: boolean },
	): Promise<void> {
		try {
			progressCallback?.("Starting linear rebase...");

			await this.git.checkout(currentBranch);

			const rebaseArgs = ["rebase", `origin/${targetBranch}`];

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
				} catch {
					try {
						await this.git.raw(["rebase", "--abort"]);
					} catch {}
					throw new Error(
						`Linear rebase failed: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			} else {
				try {
					await this.git.raw(["rebase", "--abort"]);
				} catch {}
				throw new Error(
					`Linear rebase failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}
}
