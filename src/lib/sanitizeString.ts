export const sanitizeString = (str: string) => {
	return str.replace(/[^ -~\n\r\t]/g, "");
};
