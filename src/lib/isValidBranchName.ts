export function isValidBranchName(branchName: string): boolean {
	if (!branchName || branchName.length === 0) {
		return false;
	}

	if (!/^[a-zA-Z0-9-._/]+$/.test(branchName)) {
		return false;
	}

	if (branchName.includes("..")) {
		return false;
	}

	if (branchName.startsWith("/") || branchName.endsWith("/")) {
		return false;
	}

	if (branchName.includes("//")) {
		return false;
	}

	if (branchName.endsWith(".")) {
		return false;
	}

	const components = branchName.split("/");
	for (const component of components) {
		if (
			component.length > 0 &&
			(component.startsWith(".") || component.endsWith(".lock"))
		) {
			return false;
		}
	}

	return true;
}
