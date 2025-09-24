/**
 * Options for isDeepEqual comparison
 */
export interface IsDeepEqualOptions {
	/**
	 * Whether to ignore array order when comparing arrays
	 * @default true
	 */
	strictOrder?: boolean;
}

/**
 * Performs a deep equality comparison between two values
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @param options - Comparison options
 * @returns true if values are deeply equal, false otherwise
 *
 * @example
 * ```typescript
 * isDeepEqual({ a: 1, b: [2, 3] }, { b: [2, 3], a: 1 }); // true
 * isDeepEqual([1, 2, 3], [3, 2, 1]); // false
 * isDeepEqual([1, 2, 3], [3, 2, 1], { strictOrder: false }); // true
 * isDeepEqual(new Set([1, 2]), new Set([2, 1])); // true
 * isDeepEqual(new Map([['a', 1]]), new Map([['a', 1]])); // true
 * ```
 */
export function isDeepEqual(
	a: unknown,
	b: unknown,
	options: IsDeepEqualOptions = {},
): boolean {
	const { strictOrder = true } = options;
	const visited = new WeakSet<object>();

	function compare(x: unknown, y: unknown): boolean {
		if (Object.is(x, y)) {
			return true;
		}

		if (x == null || y == null) {
			return false;
		}

		if (typeof x !== typeof y) {
			return false;
		}

		if (typeof x !== "object" || typeof y !== "object") {
			return false;
		}

		if (visited.has(x as object) || visited.has(y as object)) {
			return true;
		}
		visited.add(x as object);
		visited.add(y as object);

		const ctorX = (x as object).constructor;
		const ctorY = (y as object).constructor;
		if (ctorX !== ctorY) {
			return false;
		}

		if (x instanceof Date && y instanceof Date) {
			return x.getTime() === y.getTime();
		}

		if (x instanceof RegExp && y instanceof RegExp) {
			return x.toString() === y.toString();
		}

		if (Array.isArray(x) && Array.isArray(y)) {
			if (x.length !== y.length) {
				return false;
			}

			if (strictOrder) {
				for (const [index, element] of x.entries()) {
					if (!compare(element, y[index])) {
						return false;
					}
				}
			} else {
				const yCopy = [...y];
				for (const itemX of x) {
					let found = false;
					for (let index = 0; index < yCopy.length; index++) {
						if (compare(itemX, yCopy[index])) {
							yCopy.splice(index, 1);
							found = true;
							break;
						}
					}
					if (!found) {
						return false;
					}
				}
				return yCopy.length === 0;
			}
			return true;
		}

		if (x instanceof Set && y instanceof Set) {
			if (x.size !== y.size) {
				return false;
			}

			for (const item of x) {
				let found = false;
				for (const otherItem of y) {
					if (compare(item, otherItem)) {
						found = true;
						break;
					}
				}
				if (!found) {
					return false;
				}
			}
			return true;
		}

		if (x instanceof Map && y instanceof Map) {
			if (x.size !== y.size) {
				return false;
			}

			for (const [key, value] of x) {
				let found = false;
				for (const [otherKey, otherValue] of y) {
					if (compare(key, otherKey) && compare(value, otherValue)) {
						found = true;
						break;
					}
				}
				if (!found) {
					return false;
				}
			}
			return true;
		}

		if (ArrayBuffer.isView(x) && ArrayBuffer.isView(y)) {
			const xArray = x as Uint8Array;
			const yArray = y as Uint8Array;
			if (xArray.byteLength !== yArray.byteLength) {
				return false;
			}
			for (let index = 0; index < xArray.byteLength; index++) {
				if (xArray[index] !== yArray[index]) {
					return false;
				}
			}
			return true;
		}

		const keysX = Object.keys(x);
		const keysY = Object.keys(y);

		if (keysX.length !== keysY.length) {
			return false;
		}

		for (const key of keysX) {
			if (!(key in y)) {
				return false;
			}
		}

		for (const key of keysX) {
			if (
				!compare(
					(x as Record<string, unknown>)[key],
					(y as Record<string, unknown>)[key],
				)
			) {
				return false;
			}
		}

		return true;
	}

	return compare(a, b);
}
