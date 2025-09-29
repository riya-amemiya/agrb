import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BranchSelector } from "./components/BranchSelector.js";
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
}: Props) {
	const { exit } = useApp();
	const [state, setState] = useState<RebaseState>({
		status: "loading",
		message: "Initializing...",
		targetBranch: initialTargetBranch,
	});
	const gitOps = useMemo(() => new GitOperations(), []);

	const stateRef = useRef(state);
	stateRef.current = state;

	const onConflict: OnConflictStrategy =
		onConflictRaw && isValidOnConflict(onConflictRaw) ? onConflictRaw : "pause";

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
				if (dryRun) {
					setState((prev) => ({
						...prev,
						status: "success",
						message: `DRY-RUN: Would rebase ${currentBranch} onto ${target} (linear${
							continueOnConflict ? ", -X ours" : ""
						}).`,
						currentBranch,
						targetBranch: target,
					}));
					return;
				}

				if (!yes && stateRef.current.status !== "confirm") {
					setState((prev) => ({
						...prev,
						status: "confirm",
						message: `Proceed to rebase ${currentBranch} onto ${target} (linear)? Press Enter to continue, Esc to cancel.`,
						currentBranch,
						targetBranch: target,
						pendingMode: "linear",
					}));
					return;
				}

				setState((prev) => ({
					...prev,
					status: "loading",
					message: `Rebasing ${currentBranch} onto ${target} (linear)`,
					currentBranch,
					targetBranch: target,
				}));

				if (autostash) {
					const ref = await gitOps.startAutostash();
					setState((prev) => ({ ...prev, stashRef: ref }));
				}

				await gitOps.performLinearRebase(
					currentBranch,
					target,
					(message: string) => setState((prev) => ({ ...prev, message })),
					{ continueOnConflict },
				);
				if (stateRef.current.stashRef) {
					await gitOps.popStash(stateRef.current.stashRef);
				}
				if (pushWithLease) {
					await gitOps.pushWithLease(currentBranch);
				}
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
				if (!yes && stateRef.current.status !== "confirm") {
					setState((prev) => ({
						...prev,
						status: "confirm",
						message: `Proceed to rebase ${currentBranch} onto ${target} (cherry-pick)? Press Enter to continue, Esc to cancel.`,
						currentBranch,
						targetBranch: target,
						pendingMode: "cherry",
					}));
					return;
				}

				setState((prev) => ({
					...prev,
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
					setState((prev) => ({
						...prev,
						status: "success",
						message: `DRY-RUN: Would apply ${commits.length} commits from ${mergeBase.slice(0, 7)}..${currentBranch} onto ${target} (cherry-pick).`,
						currentBranch,
						targetBranch: target,
					}));
					return;
				}

				if (autostash) {
					const ref = await gitOps.startAutostash();
					setState((prev) => ({ ...prev, stashRef: ref }));
				}

				const tempBranchName = await gitOps.setupCherryPick(target);
				setState((prev) => ({
					...prev,
					status: "loading",
					message: `Found ${commits.length} commits to apply.`,
					tempBranchName,
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
			try {
				setState((prev) => ({ ...prev, message: "Finishing rebase..." }));
				await gitOps.finishCherryPick(currentBranch, tempBranchName, {
					createBackup: !noBackup,
				});
				await gitOps.cleanupCherryPick(tempBranchName, currentBranch);
				if (stateRef.current.stashRef) {
					await gitOps.popStash(stateRef.current.stashRef);
				}
				if (pushWithLease) {
					await gitOps.pushWithLease(currentBranch);
				}
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

		let subject = "";
		try {
			subject = await gitOps.getCommitSubject(commit);
		} catch {}
		setState((prev) => ({
			...prev,
			message: `Applying commit ${currentCommitIndex + 1}/${
				commitsToPick.length
			}: ${commit.slice(0, 7)}${subject ? ` ${subject}` : ""}`,
		}));

		try {
			await gitOps.cherryPick(commit, { allowEmpty });
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
				} else if (onConflict === "ours" || onConflict === "theirs") {
					try {
						setState((prev) => ({
							...prev,
							message: `Conflict on commit ${commit.slice(
								0,
								7,
							)}, resolving with '${onConflict}' strategy.`,
						}));
						await gitOps.resolveConflictWithStrategy(onConflict);
						await gitOps.continueCherryPick();
						setState((prev) => ({
							...prev,
							currentCommitIndex: (prev.currentCommitIndex ?? -1) + 1,
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
					await gitOps.abortCherryPick();
					await handleError(error, tempBranchName);
				}
			} else {
				await gitOps.abortCherryPick();
				await handleError(error, tempBranchName);
			}
		}
	}, [gitOps, allowEmpty, onConflict, handleError, noBackup, pushWithLease]);

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
					setState((prev) => ({
						...prev,
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
