import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";

type Props = {
	branches: string[];
	onSelect: (branch: string) => void;
	labelPrefix?: string;
};

export const BranchSelector = ({ branches, onSelect, labelPrefix }: Props) => {
	const [searchTerm, setSearchTerm] = useState("");

	useInput(
		(input, key) => {
			if (key.escape) {
				// Let parent component handle exit
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
		branches.filter((branch) => {
			const displayLabel = `${labelPrefix ?? ""}${branch}`;
			const labelLower = displayLabel.toLowerCase();
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
			<SelectInput
				items={filteredBranches.map((branch) => ({
					label: `${labelPrefix ?? ""}${branch}`,
					value: branch,
				}))}
				onSelect={handleSelect}
			/>
		</Box>
	);
};
