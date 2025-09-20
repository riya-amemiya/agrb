import { Box, Text, useApp, useInput } from "ink";
import SelectInput, { type ItemProps } from "ink-select-input";
import Spinner from "ink-spinner";
import { useEffect, useMemo, useState } from "react";
import { GitOperations } from "../git.js";
import {
	type AgreConfig,
	defaultConfig,
	getConfig,
	writeGlobalConfig,
} from "../lib/config.js";
import { isDeepEqual } from "../lib/isDeepEqual.js";
import { BranchSelector } from "./BranchSelector.js";

type ConfigItemKey = keyof AgreConfig;

type Status =
	| "loading"
	| "selecting"
	| "editing_boolean"
	| "editing_onConflict"
	| "editing_target"
	| "confirm_quit"
	| "saving"
	| "done";

const Item = ({ label, isSelected }: ItemProps) => (
	<Text color={isSelected ? "cyan" : undefined}>{label}</Text>
);

const BooleanItem = ({ label, isSelected }: ItemProps) => (
	<Text color={isSelected ? "cyan" : undefined}>
		{label === "true" ? (
			<Text color="green">true</Text>
		) : (
			<Text color="red">false</Text>
		)}
	</Text>
);

export const ConfigEditor = () => {
	const { exit } = useApp();
	const [config, setConfig] = useState<AgreConfig | null>(null);
	const [initialConfig, setInitialConfig] = useState<AgreConfig | null>(null);
	const [status, setStatus] = useState<Status>("loading");
	const [editingItem, setEditingItem] = useState<ConfigItemKey | null>(null);
	const [availableBranches, setAvailableBranches] = useState<string[]>([]);
	const gitOps = useMemo(() => new GitOperations(), []);
	const isDirty =
		config && initialConfig ? !isDeepEqual(config, initialConfig) : false;

	useEffect(() => {
		(async () => {
			const { config: loadedConfig } = await getConfig();
			const fullConfig = { ...defaultConfig, ...loadedConfig };
			setConfig(fullConfig);
			setInitialConfig(JSON.parse(JSON.stringify(fullConfig)));
			const branches = await gitOps.getLocalBranches();
			setAvailableBranches(branches);
			setStatus("selecting");
		})();
	}, [gitOps]);

	useInput(
		(input) => {
			if (input.toLowerCase() === "q") {
				if (isDirty) {
					setStatus("confirm_quit");
				} else {
					exit();
				}
				return;
			}
			if (input.toLowerCase() === "s") {
				handleSave();
			}
		},
		{ isActive: status === "selecting" },
	);

	const items = config
		? (Object.keys(defaultConfig) as (keyof typeof defaultConfig)[]).map(
				(key) => ({
					label: `${key}: ${String(
						config[key as keyof AgreConfig] ?? defaultConfig[key],
					)}`,
					value: key,
				}),
			)
		: [];

	const handleSelect = (item: { value: ConfigItemKey }) => {
		setEditingItem(item.value);
		const value = config?.[item.value];
		if (typeof value === "boolean") {
			setStatus("editing_boolean");
		} else if (item.value === "onConflict") {
			setStatus("editing_onConflict");
		} else if (item.value === "target") {
			setStatus("editing_target");
		}
	};

	const handleSave = async () => {
		if (config) {
			setStatus("saving");
			await writeGlobalConfig(config);
			setStatus("done");
			exit();
		}
	};

	const handleBooleanChange = (item: { value: boolean }) => {
		if (config && editingItem) {
			setConfig({ ...config, [editingItem]: item.value });
			setEditingItem(null);
			setStatus("selecting");
		}
	};

	const handleOnConflictChange = (item: { value: string }) => {
		if (config && editingItem) {
			setConfig({ ...config, [editingItem]: item.value });
			setEditingItem(null);
			setStatus("selecting");
		}
	};

	const handleTargetChange = (branch: string) => {
		if (config && editingItem) {
			setConfig({ ...config, [editingItem]: branch });
			setEditingItem(null);
			setStatus("selecting");
		}
	};

	const handleQuitConfirm = (item: { value: "yes" | "no" }) => {
		if (item.value === "yes") {
			exit();
		} else {
			setStatus("selecting");
		}
	};

	const renderEditor = () => {
		switch (status) {
			case "editing_boolean":
				return (
					<Box flexDirection="column">
						<Text>
							Set value for "<Text color="cyan">{editingItem}</Text>":
						</Text>
						<SelectInput
							items={[
								{ label: "true", value: true },
								{ label: "false", value: false },
							]}
							onSelect={handleBooleanChange}
							itemComponent={BooleanItem}
						/>
					</Box>
				);
			case "editing_onConflict":
				return (
					<Box flexDirection="column">
						<Text>
							Set value for "<Text color="cyan">onConflict</Text>":
						</Text>
						<SelectInput
							items={[
								{ label: "pause", value: "pause" },
								{ label: "skip", value: "skip" },
								{ label: "ours", value: "ours" },
								{ label: "theirs", value: "theirs" },
							]}
							onSelect={handleOnConflictChange}
							itemComponent={Item}
						/>
					</Box>
				);
			case "editing_target":
				return (
					<BranchSelector
						branches={availableBranches}
						onSelect={handleTargetChange}
					/>
				);
			case "confirm_quit":
				return (
					<Box flexDirection="column">
						<Text color="yellow">You have unsaved changes. Quit anyway?</Text>
						<SelectInput
							items={[
								{ label: "No", value: "no" },
								{ label: "Yes", value: "yes" },
							]}
							onSelect={handleQuitConfirm}
						/>
					</Box>
				);
			default:
				return null;
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>AGRB Configuration Editor</Text>
			{status === "loading" && (
				<Text>
					<Spinner /> Loading configuration...
				</Text>
			)}
			{status === "selecting" && config && (
				<>
					<Box marginTop={1}>
						<SelectInput
							items={items}
							onSelect={handleSelect}
							itemComponent={Item}
						/>
					</Box>
					<Box marginTop={1}>
						<Text>
							Select an item to edit. Press 'S' to save, 'Q' to quit.
							{isDirty && <Text color="yellow"> (unsaved changes)</Text>}
						</Text>
					</Box>
				</>
			)}
			{status !== "selecting" &&
				status !== "loading" &&
				status !== "saving" &&
				renderEditor()}
			{status === "saving" && <Text>💾 Saving configuration...</Text>}
		</Box>
	);
};
