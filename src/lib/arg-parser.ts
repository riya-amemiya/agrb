interface FlagConfig {
	type: "string" | "boolean";
	shortFlag?: string;
}

type FlagsSchema = { [key: string]: FlagConfig };

type Flags<T extends FlagsSchema> = {
	[K in keyof T]: T[K]["type"] extends "string"
		? string | undefined
		: boolean | undefined;
};

interface ParsedArgs<T extends FlagsSchema> {
	flags: Flags<T>;
	input: string[];
	help?: string;
	version?: string;
}

export class ArgParser<T extends FlagsSchema> {
	private readonly schema: T;
	private readonly helpMessage: string;
	private readonly version: string;
	private readonly aliases: { [key: string]: string } = {};
	private readonly longFlagMap: { [key: string]: keyof T } = {};

	constructor(config: {
		schema: T;
		helpMessage: string;
		version: string;
	}) {
		this.schema = config.schema;
		this.helpMessage = config.helpMessage;
		this.version = config.version;

		const camelToKebab = (str: string) =>
			str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

		for (const longFlag in this.schema) {
			if (Object.hasOwn(this.schema, longFlag)) {
				const flagConfig = this.schema[longFlag];
				const kebabCaseFlag = camelToKebab(longFlag);
				this.longFlagMap[`--${kebabCaseFlag}`] = longFlag;
				if (flagConfig?.shortFlag) {
					this.aliases[`-${flagConfig.shortFlag}`] = `--${kebabCaseFlag}`;
				}
			}
		}
	}

	public parse(args: readonly string[]): ParsedArgs<T> {
		const flags = {} as Flags<T>;
		const input: string[] = [];
		const remainingArgs = [...args];

		for (const longFlag in this.schema) {
			if (Object.hasOwn(this.schema, longFlag)) {
				flags[longFlag] = undefined as Flags<T>[keyof T];
			}
		}

		if (remainingArgs.includes("-h") || remainingArgs.includes("--help")) {
			return { flags: flags as Flags<T>, input, help: this.helpMessage };
		}

		if (remainingArgs.includes("-v") || remainingArgs.includes("--version")) {
			return { flags: flags as Flags<T>, input, version: this.version };
		}

		let parsingFlags = true;
		while (remainingArgs.length > 0) {
			const arg = remainingArgs.shift() as string;

			if (arg === "--") {
				parsingFlags = false;
				input.push(...remainingArgs);
				break;
			}

			if (parsingFlags) {
				let argName = arg;
				let argValue: string | undefined;
				if (arg.includes("=")) {
					const parts = arg.split("=");
					if (parts[0] !== undefined) {
						argName = parts[0];
					}
					argValue = parts[1];
				}

				const longFlagArg = this.aliases[argName] ?? argName;
				const longFlag = this.longFlagMap[longFlagArg];

				if (longFlag) {
					const flagConfig = this.schema[longFlag];
					if (flagConfig?.type === "boolean") {
						flags[longFlag] = true as Flags<T>[keyof T];
					} else if (flagConfig?.type === "string") {
						const value = argValue ?? remainingArgs.shift();
						if (value === undefined) {
							throw new Error(`Flag --${String(longFlag)} requires a value.`);
						}
						flags[longFlag] = value as Flags<T>[keyof T];
					}
				} else {
					if (argName.startsWith("-")) {
						throw new Error(`Unknown option: ${argName}`);
					}
					input.push(arg);
				}
			} else {
				input.push(arg);
			}
		}

		return { flags: flags as Flags<T>, input };
	}
}
