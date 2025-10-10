import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";

type Properties = {
	branches: string[];
	onSelect: (branch: string) => void;
	labelPrefix?: string;
};

export const BranchSelector = ({
	branches,
	onSelect,
	labelPrefix,
}: Properties) => {
	const [searchTerm, setSearchTerm] = useState("");

	useInput(
		(input, key) => {
			if (key.escape) {
				return;
			}
			if (key.return || key.upArrow || key.downArrow) {
				return;
			}
			if (key.backspace || key.delete) {
				setSearchTerm((previous) => previous.slice(0, -1));
			} else if (input && !key.ctrl && !key.meta) {
				setSearchTerm((previous) => previous + input);
			}
		},
		{ isActive: true },
	);

	const items = branches.map((branch) => ({
		label: `${labelPrefix ?? ""}${branch}`,
		value: branch,
	}));

	const filteredItems =
		items.filter(({ label }) => {
			const labelLower = label.toLowerCase();
			const searchTerms = searchTerm
				.toLowerCase()
				.split(/\s+/)
				.filter((term) => term.length > 0);
			if (searchTerms.length === 0) {
				return true;
			}
			return searchTerms.every((term) => labelLower.includes(term));
		}) || [];

	const handleSelect = (item: { label: string; value: string } | undefined) => {
		if (item) {
			onSelect(item.value);
		}
	};

	return (
		<Box flexDirection="column">
			<Text>Select target branch (type to filter):</Text>
			{searchTerm && <Text color="gray">Filter: {searchTerm}</Text>}
			<SelectInput items={filteredItems} onSelect={handleSelect} />
		</Box>
	);
};
