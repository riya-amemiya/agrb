import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitOperations } from "./git.js";
import { sanitizeString } from "./lib/sanitizeString.js";

type OnConflictStrategy = "skip" | "ours" | "theirs" | "pause";

type Props = {
	targetBranch?: string;
	allowEmpty?: boolean;
	linear?: boolean;
	continueOnConflict?: boolean;
	remoteTarget?: boolean;
	onConflict?: string;
};

type Status =
	| "loading"
	| "success"
	| "error"
	| "selecting"
	| "paused_on_conflict";

interface RebaseState {
	status: Status;
	message: string;
	currentBranch?: string;
	targetBranch?: string;
	availableBranches?: string[];
	commitsToPick?: string[];
	currentCommitIndex?: number;
	tempBranchName?: string;
}

const isValidOnConflict = (s: string): s is OnConflictStrategy =>
	["skip", "ours", "theirs", "pause"].includes(s);

export default function App({
	targetBranch: initialTargetBranch,
	allowEmpty,
	linear,
	continueOnConflict,
	remoteTarget,
	onConflict: onConflictRaw,
}: Props) {
	const { exit } = useApp();
	const [state, setState] = useState<RebaseState>({
		status: "loading",
		message: "Initializing...",
		targetBranch: initialTargetBranch,
	});
	const [searchTerm, setSearchTerm] = useState("");
	const gitOps = useMemo(() => new GitOperations(), []);

	const stateRef = useRef(state);
	stateRef.current = state;

	const onConflict: OnConflictStrategy =
		onConflictRaw && isValidOnConflict(onConflictRaw) ? onConflictRaw : "skip";

	const handleError = useCallback(
		async (error: unknown, tempBranchName?: string) => {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (tempBranchName && stateRef.current.currentBranch) {
				await gitOps.cleanupCherryPick(
					tempBranchName,
					stateRef.current.currentBranch,
				);
			}
			setState((prev) => ({
				...prev,
				status: "error",
				message: `Error: ${errorMessage}`,
			}));
		},
		[gitOps],
	);

	const performLinearRebase = useCallback(
		async (currentBranch: string, target: string) => {
			try {
				setState((prev) => ({
					...prev,
					status: "loading",
					message: `Rebasing ${currentBranch} onto ${target} (linear)`,
					currentBranch,
					targetBranch: target,
				}));
				await gitOps.performLinearRebase(
					currentBranch,
					target,
					(message: string) => setState((prev) => ({ ...prev, message })),
					{ continueOnConflict },
				);
				setState((prev) => ({
					...prev,
					status: "success",
					message: `Successfully rebased ${currentBranch} onto ${target}!`,
					currentBranch,
					targetBranch: target,
				}));
			} catch (error) {
				await handleError(error);
			}
		},
		[continueOnConflict, gitOps, handleError],
	);

	const startCherryPickRebase = useCallback(
		async (currentBranch: string, target: string) => {
			setState((prev) => ({
				...prev,
				status: "loading",
				message: `Rebasing ${currentBranch} onto ${target} (cherry-pick)`,
				currentBranch,
				targetBranch: target,
			}));
			try {
				await gitOps.fetchAll();
				if (!(await gitOps.branchExists(target))) {
					throw new Error(`Target branch '${target}' does not exist`);
				}
				const tempBranchName = await gitOps.setupCherryPick(target);
				const mergeBase = await gitOps.getMergeBase(target, currentBranch);
				const commits = await gitOps.getCommitsToCherryPick(
					mergeBase,
					currentBranch,
				);
				setState((prev) => ({
					...prev,
					status: "loading",
					message: `Found ${commits.length} commits to apply.`,
					tempBranchName,
					commitsToPick: commits,
					currentCommitIndex: 0,
				}));
			} catch (error) {
				await handleError(error);
			}
		},
		[gitOps, handleError],
	);

	const applyNextCommit = useCallback(async () => {
		const {
			commitsToPick,
			currentCommitIndex,
			tempBranchName,
			currentBranch,
			targetBranch,
		} = stateRef.current;

		if (
			!commitsToPick ||
			currentCommitIndex === undefined ||
			!tempBranchName ||
			!currentBranch
		) {
			return;
		}

		if (currentCommitIndex >= commitsToPick.length) {
			// Finished
			try {
				setState((prev) => ({ ...prev, message: "Finishing rebase..." }));
				await gitOps.finishCherryPick(currentBranch, tempBranchName);
				await gitOps.cleanupCherryPick(tempBranchName, currentBranch);
				setState((prev) => ({
					...prev,
					status: "success",
					message: `Successfully rebased ${currentBranch} onto ${targetBranch}!`,
				}));
			} catch (error) {
				await handleError(error, tempBranchName);
			}
			return;
		}

		const commit = commitsToPick[currentCommitIndex];
		if (!commit) {
			await handleError(
				new Error(`Invalid commit index: ${currentCommitIndex}`),
				tempBranchName,
			);
			return;
		}

		setState((prev) => ({
			...prev,
			message: `Applying commit ${currentCommitIndex + 1}/${
				commitsToPick.length
			}: ${commit.slice(0, 7)}`,
		}));

		try {
			const strategy =
				onConflict === "ours" || onConflict === "theirs"
					? onConflict
					: undefined;
			await gitOps.cherryPick(commit, { allowEmpty, strategy });
			setState((prev) => ({
				...prev,
				currentCommitIndex: (prev.currentCommitIndex ?? -1) + 1,
			}));
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("empty")) {
				setState((prev) => ({
					...prev,
					message: `Commit ${commit.slice(
						0,
						7,
					)} is empty, skipping automatically.`,
					currentCommitIndex: (prev.currentCommitIndex ?? -1) + 1,
				}));
			} else if (errorMessage.includes("CONFLICT")) {
				if (onConflict === "skip") {
					setState((prev) => ({
						...prev,
						message: `Conflict on commit ${commit.slice(
							0,
							7,
						)}, skipping as per config.`,
					}));
					await gitOps.skipCherryPick();
					setState((prev) => ({
						...prev,
						currentCommitIndex: (prev.currentCommitIndex ?? -1) + 1,
					}));
				} else if (onConflict === "pause") {
					setState((prev) => ({
						...prev,
						status: "paused_on_conflict",
						message: `Conflict on commit ${commit.slice(
							0,
							7,
						)}. Please resolve conflicts in another terminal, then press Enter to continue.`,
					}));
				} else {
					// 'ours' or 'theirs' failed, or another error
					await gitOps.abortCherryPick();
					await handleError(error, tempBranchName);
				}
			} else {
				await gitOps.abortCherryPick();
				await handleError(error, tempBranchName);
			}
		}
	}, [gitOps, allowEmpty, onConflict, handleError]);

	const resumeCherryPick = useCallback(async () => {
		if (stateRef.current.status !== "paused_on_conflict") {
			return;
		}
		setState((prev) => ({
			...prev,
			status: "loading",
			message: "Attempting to continue cherry-pick...",
		}));
		try {
			await gitOps.continueCherryPick();
			setState((prev) => ({
				...prev,
				currentCommitIndex: (prev.currentCommitIndex ?? -1) + 1,
			}));
		} catch (error) {
			setState((prev) => ({
				...prev,
				status: "paused_on_conflict",
				message: `Failed to continue. Make sure conflicts are resolved and staged. Error: ${
					error instanceof Error ? error.message : String(error)
				}. Press Enter to retry.`,
			}));
		}
	}, [gitOps]);

	useEffect(() => {
		if (state.status === "loading" && state.currentCommitIndex !== undefined) {
			applyNextCommit();
		}
	}, [state.status, state.currentCommitIndex, applyNextCommit]);

	const isInitialized = useRef(false);
	useEffect(() => {
		if (isInitialized.current) {
			return;
		}
		isInitialized.current = true;

		async function initialize() {
			try {
				const isClean = await gitOps.isWorkdirClean();
				if (!isClean) {
					throw new Error(
						"Uncommitted changes detected. Please commit or stash your changes before running agrb.",
					);
				}
				const currentBranch = await gitOps.getCurrentBranch();
				setState((prev) => ({ ...prev, currentBranch }));

				if (!initialTargetBranch) {
					const branches = remoteTarget
						? await gitOps.getAllBranches()
						: await gitOps.getLocalBranches();
					const filteredBranches = branches.filter(
						(branch) => branch !== currentBranch,
					);
					setState((prev) => ({
						...prev,
						status: "selecting",
						message: "Select target branch (type to filter):",
						availableBranches: filteredBranches,
					}));
				} else if (linear) {
					await performLinearRebase(currentBranch, initialTargetBranch);
				} else {
					await startCherryPickRebase(currentBranch, initialTargetBranch);
				}
			} catch (error) {
				await handleError(error);
			}
		}
		initialize();
	}, [
		gitOps,
		handleError,
		initialTargetBranch,
		linear,
		performLinearRebase,
		remoteTarget,
		startCherryPickRebase,
	]);

	const handleBranchSelect = (item: { label: string; value: string }) => {
		if (state.currentBranch) {
			if (linear) {
				performLinearRebase(state.currentBranch, item.value);
			} else {
				startCherryPickRebase(state.currentBranch, item.value);
			}
		}
	};

	useInput(
async (input, key) => {
			if (state.status === "paused_on_conflict" && key.return) {
				resumeCherryPick();
				return;
			}

			if (key.escape) {
				if (state.tempBranchName && state.currentBranch) {
					await gitOps.cleanupCherryPick(state.tempBranchName, state.currentBranch);
				}
				exit();
				return;
			}

			if (state.status !== "selecting") {
				return;
			}

			if (key.return || key.upArrow || key.downArrow) {
				return;
			}

			if (key.backspace || key.delete) {
				setSearchTerm((prev) => prev.slice(0, -1));
			} else if (input && !key.ctrl && !key.meta) {
				setSearchTerm((prev) => prev + input);
			}
		},
		{ isActive: true },
	);

	const filteredBranches =
		state.availableBranches?.filter((branch) => {
			const branchLower = branch.toLowerCase();
			const searchTerms = searchTerm
				.toLowerCase()
				.split(/\s+/)
				.filter((term) => term.length > 0);
			if (searchTerms.length === 0) {
				return true;
			}
			return searchTerms.every((term) => branchLower.includes(term));
		}) || [];

	const sanitizedMessage = sanitizeString(state.message);

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text color="blue" bold>
					Auto Rebase
				</Text>
			</Box>

			{state.currentBranch && (
				<Box marginBottom={1}>
					<Text color="gray">
						{state.currentBranch} → {state.targetBranch}
					</Text>
				</Box>
			)}

			<Box>
				{state.status === "loading" && (
					<Text>
						<Spinner type="dots" /> {sanitizedMessage}
					</Text>
				)}
				{state.status === "selecting" && (
					<Box flexDirection="column">
						<Text>{sanitizedMessage}</Text>
						{searchTerm && <Text color="gray">Filter: {searchTerm}</Text>}
						<SelectInput
							items={filteredBranches.map((branch) => ({
								label: branch,
								value: branch,
							}))}
							onSelect={handleBranchSelect}
						/>
					</Box>
				)}
				{state.status === "paused_on_conflict" && (
					<Text color="yellow">⏸ {sanitizedMessage}</Text>
				)}
				{state.status === "success" && (
					<Text color="green">✅ {sanitizedMessage}</Text>
				)}
				{state.status === "error" && (
					<Text color="red">❌ {sanitizedMessage}</Text>
				)}
			</Box>
		</Box>
	);
}
