import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { useCallback, useEffect, useState } from "react";
import { GitOperations } from "./git.js";
import { sanitizeString } from "./lib/sanitizeString.js";

type Props = {
	targetBranch?: string;
	allowEmpty?: boolean;
	linear?: boolean;
	continueOnConflict?: boolean;
	remoteTarget?: boolean;
};

type Status = "loading" | "success" | "error" | "selecting";

interface RebaseState {
	status: Status;
	message: string;
	currentBranch?: string;
	targetBranch?: string;
	availableBranches?: string[];
}

export default function App({
	targetBranch,
	allowEmpty,
	linear,
	continueOnConflict,
	remoteTarget,
}: Props) {
	const [state, setState] = useState<RebaseState>({
		status: "loading",
		message: "Initializing...",
		targetBranch,
	});
	const [searchTerm, setSearchTerm] = useState("");

	const performRebaseWithBranch = useCallback(
		async (currentBranch: string, target: string) => {
			try {
				const gitOps = new GitOperations();

				setState({
					status: "loading",
					message: `Rebasing ${currentBranch} onto ${target}`,
					currentBranch,
					targetBranch: target,
				});

				setState({
					status: "loading",
					message: "Starting rebase...",
					currentBranch,
					targetBranch: target,
				});
				await gitOps.performLocalRebase(
					currentBranch,
					target,
					(message: string) => {
						setState((prev) => ({
							...prev,
							message,
						}));
					},
					{ allowEmpty, linear, continueOnConflict },
				);

				setState({
					status: "success",
					message: `Successfully rebased ${currentBranch} onto ${target}!`,
					currentBranch,
					targetBranch: target,
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);

				setState({
					status: "error",
					message: `Failed to rebase: ${errorMessage}`,
					currentBranch,
					targetBranch: target,
				});
			}
		},
		[allowEmpty, linear, continueOnConflict],
	);

	useEffect(() => {
		async function performRebase() {
			try {
				setState({
					status: "loading",
					message: "Setting up Git operations...",
					targetBranch,
				});
				const gitOps = new GitOperations();

				setState({
					status: "loading",
					message: "Getting current branch...",
					targetBranch,
				});
				const currentBranch = await gitOps.getCurrentBranch();

				if (!targetBranch) {
					setState({
						status: "loading",
						message: "Getting available branches...",
						currentBranch,
					});
					const branches = remoteTarget
						? await gitOps.getAllBranches()
						: await gitOps.getLocalBranches();
					const filteredBranches = branches.filter(
						(branch) => branch !== currentBranch,
					);

					setState({
						status: "selecting",
						message: "Select target branch (type to filter):",
						currentBranch,
						availableBranches: filteredBranches,
					});
					return;
				}

				await performRebaseWithBranch(currentBranch, targetBranch);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);

				setState({
					status: "error",
					message: `Failed to setup: ${errorMessage}`,
					currentBranch: undefined,
					targetBranch,
				});
			}
		}

		performRebase();
	}, [targetBranch, performRebaseWithBranch, remoteTarget]);

	const handleBranchSelect = (item: { label: string; value: string }) => {
		if (state.currentBranch) {
			performRebaseWithBranch(state.currentBranch, item.value);
		}
	};

	useInput(
		(input, key) => {
			if (state.status !== "selecting") {
				return;
			}

			if (key.return || key.upArrow || key.downArrow) {
				return;
			}

			if (key.backspace || key.delete) {
				setSearchTerm((prev) => prev.slice(0, -1));
			} else if (key.escape) {
				setSearchTerm("");
			} else if (input && !key.ctrl && !key.meta) {
				setSearchTerm((prev) => prev + input);
			}
		},
		{ isActive: state.status === "selecting" },
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
						<Text color="yellow">
							<Spinner type="dots" />
						</Text>{" "}
						{sanitizedMessage}
					</Text>
				)}
				{state.status === "selecting" && state.availableBranches && (
					<>
						<Text>{sanitizedMessage}</Text>
						{searchTerm && (
							<Box marginBottom={1}>
								<Text color="gray">Filter: {searchTerm}</Text>
							</Box>
						)}
						<SelectInput
							items={filteredBranches.map((branch) => ({
								label: branch,
								value: branch,
							}))}
							onSelect={handleBranchSelect}
						/>
					</>
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
