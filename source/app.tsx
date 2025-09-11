import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useEffect, useState } from "react";
import { GitOperations } from "./git.js";

type Props = {
	targetBranch: string;
};

type Status = "loading" | "success" | "error";

interface RebaseState {
	status: Status;
	message: string;
	currentBranch?: string;
	targetBranch: string;
}

export default function App({ targetBranch }: Props) {
	const [state, setState] = useState<RebaseState>({
		status: "loading",
		message: "Initializing...",
		targetBranch,
	});

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

				setState({
					status: "loading",
					message: `Rebasing ${currentBranch} onto ${targetBranch}`,
					currentBranch,
					targetBranch,
				});

				setState({
					status: "loading",
					message: "Starting rebase...",
					targetBranch,
				});
				await gitOps.performLocalRebase(
					currentBranch,
					targetBranch,
					(message: string) => {
						setState((prev) => ({
							...prev,
							message,
						}));
					},
				);

				setState({
					status: "success",
					message: `Successfully rebased ${currentBranch} onto ${targetBranch}!`,
					currentBranch,
					targetBranch,
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);

				setState({
					status: "error",
					message: `Failed to rebase: ${errorMessage}`,
					targetBranch,
				});
			}
		}

		performRebase();
	}, [targetBranch]);

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
						{state.message}
					</Text>
				)}
				{state.status === "success" && (
					<Text color="green">✅ {state.message}</Text>
				)}
				{state.status === "error" && (
					<Text color="red">❌ {state.message}</Text>
				)}
			</Box>
		</Box>
	);
}
