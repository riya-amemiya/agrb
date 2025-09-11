import { type SimpleGit, type SimpleGitOptions, simpleGit } from "simple-git";
import { parseRepoFromRemote, type RepoInfo } from "./github.js";

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

	async setupGitConfig(config: GitConfig): Promise<void> {
		await this.git.addConfig("user.name", config.userName);
		await this.git.addConfig("user.email", config.userEmail);
	}

	async getCurrentRepoInfo(): Promise<RepoInfo> {
		const remotes = await this.git.getRemotes(true);
		const originRemote = remotes.find((remote) => remote.name === "origin");

		if (!originRemote) {
			throw new Error("No origin remote found");
		}

		return parseRepoFromRemote(
			originRemote.refs.fetch || originRemote.refs.push || "",
		);
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

	async fetchAll(): Promise<void> {
		await this.git.fetch(["--all"]);
	}

	async checkoutBranch(branch: string, fromRemote = false): Promise<void> {
		if (fromRemote) {
			await this.git.checkout(["-B", branch, `origin/${branch}`]);
		} else {
			await this.git.checkout(branch);
		}
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

	async forcePush(localBranch: string, remoteBranch: string): Promise<void> {
		await this.git.push("origin", `${localBranch}:${remoteBranch}`, [
			"--force",
		]);
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
	): Promise<void> {
		const tempBranchName = `temp-rebase-${process.pid}`;

		try {
			progressCallback?.("Fetching all branches...");
			await this.fetchAll();

			progressCallback?.("Checking if target branch exists...");
			if (!(await this.branchExists(targetBranch))) {
				throw new Error(`Target branch '${targetBranch}' does not exist`);
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
					await this.cherryPick(commit);
				} catch (error) {
					await this.abortCherryPick();
					await this.git.checkout(currentBranch);
					throw new Error(
						`Failed to cherry-pick commit ${commit}: ${error instanceof Error ? error.message : String(error)}`,
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
}
