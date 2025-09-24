import { Box, Text, useApp, useInput } from "ink";
import SelectInput, { type ItemProps } from "ink-select-input";
import Spinner from "ink-spinner";
import { useEffect, useState } from "react";
import {
	type AgreConfig,
	configKeys,
	defaultConfig,
	getConfig,
	writeGlobalConfig,
} from "../lib/config.js";
import { isDeepEqual } from "../lib/isDeepEqual.js";

type ConfigItemKey = keyof AgreConfig;

type Status =
	| "loading"
	| "selecting"
	| "editing_boolean"
	| "editing_onConflict"
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
	const isDirty =
		config && initialConfig ? !isDeepEqual(config, initialConfig) : false;

	useEffect(() => {
		(async () => {
			const { config: loadedConfig } = await getConfig();
			const fullConfig = { ...defaultConfig, ...loadedConfig };
			setConfig(fullConfig);
			setInitialConfig(JSON.parse(JSON.stringify(fullConfig)));
			setStatus("selecting");
		})();
	}, []);

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
		? configKeys
				.filter((key) => key !== "schemaVersion")
				.map((key) => ({
					label: `${key}: ${String(
						config[key as keyof AgreConfig] ??
							(defaultConfig as AgreConfig)[key as keyof AgreConfig],
					)}`,
					value: key,
				}))
		: [];

	const handleSelect = (item: { value: ConfigItemKey }) => {
		setEditingItem(item.value);
		const value = config?.[item.value];
		if (typeof value === "boolean") {
			setStatus("editing_boolean");
		} else if (item.value === "onConflict") {
			setStatus("editing_onConflict");
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
