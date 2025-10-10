import { sanitizeString } from "ag-toolkit";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BranchSelector } from "./components/BranchSelector.js";
import { GitOperations } from "./git.js";

type OnConflictStrategy = "skip" | "ours" | "theirs" | "pause";

type Properties = {
	targetBranch?: string;
	allowEmpty?: boolean;
	linear?: boolean;
	continueOnConflict?: boolean;
	remoteTarget?: boolean;
	onConflict?: string;
	dryRun?: boolean;
	yes?: boolean;
	autostash?: boolean;
	pushWithLease?: boolean;
	noBackup?: boolean;
};

type Status =
	| "loading"
	| "success"
	| "error"
	| "selecting"
	| "paused_on_conflict"
	| "confirm";

interface RebaseState {
	status: Status;
	message: string;
	currentBranch?: string;
	targetBranch?: string;
	availableBranches?: string[];
	commitsToPick?: string[];
	currentCommitIndex?: number;
	tempBranchName?: string;
	stashRef?: string | null;
	pendingMode?: "cherry" | "linear";
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
	dryRun,
	yes,
	autostash,
	pushWithLease,
	noBackup,
}: Properties) {
	const { exit } = useApp();
	const [state, setState] = useState<RebaseState>({
		status: "loading",
		message: "Initializing...",
		targetBranch: initialTargetBranch,
	});
	const gitOps = useMemo(() => new GitOperations(), []);

	const stateReference = useRef(state);
	stateReference.current = state;

	const onConflict: OnConflictStrategy =
		onConflictRaw && isValidOnConflict(onConflictRaw) ? onConflictRaw : "pause";

	const handleError = useCallback(
		async (error: unknown, temporaryBranchName?: string) => {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (temporaryBranchName && stateReference.current.currentBranch) {
				await gitOps.cleanupCherryPick(
					temporaryBranchName,
					stateReference.current.currentBranch,
				);
			}
			setState((previous) => ({
				...previous,
				status: "error",
				message: `Error: ${errorMessage}`,
			}));
		},
		[gitOps],
	);

	const performLinearRebase = useCallback(
		async (currentBranch: string, target: string) => {
			try {
				if (dryRun) {
					setState((previous) => ({
						...previous,
						status: "success",
						message: `DRY-RUN: Would rebase ${currentBranch} onto ${target} (linear${
							continueOnConflict ? ", -X ours" : ""
						}).`,
						currentBranch,
						targetBranch: target,
					}));
					return;
				}

				if (!yes && stateReference.current.status !== "confirm") {
					setState((previous) => ({
						...previous,
						status: "confirm",
						message: `Proceed to rebase ${currentBranch} onto ${target} (linear)? Press Enter to continue, Esc to cancel.`,
						currentBranch,
						targetBranch: target,
						pendingMode: "linear",
					}));
					return;
				}

				setState((previous) => ({
					...previous,
					status: "loading",
					message: `Rebasing ${currentBranch} onto ${target} (linear)`,
					currentBranch,
					targetBranch: target,
				}));

				if (autostash) {
					const reference = await gitOps.startAutostash();
					setState((previous) => ({ ...previous, stashRef: reference }));
				}

				await gitOps.performLinearRebase(
					currentBranch,
					target,
					(message: string) =>
						setState((previous) => ({ ...previous, message })),
					{ continueOnConflict },
				);
				if (stateReference.current.stashRef) {
					await gitOps.popStash(stateReference.current.stashRef);
				}
				if (pushWithLease) {
					await gitOps.pushWithLease(currentBranch);
				}
				setState((previous) => ({
					...previous,
					status: "success",
					message: `Successfully rebased ${currentBranch} onto ${target}!`,
					currentBranch,
					targetBranch: target,
				}));
			} catch (error) {
				await handleError(error);
			}
		},
		[
			continueOnConflict,
			gitOps,
			handleError,
			dryRun,
			yes,
			autostash,
			pushWithLease,
		],
	);

	const startCherryPickRebase = useCallback(
		async (currentBranch: string, target: string) => {
			try {
				if (!yes && stateReference.current.status !== "confirm") {
					setState((previous) => ({
						...previous,
						status: "confirm",
						message: `Proceed to rebase ${currentBranch} onto ${target} (cherry-pick)? Press Enter to continue, Esc to cancel.`,
						currentBranch,
						targetBranch: target,
						pendingMode: "cherry",
					}));
					return;
				}

				setState((previous) => ({
					...previous,
					status: "loading",
					message: "Analyzing commits...",
					currentBranch,
					targetBranch: target,
				}));

				await gitOps.fetchAll();
				if (!(await gitOps.branchExists(target))) {
					throw new Error(`Target branch '${target}' does not exist`);
				}
				const mergeBase = await gitOps.getMergeBase(target, currentBranch);
				const commits = await gitOps.getCommitsToCherryPick(
					mergeBase,
					currentBranch,
				);

				if (dryRun) {
					setState((previous) => ({
						...previous,
						status: "success",
						message: `DRY-RUN: Would apply ${commits.length} commits from ${mergeBase.slice(0, 7)}..${currentBranch} onto ${target} (cherry-pick).`,
						currentBranch,
						targetBranch: target,
					}));
					return;
				}

				if (autostash) {
					const reference = await gitOps.startAutostash();
					setState((previous) => ({ ...previous, stashRef: reference }));
				}

				const temporaryBranchName = await gitOps.setupCherryPick(target);
				setState((previous) => ({
					...previous,
					status: "loading",
					message: `Found ${commits.length} commits to apply.`,
					tempBranchName: temporaryBranchName,
					commitsToPick: commits,
					currentCommitIndex: 0,
					currentBranch,
					targetBranch: target,
				}));
			} catch (error) {
				await handleError(error);
			}
		},
		[gitOps, handleError, dryRun, yes, autostash],
	);

	const applyNextCommit = useCallback(async () => {
		const {
			commitsToPick,
			currentCommitIndex,
			tempBranchName,
			currentBranch,
			targetBranch,
		} = stateReference.current;

		if (
			!commitsToPick ||
			currentCommitIndex === undefined ||
			!tempBranchName ||
			!currentBranch
		) {
			return;
		}

		if (currentCommitIndex >= commitsToPick.length) {
			try {
				setState((previous) => ({
					...previous,
					message: "Finishing rebase...",
				}));
				await gitOps.finishCherryPick(currentBranch, tempBranchName, {
					createBackup: !noBackup,
				});
				await gitOps.cleanupCherryPick(tempBranchName, currentBranch);
				if (stateReference.current.stashRef) {
					await gitOps.popStash(stateReference.current.stashRef);
				}
				if (pushWithLease) {
					await gitOps.pushWithLease(currentBranch);
				}
				setState((previous) => ({
					...previous,
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

		let subject = "";
		try {
			subject = await gitOps.getCommitSubject(commit);
		} catch {}
		setState((previous) => ({
			...previous,
			message: `Applying commit ${currentCommitIndex + 1}/${
				commitsToPick.length
			}: ${commit.slice(0, 7)}${subject ? ` ${subject}` : ""}`,
		}));

		try {
			await gitOps.cherryPick(commit, { allowEmpty });
			setState((previous) => ({
				...previous,
				currentCommitIndex: (previous.currentCommitIndex ?? -1) + 1,
			}));
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("empty")) {
				setState((previous) => ({
					...previous,
					message: `Commit ${commit.slice(
						0,
						7,
					)} is empty, skipping automatically.`,
					currentCommitIndex: (previous.currentCommitIndex ?? -1) + 1,
				}));
			} else if (errorMessage.includes("CONFLICT")) {
				switch (onConflict) {
					case "skip": {
						setState((previous) => ({
							...previous,
							message: `Conflict on commit ${commit.slice(
								0,
								7,
							)}, skipping as per config.`,
						}));
						await gitOps.skipCherryPick();
						setState((previous) => ({
							...previous,
							currentCommitIndex: (previous.currentCommitIndex ?? -1) + 1,
						}));

						break;
					}
					case "ours":
					case "theirs": {
						try {
							setState((previous) => ({
								...previous,
								message: `Conflict on commit ${commit.slice(
									0,
									7,
								)}, resolving with '${onConflict}' strategy.`,
							}));
							await gitOps.resolveConflictWithStrategy(onConflict);
							await gitOps.continueCherryPick();
							setState((previous) => ({
								...previous,
								currentCommitIndex: (previous.currentCommitIndex ?? -1) + 1,
							}));
						} catch (resolveError) {
							await gitOps.abortCherryPick();
							await handleError(
								new Error(
									`Failed to auto-resolve conflict with '${onConflict}': ${
										resolveError instanceof Error
											? resolveError.message
											: String(resolveError)
									}`,
								),
								tempBranchName,
							);
						}

						break;
					}
					case "pause": {
						setState((previous) => ({
							...previous,
							status: "paused_on_conflict",
							message: `Conflict on commit ${commit.slice(
								0,
								7,
							)}. Please resolve conflicts in another terminal, then press Enter to continue.`,
						}));

						break;
					}
					default: {
						await gitOps.abortCherryPick();
						await handleError(error, tempBranchName);
					}
				}
			} else {
				await gitOps.abortCherryPick();
				await handleError(error, tempBranchName);
			}
		}
	}, [gitOps, allowEmpty, onConflict, handleError, noBackup, pushWithLease]);

	const resumeCherryPick = useCallback(async () => {
		if (stateReference.current.status !== "paused_on_conflict") {
			return;
		}
		setState((previous) => ({
			...previous,
			status: "loading",
			message: "Attempting to continue cherry-pick...",
		}));
		try {
			await gitOps.continueCherryPick();
			setState((previous) => ({
				...previous,
				currentCommitIndex: (previous.currentCommitIndex ?? -1) + 1,
			}));
		} catch (error) {
			setState((previous) => ({
				...previous,
				status: "paused_on_conflict",
				message: `Failed to continue. Make sure conflicts are resolved and staged. Error: ${
					error instanceof Error ? error.message : String(error)
				}. Press Enter to retry.`,
			}));
		}
	}, [gitOps]);

	useEffect(() => {
		if (state.status === "success") {
			exit();
		}
		if (state.status === "error") {
			exit(new Error(state.message));
		}
	}, [state.status, state.message, exit]);

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
				const canProceed = isClean || autostash === true;
				if (!canProceed) {
					throw new Error(
						"Uncommitted changes detected. Please commit or stash your changes before running agrb.",
					);
				}
				const currentBranch = await gitOps.getCurrentBranch();
				setState((previous) => ({ ...previous, currentBranch }));

				if (initialTargetBranch) {
					const targetBranch = remoteTarget
						? `origin/${initialTargetBranch}`
						: initialTargetBranch;
					await (linear
						? performLinearRebase(currentBranch, targetBranch)
						: startCherryPickRebase(currentBranch, targetBranch));
				} else {
					const branches = remoteTarget
						? await gitOps.getAllBranches()
						: await gitOps.getLocalBranches();
					const filteredBranches = branches.filter(
						(branch) => branch !== currentBranch,
					);
					setState((previous) => ({
						...previous,
						status: "selecting",
						message: "Select target branch (type to filter):",
						availableBranches: filteredBranches,
					}));
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
		autostash,
	]);

	const handleBranchSelect = (branch: string) => {
		if (state.currentBranch) {
			if (linear) {
				performLinearRebase(state.currentBranch, branch);
			} else {
				startCherryPickRebase(state.currentBranch, branch);
			}
		}
	};

	useInput(
		async (_input, key) => {
			if (state.status === "paused_on_conflict" && key.return) {
				resumeCherryPick();
				return;
			}

			if (state.status === "confirm") {
				if (key.return) {
					const { pendingMode, currentBranch, targetBranch } = state;
					if (currentBranch && targetBranch) {
						if (pendingMode === "linear") {
							performLinearRebase(currentBranch, targetBranch);
							return;
						}
						if (pendingMode === "cherry") {
							startCherryPickRebase(currentBranch, targetBranch);
							return;
						}
					}
				}
				if (key.escape) {
					setState((previous) => ({
						...previous,
						status: "error",
						message: "Operation cancelled by user.",
					}));
					return;
				}
			}

			if (key.escape) {
				if (state.tempBranchName && state.currentBranch) {
					await gitOps.cleanupCherryPick(
						state.tempBranchName,
						state.currentBranch,
					);
				}
				exit();
				return;
			}
		},
		{ isActive: true },
	);

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
				{state.status === "selecting" && state.availableBranches && (
					<BranchSelector
						branches={state.availableBranches}
						onSelect={handleBranchSelect}
						labelPrefix={remoteTarget ? "origin/" : undefined}
					/>
				)}
				{state.status === "paused_on_conflict" && (
					<Text color="yellow">⏸ {sanitizedMessage}</Text>
				)}
				{state.status === "confirm" && (
					<Text color="yellow">❓ {sanitizedMessage}</Text>
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
