import { BrowserWindow, Updater, Utils, defineElectrobunRPC } from "electrobun/bun";
import { type DataManagerRPCSchema } from "../shared/types";
import { mkdir } from "fs/promises";
import * as path from "path";
import * as os from "os";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

// App configuration paths
const CONFIG_DIR = path.join(os.homedir(), ".electrobun-datamanager");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DEFAULT_WORKSPACE_FILE = path.join(CONFIG_DIR, "workspace_data.json");

// Ensure configuration directory exists
await mkdir(CONFIG_DIR, { recursive: true });

interface AppConfig {
	lastOpenedWorkspacePath: string | null;
	theme?: "light" | "dark";
	window?: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

async function loadConfig(): Promise<AppConfig> {
	try {
		const file = Bun.file(CONFIG_FILE);
		if (await file.exists()) {
			return await file.json();
		}
	} catch (e) {
		console.error("Failed to load config", e);
	}
	return { lastOpenedWorkspacePath: null, theme: "dark" };
}

async function saveConfig(cfg: AppConfig): Promise<void> {
	try {
		await Bun.write(CONFIG_FILE, JSON.stringify(cfg, null, 2));
	} catch (e) {
		console.error("Failed to save config", e);
	}
}

// Setup typed RPC communication handler
// Cast to any to bypass a known bug in Electrobun's BaseRPCMessagesSchema type constraint
const rpc = defineElectrobunRPC<DataManagerRPCSchema>("bun", {
	handlers: {
		requests: {
			loadData: async () => {
				const config = await loadConfig();
				let targetPath = config.lastOpenedWorkspacePath;

				if (targetPath) {
					const file = Bun.file(targetPath);
					if (await file.exists()) {
						try {
							const data = await file.json();
							return { data, filePath: targetPath };
						} catch (e) {
							console.error(`Failed to parse file at ${targetPath}`, e);
						}
					}
				}

				// Fallback to default workspace
				const defaultFile = Bun.file(DEFAULT_WORKSPACE_FILE);
				if (await defaultFile.exists()) {
					try {
						const data = await defaultFile.json();
						return { data, filePath: DEFAULT_WORKSPACE_FILE };
					} catch (e) {
						console.error("Failed to parse default workspace file", e);
					}
				}

				return { data: null, filePath: null };
			},

			saveData: async (params: { data: any; filePath: string | null }) => {
				const { data, filePath } = params;
				const targetPath = filePath || DEFAULT_WORKSPACE_FILE;
				try {
					await Bun.write(targetPath, JSON.stringify(data, null, 2));
					
					// If this is saved as a specific file, remember it in config
					if (filePath) {
						const config = await loadConfig();
						config.lastOpenedWorkspacePath = filePath;
						await saveConfig(config);
					}
					return { success: true };
				} catch (e) {
					console.error(`Failed to write to file at ${targetPath}`, e);
					return { success: false };
				}
			},

			openFile: async () => {
				try {
					const paths = await Utils.openFileDialog({
						startingFolder: os.homedir(),
						allowedFileTypes: "json",
						canChooseFiles: true,
						canChooseDirectory: false,
						allowsMultipleSelection: false,
					});

					if (paths && paths.length > 0 && paths[0] && paths[0].trim() !== "") {
						const targetPath = paths[0];
						const file = Bun.file(targetPath);
						if (await file.exists()) {
							const data = await file.json();
							
							// Update config
							const config = await loadConfig();
							config.lastOpenedWorkspacePath = targetPath;
							await saveConfig(config);

							return { data, filePath: targetPath };
						}
					}
				} catch (e) {
					console.error("Failed to open file", e);
				}
				return null;
			},

			saveFileAs: async (params: { data: any; filename?: string }) => {
				const { data, filename = "workspace_data.json" } = params;
				try {
					// Use directory picker since Electrobun doesn't expose showSaveDialog directly
					const paths = await Utils.openFileDialog({
						startingFolder: os.homedir(),
						canChooseFiles: false,
						canChooseDirectory: true,
						allowsMultipleSelection: false,
					});

					if (paths && paths.length > 0 && paths[0] && paths[0].trim() !== "") {
						const folder = paths[0];
						const targetPath = path.join(folder, filename);
						
						await Bun.write(targetPath, JSON.stringify(data, null, 2));

						// Update config
						const config = await loadConfig();
						config.lastOpenedWorkspacePath = targetPath;
						await saveConfig(config);

						return { success: true, filePath: targetPath };
					}
				} catch (e) {
					console.error("Failed to save file as", e);
				}
				return null;
			},

			exportFile: async (params: { content: string; defaultName: string }) => {
				const { content, defaultName } = params;
				try {
					const paths = await Utils.openFileDialog({
						startingFolder: os.homedir(),
						canChooseFiles: false,
						canChooseDirectory: true,
						allowsMultipleSelection: false,
					});

					if (paths && paths.length > 0 && paths[0] && paths[0].trim() !== "") {
						const folder = paths[0];
						const targetPath = path.join(folder, defaultName);
						
						await Bun.write(targetPath, content);
						return { success: true };
					}
				} catch (e) {
					console.error("Failed to export file", e);
				}
				return { success: false };
			},

			copyToClipboard: async (params: { text: string }) => {
				const { text } = params;
				try {
					Utils.clipboardWriteText(text);
					return { success: true };
				} catch (e) {
					console.error("Failed to write to system clipboard", e);
					return { success: false };
				}
			},

			getTheme: async () => {
				const config = await loadConfig();
				return { theme: config.theme || "dark" };
			},

			setTheme: async (params: { theme: "light" | "dark" }) => {
				const config = await loadConfig();
				config.theme = params.theme;
				await saveConfig(config);
				return { success: true };
			},
		},
		messages: {
			logToBun: (params: { msg: string }) => {
				console.log(`[Webview Log]: ${params.msg}`);
			},
		},
	} as any,
});

// Create the main application window
const url = await getMainViewUrl();
const config = await loadConfig();

const initialFrame = config.window || {
	width: 1200,
	height: 800,
	x: 100,
	y: 100,
};

const mainWindow = new BrowserWindow({
	title: "Data Manager",
	url,
	frame: initialFrame,
	rpc,
});

let saveWindowTimeout: any = null;

function queueSaveWindowState() {
	if (saveWindowTimeout) {
		clearTimeout(saveWindowTimeout);
	}
	saveWindowTimeout = setTimeout(async () => {
		try {
			const frame = mainWindow.getFrame();
			const currentConfig = await loadConfig();
			currentConfig.window = {
				x: frame.x,
				y: frame.y,
				width: frame.width,
				height: frame.height,
			};
			await saveConfig(currentConfig);
		} catch (e) {
			console.error("Failed to save window state", e);
		}
	}, 500);
}

mainWindow.on("resize", () => {
	queueSaveWindowState();
});

mainWindow.on("move", () => {
	queueSaveWindowState();
});

console.log("Data Manager Electrobun app started!");
