import type { RPCSchema } from "electrobun/bun";

export type DataManagerRPCSchema = {
	bun: RPCSchema<{
		requests: {
			loadData: {
				params: void;
				response: { data: any; filePath: string | null };
			};
			saveData: {
				params: { data: any; filePath: string | null };
				response: { success: boolean };
			};
			openFile: {
				params: void;
				response: { data: any; filePath: string | null } | null;
			};
			saveFileAs: {
				params: { data: any; filename?: string };
				response: { success: boolean; filePath: string } | null;
			};
			exportFile: {
				params: { content: string; defaultName: string };
				response: { success: boolean };
			};
			copyToClipboard: {
				params: { text: string };
				response: { success: boolean };
			};
			getTheme: {
				params: void;
				response: { theme: "light" | "dark" };
			};
			setTheme: {
				params: { theme: "light" | "dark" };
				response: { success: boolean };
			};
		};
		messages: {
			logToBun: { msg: string };
		};
	}>;
	webview: RPCSchema<{
		requests: {};
		messages: {
			logToWebview: { msg: string };
		};
	}>;
};
