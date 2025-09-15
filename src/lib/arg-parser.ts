interface FlagConfig {
	type: "string" | "boolean";
	shortFlag?: string;
}

type FlagsSchema = { [key: string]: FlagConfig };

type Flags<T extends FlagsSchema> = {
	[K in keyof T]: T[K]["type"] extends "string" ? string | undefined : boolean;
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

		for (const longFlag in this.schema) {
			if (Object.hasOwn(this.schema, longFlag)) {
				const flagConfig = this.schema[longFlag];
				this.longFlagMap[`--${longFlag}`] = longFlag;
				if (flagConfig?.shortFlag) {
					this.aliases[`-${flagConfig.shortFlag}`] = `--${longFlag}`;
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
				const flagConfig = this.schema[longFlag];
				if (flagConfig?.type === "boolean") {
					flags[longFlag] = false as Flags<T>[keyof T];
				}
			}
		}

		if (remainingArgs.includes("-h") || remainingArgs.includes("--help")) {
			return { flags: flags as Flags<T>, input, help: this.helpMessage };
		}

		if (remainingArgs.includes("-v") || remainingArgs.includes("--version")) {
			return { flags: flags as Flags<T>, input, version: this.version };
		}

		while (remainingArgs.length > 0) {
			const arg = remainingArgs.shift() as string;
			const longFlagArg = this.aliases[arg] ?? arg;
			const longFlag = this.longFlagMap[longFlagArg];

			if (longFlag) {
				const flagConfig = this.schema[longFlag];
				if (flagConfig?.type === "boolean") {
					flags[longFlag] = true as Flags<T>[keyof T];
				} else if (flagConfig?.type === "string") {
					flags[longFlag] = remainingArgs.shift() as Flags<T>[keyof T];
				}
			} else {
				input.push(arg);
			}
		}

		return { flags: flags as Flags<T>, input };
	}
}
