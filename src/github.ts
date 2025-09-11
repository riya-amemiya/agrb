import { Octokit } from "@octokit/rest";

export interface PRInfo {
	number: number;
	headRef: string;
	baseRef: string;
	title: string;
	commits: Array<{
		sha: string;
		message: string;
	}>;
}

export interface RepoInfo {
	owner: string;
	repo: string;
}

export class GitHubClient {
	private octokit: Octokit;
	private repoInfo: RepoInfo;

	constructor(token: string, repoInfo: RepoInfo) {
		this.octokit = new Octokit({
			auth: token,
		});
		this.repoInfo = repoInfo;
	}

	async getPRInfo(prNumber: number): Promise<PRInfo> {
		const { data: pr } = await this.octokit.rest.pulls.get({
			owner: this.repoInfo.owner,
			repo: this.repoInfo.repo,
			pull_number: prNumber,
		});

		const { data: commits } = await this.octokit.rest.pulls.listCommits({
			owner: this.repoInfo.owner,
			repo: this.repoInfo.repo,
			pull_number: prNumber,
		});

		return {
			number: pr.number,
			headRef: pr.head.ref,
			baseRef: pr.base.ref,
			title: pr.title,
			commits: commits.map((commit) => ({
				sha: commit.sha,
				message: commit.commit.message,
			})),
		};
	}

	async updatePRBase(prNumber: number, newBase: string): Promise<void> {
		await this.octokit.rest.pulls.update({
			owner: this.repoInfo.owner,
			repo: this.repoInfo.repo,
			pull_number: prNumber,
			base: newBase,
		});
	}

	async addComment(prNumber: number, body: string): Promise<void> {
		await this.octokit.rest.issues.createComment({
			owner: this.repoInfo.owner,
			repo: this.repoInfo.repo,
			issue_number: prNumber,
			body,
		});
	}

	async checkBranchExists(branch: string): Promise<boolean> {
		try {
			await this.octokit.rest.repos.getBranch({
				owner: this.repoInfo.owner,
				repo: this.repoInfo.repo,
				branch,
			});
			return true;
		} catch (error) {
			if (error instanceof Error && "status" in error && error.status === 404) {
				return false;
			}
			throw error;
		}
	}
}

export function parseRepoFromRemote(remote: string): RepoInfo {
	const sshMatch = remote.match(/git@github\.com:(.+?)\/(.+?)\.git$/);
	if (sshMatch?.[1] && sshMatch[2]) {
		return { owner: sshMatch[1], repo: sshMatch[2] };
	}

	const httpsMatch = remote.match(/https:\/\/github\.com\/(.+?)\/(.+?)\.git$/);
	if (httpsMatch?.[1] && httpsMatch[2]) {
		return { owner: httpsMatch[1], repo: httpsMatch[2] };
	}

	throw new Error(`Invalid GitHub remote URL: ${remote}`);
}
