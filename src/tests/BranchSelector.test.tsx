import { describe, expect, mock, test } from "bun:test";
import { render } from "ink-testing-library";
import { BranchSelector } from "../components/BranchSelector.js";

const branches = ["main", "develop", "feature/login", "feature/logout"];

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const setup = (labelPrefix?: string) => {
	const onSelect = mock((_branch: string) => {});
	const instance = render(
		<BranchSelector
			branches={branches}
			onSelect={onSelect}
			labelPrefix={labelPrefix}
		/>,
	);
	return { ...instance, onSelect };
};

describe("BranchSelector", () => {
	test("lists every branch", async () => {
		const { lastFrame, unmount } = setup();
		await tick();
		const frame = lastFrame() ?? "";

		expect(frame).toContain("Select target branch (type to filter):");
		for (const branch of branches) {
			expect(frame).toContain(branch);
		}
		unmount();
	});

	test("prefixes labels without changing the selected value", async () => {
		const { lastFrame, stdin, onSelect, unmount } = setup("origin/");
		await tick();

		expect(lastFrame()).toContain("origin/main");

		stdin.write("\r");
		await tick();

		expect(onSelect).toHaveBeenCalledWith("main");
		unmount();
	});

	test("selects the highlighted branch with arrow keys and Enter", async () => {
		const { stdin, onSelect, unmount } = setup();
		await tick();

		stdin.write("\u001B[B");
		await tick();
		stdin.write("\r");
		await tick();

		expect(onSelect).toHaveBeenCalledWith("develop");
		unmount();
	});

	test("filters by every whitespace-separated term, case-insensitively", async () => {
		const { lastFrame, stdin, onSelect, unmount } = setup();
		await tick();

		stdin.write("FEATURE out");
		await tick();
		const frame = lastFrame() ?? "";

		expect(frame).toContain("Filter: FEATURE out");
		expect(frame).toContain("feature/logout");
		expect(frame).not.toContain("feature/login");
		expect(frame).not.toContain("develop");

		stdin.write("\r");
		await tick();
		expect(onSelect).toHaveBeenCalledWith("feature/logout");
		unmount();
	});

	test("removes filter characters with backspace", async () => {
		const { lastFrame, stdin, unmount } = setup();
		await tick();

		stdin.write("dev");
		await tick();
		expect(lastFrame()).not.toContain("main");

		stdin.write("\u007F");
		stdin.write("\u007F");
		stdin.write("\u007F");
		await tick();
		expect(lastFrame()).toContain("main");
		expect(lastFrame()).not.toContain("Filter:");
		unmount();
	});

	test("does not call onSelect when nothing matches", async () => {
		const { stdin, onSelect, unmount } = setup();
		await tick();

		stdin.write("zzz");
		await tick();
		stdin.write("\r");
		await tick();

		expect(onSelect).not.toHaveBeenCalled();
		unmount();
	});
});
