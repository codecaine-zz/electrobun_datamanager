import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
	Table2,
	Search,
	HelpCircle,
	Download,
	Plus,
	Edit3,
	X,
	Trash2,
	Settings,
	Filter,
	ArrowUpDown,
	Copy,
	Save,
	FilePlus2,
	FolderOpen,
	Check,
	Info,
	Sun,
	Moon
} from "lucide-react";
import { request } from "./rpc";
import {
	TableGrid,
	type Column,
	type Row,
	type ColumnType,
	getColIcon
} from "./components/TableGrid";

// Core Interfaces
interface Table {
	id: string;
	name: string;
	columns: Column[];
	rows: Row[];
}

interface FilterRule {
	id: string;
	columnId: string;
	operator:
		| "contains"
		| "equals"
		| "not_equals"
		| "starts_with"
		| "ends_with"
		| "greater_than"
		| "less_than"
		| "is_empty"
		| "is_not_empty";
	value: string;
}

interface SortRule {
	id: string;
	columnId: string;
	direction: "asc" | "desc";
}

// Helpers
const generateId = () => Math.random().toString(36).substring(2, 11);

const DEFAULT_DATA: Table[] = [
	{
		id: generateId(),
		name: "Tasks",
		columns: [
			{ id: "c1", name: "Task Name", type: "text" },
			{ id: "c2", name: "Description", type: "textarea" },
			{ id: "c3", name: "Code Snippet", type: "code" },
			{ id: "c4", name: "Priority", type: "number" },
		],
		rows: [
			{
				id: generateId(),
				c1: "Implement Electrobun IPC",
				c2: "Configure main process window and type-safe RPC communication.",
				c3: "mainWindow.defineRpc<DataManagerRPCSchema>(...);",
				c4: "5",
			},
			{
				id: generateId(),
				c1: "Design Premium UI",
				c2: "Create a glassmorphic sidebar and high-performance dark grid.",
				c3: "className=\"glass-panel rounded-xl shadow-xl\"",
				c4: "4",
			},
		],
	},
];

function App() {
	// Global Workspace States
	const [tables, setTables] = useState<Table[]>(DEFAULT_DATA);
	const [activeTableId, setActiveTableId] = useState<string | null>(null);
	const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
	const [darkMode, setDarkMode] = useState(true);

	const toggleDarkMode = () => {
		setDarkMode((prev) => {
			const next = !prev;
			request.setTheme({ theme: next ? "dark" : "light" }).catch(console.error);
			return next;
		});
	};
	
	// UI Search & Select
	const [tableSearchTerm, setTableSearchTerm] = useState("");
	const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
	const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

	// Filters & Sorts
	const [filters, setFilters] = useState<FilterRule[]>([]);
	const [showFilters, setShowFilters] = useState(false);
	const [sorts, setSorts] = useState<SortRule[]>([]);
	const [showSorts, setShowSorts] = useState(false);

	// Modals State
	const [modals, setModals] = useState({
		addTable: false,
		deleteTable: null as string | null,
		export: false,
		help: false,
		manageColumns: false,
		deleteColumns: null as string[] | null,
		deleteRows: false,
		saveAs: false,
	});

	// Temporary inputs
	const [newTableName, setNewTableName] = useState("");
	const [newColName, setNewColName] = useState("");
	const [newColType, setNewColType] = useState<ColumnType>("text");
	const [editingTableId, setEditingTableId] = useState<string | null>(null);
	const [editingTableName, setEditingTableName] = useState("");
	const [saveAsFilename, setSaveAsFilename] = useState("workspace_data.json");
	
	// Copy Feedback
	const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
	const [saveStatus, setSaveStatus] = useState<"Saved" | "Saving..." | "Error">("Saved");

	// Drag & Drop
	const [draggedTableId, setDraggedTableId] = useState<string | null>(null);

	// Load Initial Data and Theme
	useEffect(() => {
		const initLoad = async () => {
			try {
				const response = await request.loadData();
				if (response && response.data && Array.isArray(response.data.tables)) {
					setTables(response.data.tables);
					setActiveTableId(response.data.activeTableId || response.data.tables[0]?.id || null);
					setActiveFilePath(response.filePath);
				} else {
					setTables(DEFAULT_DATA);
					setActiveTableId(DEFAULT_DATA[0].id);
					setActiveFilePath(null);
				}

				// Load theme preference
				const themeRes = await request.getTheme();
				if (themeRes) {
					setDarkMode(themeRes.theme === "dark");
				}
			} catch (e) {
				console.error("Failed to load initial workspace data:", e);
			}
		};
		initLoad();
	}, []);

	// Toggle class `.dark` on body when `darkMode` changes
	useEffect(() => {
		if (darkMode) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}, [darkMode]);

	// Active Table Selection Helper
	const activeTable = useMemo(() => {
		return tables.find((t) => t.id === activeTableId) || tables[0] || null;
	}, [tables, activeTableId]);

	// Auto-saving Workspace
	const performSave = useCallback(
		async (currentTables: Table[], currentActiveId: string | null) => {
			setSaveStatus("Saving...");
			try {
				const payload = {
					tables: currentTables,
					activeTableId: currentActiveId,
				};
				const res = await request.saveData({ data: payload, filePath: activeFilePath });
				if (res && res.success) {
					setSaveStatus("Saved");
				} else {
					setSaveStatus("Error");
				}
			} catch (e) {
				console.error("Auto-save failed:", e);
				setSaveStatus("Error");
			}
		},
		[activeFilePath],
	);

	// Debounced Auto-save (triggers 800ms after structure/cell changes)
	useEffect(() => {
		if (!tables || tables.length === 0) return;
		const timer = setTimeout(() => {
			performSave(tables, activeTableId);
		}, 800);

		return () => clearTimeout(timer);
	}, [tables, activeTableId, performSave]);

	// Trigger immediate manual save
	const forceImmediateSave = (updatedTables: Table[], updatedActiveId: string | null) => {
		performSave(updatedTables, updatedActiveId);
	};

	// Filters visible tables list
	const filteredTablesList = useMemo(() => {
		return tables.filter(
			(t) =>
				t.id === activeTableId ||
				t.name.toLowerCase().includes(tableSearchTerm.toLowerCase()),
		);
	}, [tables, tableSearchTerm, activeTableId]);

	// Format table data for clipboard export
	const getFormattedData = (table: Table) => {
		return table.rows.map((row) => {
			const obj: Record<string, string | number> = {};
			table.columns.forEach((col) => {
				let val = row[col.id] ?? "";
				if (col.type === "number" && val !== "") {
					val = Number(val);
				}
				obj[col.name] = val;
			});
			return obj;
		});
	};

	// Advanced Filter & Sort Computation
	const processedRows = useMemo(() => {
		if (!activeTable) return [];
		let result = [...activeTable.rows];

		// 1. Filtering (AND Logic)
		if (filters.length > 0) {
			result = result.filter((row) => {
				return filters.every((filter) => {
					if (!filter.columnId || !filter.operator) return true;

					const cellValue = row[filter.columnId] ?? "";
					const filterValue = filter.value ?? "";
					const colDef = activeTable.columns.find((c) => c.id === filter.columnId);
					const isNum = colDef?.type === "number";

					const cellStr = String(cellValue).toLowerCase();
					const filterStr = String(filterValue).toLowerCase();
					const cellNum = Number(cellValue);
					const filterNum = Number(filterValue);

					switch (filter.operator) {
						case "contains":
							return cellStr.includes(filterStr);
						case "equals":
							return isNum ? cellNum === filterNum : cellStr === filterStr;
						case "not_equals":
							return isNum ? cellNum !== filterNum : cellStr !== filterStr;
						case "starts_with":
							return cellStr.startsWith(filterStr);
						case "ends_with":
							return cellStr.endsWith(filterStr);
						case "is_empty":
							return !cellValue.toString().trim();
						case "is_not_empty":
							return !!cellValue.toString().trim();
						case "greater_than":
							return isNum
								? !isNaN(cellNum) && cellNum > filterNum
								: cellStr > filterStr && cellStr !== "";
						case "less_than":
							return isNum
								? !isNaN(cellNum) && cellNum < filterNum
								: cellStr < filterStr && cellStr !== "";
						default:
							return true;
					}
				});
			});
		}

		// 2. Hierarchical Sorting
		if (sorts.length > 0) {
			result.sort((a, b) => {
				for (let sort of sorts) {
					if (!sort.columnId) continue;

					const valA = a[sort.columnId];
					const valB = b[sort.columnId];
					const colDef = activeTable.columns.find((c) => c.id === sort.columnId);

					if (valA === valB) continue;

					if (colDef?.type === "number") {
						const numA = Number(valA) || 0;
						const numB = Number(valB) || 0;
						if (numA !== numB) {
							return sort.direction === "asc" ? numA - numB : numB - numA;
						}
					} else {
						const strA = String(valA ?? "").toLowerCase();
						const strB = String(valB ?? "").toLowerCase();
						const comp = strA.localeCompare(strB);
						if (comp !== 0) {
							return sort.direction === "asc" ? comp : -comp;
						}
					}
				}
				return 0;
			});
		}

		return result;
	}, [activeTable, filters, sorts]);

	// Workspace File Operations
	const handleNewWorkspace = async () => {
		const confirm = window.confirm(
			"Are you sure you want to create a new workspace? This will clear the current unsaved tables.",
		);
		if (confirm) {
			setTables(DEFAULT_DATA);
			setActiveTableId(DEFAULT_DATA[0].id);
			setActiveFilePath(null);
			setFilters([]);
			setSorts([]);
			setSelectedRows(new Set());
			setSelectedColumns(new Set());
			forceImmediateSave(DEFAULT_DATA, DEFAULT_DATA[0].id);
		}
	};

	const handleOpenWorkspace = async () => {
		try {
			const res = await request.openFile();
			if (res && res.data && Array.isArray(res.data.tables)) {
				setTables(res.data.tables);
				setActiveTableId(res.data.activeTableId || res.data.tables[0]?.id || null);
				setActiveFilePath(res.filePath);
				setFilters([]);
				setSorts([]);
				setSelectedRows(new Set());
				setSelectedColumns(new Set());
			}
		} catch (e) {
			console.error("Open workspace error:", e);
		}
	};

	const handleSaveWorkspaceAs = async () => {
		setModals((prev) => ({ ...prev, saveAs: true }));
	};

	const executeSaveWorkspaceAs = async () => {
		setModals((prev) => ({ ...prev, saveAs: false }));
		try {
			const payload = {
				tables,
				activeTableId,
			};
			const res = await request.saveFileAs({ data: payload, filename: saveAsFilename });
			if (res && res.success) {
				setActiveFilePath(res.filePath);
				setSaveStatus("Saved");
			}
		} catch (e) {
			console.error("Save as error:", e);
		}
	};

	// Workspace Table Actions
	const handleAddTable = () => {
		if (newTableName.trim()) {
			const newTableId = generateId();
			const newT: Table = {
				id: newTableId,
				name: newTableName.trim(),
				columns: [{ id: generateId(), name: "Column 1", type: "text" }],
				rows: [],
			};
			const updated = [...tables, newT];
			setTables(updated);
			setActiveTableId(newTableId);
			setNewTableName("");
			setModals((prev) => ({ ...prev, addTable: false }));
			
			// Reset views
			setFilters([]);
			setSorts([]);
			setSelectedRows(new Set());
			setSelectedColumns(new Set());
			forceImmediateSave(updated, newTableId);
		}
	};

	const handleSaveTableName = () => {
		if (editingTableId && editingTableName.trim()) {
			const updated = tables.map((t) => {
				if (t.id === editingTableId) {
					return { ...t, name: editingTableName.trim() };
				}
				return t;
			});
			setTables(updated);
			setEditingTableId(null);
			forceImmediateSave(updated, activeTableId);
		}
	};

	const handleDeleteTable = () => {
		if (modals.deleteTable) {
			const updated = tables.filter((t) => t.id !== modals.deleteTable);
			let nextActiveId = activeTableId;
			if (activeTableId === modals.deleteTable) {
				nextActiveId = updated.length > 0 ? updated[0].id : null;
			}
			setTables(updated);
			setActiveTableId(nextActiveId);
			setModals((prev) => ({ ...prev, deleteTable: null }));
			
			setFilters([]);
			setSorts([]);
			setSelectedRows(new Set());
			setSelectedColumns(new Set());
			forceImmediateSave(updated, nextActiveId);
		}
	};

	// Column Actions
	const handleAddColumn = () => {
		if (newColName.trim() && activeTable) {
			const updated = tables.map((t) => {
				if (t.id === activeTable.id) {
					const cols = [...t.columns, { id: generateId(), name: newColName.trim(), type: newColType }];
					return { ...t, columns: cols };
				}
				return t;
			});
			setTables(updated);
			setNewColName("");
			setNewColType("text");
			forceImmediateSave(updated, activeTableId);
		}
	};

	const handleRenameColumn = (colId: string, name: string) => {
		if (activeTable) {
			const updated = tables.map((t) => {
				if (t.id === activeTable.id) {
					const cols = t.columns.map((c) => (c.id === colId ? { ...c, name } : c));
					return { ...t, columns: cols };
				}
				return t;
			});
			setTables(updated);
		}
	};

	const handleDeleteColumns = () => {
		const targetIds = modals.deleteColumns;
		if (targetIds && activeTable) {
			const updated = tables.map((t) => {
				if (t.id === activeTable.id) {
					const cols = t.columns.filter((c) => !targetIds.includes(c.id));
					const rows = t.rows.map((row) => {
						const r = { ...row };
						targetIds.forEach((id) => delete r[id]);
						return r;
					});
					return { ...t, columns: cols, rows };
				}
				return t;
			});
			setTables(updated);
			
			// Remove filters/sorts relating to deleted columns
			setFilters(filters.filter((f) => !targetIds.includes(f.columnId)));
			setSorts(sorts.filter((s) => !targetIds.includes(s.columnId)));
			setSelectedColumns(new Set());
			setModals((prev) => ({ ...prev, deleteColumns: null }));
			forceImmediateSave(updated, activeTableId);
		}
	};

	const handleReorderColumns = (draggedColId: string, targetColId: string) => {
		if (activeTable) {
			const updated = tables.map((t) => {
				if (t.id === activeTable.id) {
					const oldIdx = t.columns.findIndex((c) => c.id === draggedColId);
					const newIdx = t.columns.findIndex((c) => c.id === targetColId);
					const cols = [...t.columns];
					const [moved] = cols.splice(oldIdx, 1);
					cols.splice(newIdx, 0, moved);
					return { ...t, columns: cols };
				}
				return t;
			});
			setTables(updated);
			forceImmediateSave(updated, activeTableId);
		}
	};

	// Row Actions
	const handleAddRow = () => {
		if (activeTable) {
			const updated = tables.map((t) => {
				if (t.id === activeTable.id) {
					const newRow: Row = { id: generateId() };
					t.columns.forEach((c) => (newRow[c.id] = ""));
					return { ...t, rows: [...t.rows, newRow] };
				}
				return t;
			});
			setTables(updated);
			forceImmediateSave(updated, activeTableId);
		}
	};

	const handleCellChange = (rowId: string, colId: string, value: string) => {
		if (activeTable) {
			const updated = tables.map((t) => {
				if (t.id === activeTable.id) {
					const rows = t.rows.map((r) => (r.id === rowId ? { ...r, [colId]: value } : r));
					return { ...t, rows };
				}
				return t;
			});
			setTables(updated);
		}
	};

	const handleDeleteSelectedRows = () => {
		if (activeTable) {
			const updated = tables.map((t) => {
				if (t.id === activeTable.id) {
					const rows = t.rows.filter((r) => !selectedRows.has(r.id));
					return { ...t, rows };
				}
				return t;
			});
			setTables(updated);
			setSelectedRows(new Set());
			setModals((prev) => ({ ...prev, deleteRows: false }));
			forceImmediateSave(updated, activeTableId);
		}
	};

	const handleToggleRowSelection = (rowId: string, checked: boolean) => {
		setSelectedRows((prev) => {
			const next = new Set(prev);
			if (checked) next.add(rowId);
			else next.delete(rowId);
			return next;
		});
	};

	const handleSelectAllRows = (checked: boolean) => {
		if (checked) {
			setSelectedRows(new Set(processedRows.map((r) => r.id)));
		} else {
			setSelectedRows(new Set());
		}
	};

	// File Exports
	const handleExportSingleTable = async () => {
		if (activeTable) {
			const content = JSON.stringify(activeTable, null, 2);
			const defaultName = `${activeTable.name.toLowerCase().replace(/\s+/g, "_")}.json`;
			const res = await request.exportFile({ content, defaultName });
			if (res && res.success) {
				setModals((prev) => ({ ...prev, export: false }));
			}
		}
	};

	const handleExportAllTables = async () => {
		const content = JSON.stringify(tables, null, 2);
		const res = await request.exportFile({ content, defaultName: "workspace_data.json" });
		if (res && res.success) {
			setModals((prev) => ({ ...prev, export: false }));
		}
	};

	// System Clipboard Operations
	const triggerClipboardFeedback = (key: string) => {
		setCopyFeedback(key);
		setTimeout(() => setCopyFeedback(null), 2000);
	};

	const handleCopyCurrentTableJS = async () => {
		if (!activeTable) return;
		const data = getFormattedData(activeTable);
		const varName = activeTable.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
		const jsStr = `const ${varName || "table_data"} = ${JSON.stringify(data, null, 2)};`;
		const res = await request.copyToClipboard({ text: jsStr });
		if (res && res.success) triggerClipboardFeedback("single-js");
	};

	const handleCopyCurrentTablePy = async () => {
		if (!activeTable) return;
		const data = getFormattedData(activeTable);
		let pyStr = JSON.stringify(data, null, 4);
		pyStr = pyStr.replace(/: true/g, ": True").replace(/: false/g, ": False").replace(/: null/g, ": None");
		const pyVarName = activeTable.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
		const pyVar = `${pyVarName || "table_data"} = ${pyStr}`;
		const res = await request.copyToClipboard({ text: pyVar });
		if (res && res.success) triggerClipboardFeedback("single-py");
	};

	const handleCopyAllTablesJS = async () => {
		const allData: Record<string, any> = {};
		tables.forEach((t) => (allData[t.name] = getFormattedData(t)));
		const jsStr = `const workspace_data = ${JSON.stringify(allData, null, 2)};`;
		const res = await request.copyToClipboard({ text: jsStr });
		if (res && res.success) triggerClipboardFeedback("all-js");
	};

	const handleCopyAllTablesPy = async () => {
		const allData: Record<string, any> = {};
		tables.forEach((t) => (allData[t.name] = getFormattedData(t)));
		let pyStr = JSON.stringify(allData, null, 4);
		pyStr = pyStr.replace(/: true/g, ": True").replace(/: false/g, ": False").replace(/: null/g, ": None");
		const pyVar = `workspace_data = ${pyStr}`;
		const res = await request.copyToClipboard({ text: pyVar });
		if (res && res.success) triggerClipboardFeedback("all-py");
	};

	// Modal Overlay Render Wrapper
	const renderModal = (
		id: keyof typeof modals,
		title: string,
		content: React.ReactNode,
		maxWidth = "max-w-md",
	) => {
		if (!modals[id]) return null;
		return (
			<div
				className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-[12px] animate-fade-in"
				onClick={() => setModals((prev) => ({ ...prev, [id]: false }))}
			>
				<div
					className={`bg-white dark:bg-[#2D2D2D] border border-apple-border-light dark:border-apple-border-dark rounded-xl shadow-2xl w-full ${maxWidth} overflow-hidden flex flex-col`}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="px-5 py-3.5 border-b border-apple-border-light dark:border-apple-border-dark flex justify-between items-center bg-[#F6F6F6] dark:bg-[#262626]">
						<h3 className="font-semibold text-slate-900 dark:text-slate-100 text-[13px] select-none">{title}</h3>
						<button
							onClick={() => setModals((prev) => ({ ...prev, [id]: false }))}
							className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
					<div className="p-5 overflow-y-auto max-h-[70vh] text-xs text-slate-600 dark:text-slate-300">
						{content}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="flex-1 flex h-screen w-screen overflow-hidden bg-white dark:bg-[#1E1E1E] transition-colors duration-200">
			{/* Left macOS Vibrant Sidebar */}
			<aside className="w-64 glass-panel flex flex-col flex-shrink-0 transition-colors duration-200 z-10">
				{/* Sidebar Title & Mode Toggle */}
				<div className="p-4 border-b border-apple-border-light dark:border-apple-border-dark flex flex-col gap-1.5">
					<div className="flex items-center justify-between">
						<h1 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 select-none uppercase tracking-wider">
							<Table2 className="text-apple-blue-light dark:text-apple-blue-dark w-4 h-4" />
							Data Manager
						</h1>
						
						{/* Mode Toggle Button */}
						<button
							onClick={toggleDarkMode}
							className="p-1 hover:bg-slate-300/30 dark:hover:bg-slate-700/30 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded transition-all"
							title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
						>
							{darkMode ? (
								<Sun className="w-3.5 h-3.5 text-amber-500" />
							) : (
								<Moon className="w-3.5 h-3.5 text-apple-blue-light" />
							)}
						</button>
					</div>
					<div className="flex items-center justify-between text-[10px] text-apple-gray-light dark:text-apple-gray-dark font-semibold">
						<span className="truncate max-w-[130px]" title={activeFilePath || "Unsaved Local Auto-save"}>
							{activeFilePath ? activeFilePath.split("/").pop() : "Auto-save"}
						</span>
						<span
							className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold ${
								saveStatus === "Saved"
									? "text-emerald-600 dark:text-emerald-450 bg-emerald-100/60 dark:bg-emerald-950/20"
									: saveStatus === "Saving..."
									? "text-amber-600 dark:text-amber-455 bg-amber-100/60 dark:bg-amber-955/20"
									: "text-rose-600 dark:text-rose-450 bg-rose-100/60 dark:bg-rose-955/20"
							}`}
						>
							{saveStatus}
						</span>
					</div>
				</div>

				{/* Sidebar File Operations Section */}
				<div className="p-3 border-b border-apple-border-light dark:border-apple-border-dark flex flex-col gap-1.5">
					<div className="text-[9px] font-bold tracking-wider text-apple-gray-light dark:text-apple-gray-dark uppercase select-none px-1 mb-0.5">
						Workspace
					</div>
					<button
						onClick={handleNewWorkspace}
						className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-md text-xs font-medium border border-apple-border-light dark:border-transparent transition-all shadow-sm"
					>
						<FilePlus2 className="w-3.5 h-3.5 text-apple-blue-light dark:text-apple-blue-dark" />
						New Workspace
					</button>
					<button
						onClick={handleOpenWorkspace}
						className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-md text-xs font-medium border border-apple-border-light dark:border-transparent transition-all shadow-sm"
					>
						<FolderOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
						Open Workspace...
					</button>
					<button
						onClick={handleSaveWorkspaceAs}
						className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-md text-xs font-medium border border-apple-border-light dark:border-transparent transition-all shadow-sm"
					>
						<Save className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
						Save Workspace As...
					</button>
				</div>

				{/* Sidebar Tabs Section */}
				<div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-2">
					<div className="flex items-center justify-between px-2 mb-0.5">
						<span className="text-[9px] font-bold tracking-wider text-apple-gray-light dark:text-apple-gray-dark uppercase select-none">
							Tables ({tables.length})
						</span>
						<button
							onClick={() => setModals((prev) => ({ ...prev, addTable: true }))}
							className="p-0.5 hover:bg-slate-300/30 dark:hover:bg-slate-700/30 text-slate-500 hover:text-apple-blue-light dark:hover:text-apple-blue-dark rounded transition-all"
							title="New Table"
						>
							<Plus className="w-3 h-3" />
						</button>
					</div>

					{/* Search input in sidebar */}
					<div className="relative px-1 mb-1.5">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-3 h-3" />
						<input
							type="text"
							placeholder="Search sheets..."
							value={tableSearchTerm}
							onChange={(e) => setTableSearchTerm(e.target.value)}
							className="w-full pl-7 pr-6 py-1 bg-white/60 dark:bg-black/30 border border-apple-border-light dark:border-apple-border-dark focus:border-apple-blue-light dark:focus:border-apple-blue-dark outline-none rounded-[5px] text-[11px] text-slate-800 dark:text-slate-200 transition-all font-medium"
						/>
						{tableSearchTerm && (
							<button
								onClick={() => setTableSearchTerm("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-600 dark:text-slate-500"
							>
								<X className="w-2.5 h-2.5" />
							</button>
						)}
					</div>

					{/* Vertical Tabs */}
					<div className="flex flex-col gap-0.5 px-1">
						{filteredTablesList.map((table) => {
							const isActive = table.id === activeTableId;
							const isEditing = editingTableId === table.id;

							if (isEditing) {
								return (
									<div
										key={table.id}
										className="flex items-center px-2 py-1.5 bg-white dark:bg-[#323232] border border-apple-blue-light dark:border-apple-blue-dark rounded-md"
									>
										<input
											type="text"
											value={editingTableName}
											onChange={(e) => setEditingTableName(e.target.value)}
											onBlur={handleSaveTableName}
											onKeyDown={(e) => {
												if (e.key === "Enter") handleSaveTableName();
												if (e.key === "Escape") setEditingTableId(null);
											}}
											className="w-full bg-transparent outline-none text-xs text-slate-900 dark:text-slate-100 font-semibold px-0.5 py-0"
											autoFocus
										/>
									</div>
								);
							}

							return (
								<div
									key={table.id}
									draggable
									onDragStart={(e) => {
										e.dataTransfer.setData("text/plain", "");
										setDraggedTableId(table.id);
									}}
									onDragEnd={() => setDraggedTableId(null)}
									onDragOver={(e) => e.preventDefault()}
									onDrop={() => {
										if (draggedTableId && draggedTableId !== table.id) {
											const oldIdx = tables.findIndex((t) => t.id === draggedTableId);
											const newIdx = tables.findIndex((t) => t.id === table.id);
											const updated = [...tables];
											const [moved] = updated.splice(oldIdx, 1);
											updated.splice(newIdx, 0, moved);
											setTables(updated);
											forceImmediateSave(updated, activeTableId);
										}
									}}
									onClick={() => {
										setActiveTableId(table.id);
										setFilters([]);
										setSorts([]);
										setSelectedRows(new Set());
										setSelectedColumns(new Set());
									}}
									className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-all border border-transparent select-none text-xs ${
										isActive
											? "bg-apple-blue-light dark:bg-apple-blue-dark text-white font-semibold shadow-sm"
											: "text-slate-700 dark:text-slate-350 hover:bg-slate-300/30 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-slate-100"
									} ${draggedTableId === table.id ? "opacity-30" : ""}`}
								>
									<span className="truncate flex-1 pr-1.5">{table.name}</span>
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											onClick={(e) => {
												e.stopPropagation();
												setEditingTableId(table.id);
												setEditingTableName(table.name);
											}}
											className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
												isActive ? "text-white/80 hover:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-450"
											}`}
											title="Rename"
										>
											<Edit3 className="w-2.8 h-2.8" />
										</button>
										{tables.length > 1 && (
											<button
												onClick={(e) => {
													e.stopPropagation();
													setModals((prev) => ({ ...prev, deleteTable: table.id }));
												}}
												className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
													isActive ? "text-white/80 hover:text-white" : "text-slate-500 hover:text-rose-600 dark:text-slate-450"
												}`}
												title="Delete"
											>
												<X className="w-2.8 h-2.8" />
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Sidebar Footer */}
				<div className="p-3 border-t border-apple-border-light dark:border-apple-border-dark flex gap-2 bg-black/5 dark:bg-black/20">
					<button
						onClick={() => setModals((prev) => ({ ...prev, help: true }))}
						className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-205 rounded-md text-[11px] font-semibold border border-apple-border-light dark:border-transparent transition-all shadow-sm"
					>
						<HelpCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
						Help
					</button>
					<button
						onClick={() => setModals((prev) => ({ ...prev, export: true }))}
						className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-apple-blue-light dark:bg-apple-blue-dark text-white rounded-md text-[11px] font-semibold transition-all shadow-md"
					>
						<Download className="w-3.5 h-3.5 text-white/80" />
						Export
					</button>
				</div>
			</aside>

			{/* Main Editor View */}
			{activeTable ? (
				<main className="flex-1 flex flex-col h-full overflow-hidden p-5 gap-3.5">
					{/* Active Table Toolbar */}
					<div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#252526] border border-apple-border-light dark:border-apple-border-dark rounded-lg shadow-sm transition-colors duration-200">
						<div className="flex items-center gap-2.5">
							<h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider select-none pr-1">
								{activeTable.name}
							</h2>
							<div className="h-3 w-px bg-apple-border-light dark:bg-apple-border-dark" />
							<button
								onClick={handleAddRow}
								className="px-2.5 py-1 bg-apple-blue-light dark:bg-apple-blue-dark text-white hover:opacity-90 rounded-md text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
							>
								<Plus className="w-3 h-3" /> Add Row
							</button>
							{selectedRows.size > 0 && (
								<button
									onClick={() => setModals((prev) => ({ ...prev, deleteRows: true }))}
									className="px-2.5 py-1 bg-rose-600 hover:bg-rose-650 text-white rounded-md text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
								>
									<Trash2 className="w-3 h-3" /> Delete Selected ({selectedRows.size})
								</button>
							)}
							<button
								onClick={() => setModals((prev) => ({ ...prev, manageColumns: true }))}
								className="px-2.5 py-1 bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold border border-apple-border-light dark:border-apple-border-dark transition-all"
							>
								<Settings className="w-3 h-3 text-apple-gray-light dark:text-apple-gray-dark" /> Columns
							</button>
						</div>

						<div className="flex items-center gap-2">
							<button
								onClick={() => {
									if (!showFilters && filters.length === 0) {
										setFilters([{ id: generateId(), columnId: activeTable.columns[0]?.id || "", operator: "contains", value: "" }]);
									}
									setShowFilters(!showFilters);
								}}
								className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all border ${
									showFilters || filters.length > 0
										? "bg-apple-blue-light/10 dark:bg-apple-blue-dark/15 border-apple-blue-light/30 dark:border-apple-blue-dark/30 text-apple-blue-light dark:text-apple-blue-dark"
										: "bg-white dark:bg-white/10 border-apple-border-light dark:border-apple-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/15"
								}`}
							>
								<Filter className="w-3 h-3" /> Filters
								{filters.length > 0 && (
									<span className="ml-1 bg-apple-blue-light dark:bg-apple-blue-dark text-white text-[9px] py-0.5 px-1.5 rounded-full font-bold">
										{filters.length}
									</span>
								)}
							</button>
							<button
								onClick={() => {
									if (!showSorts && sorts.length === 0) {
										setSorts([{ id: generateId(), columnId: activeTable.columns[0]?.id || "", direction: "asc" }]);
									}
									setShowSorts(!showSorts);
								}}
								className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all border ${
									showSorts || sorts.length > 0
										? "bg-[#5856D6]/10 dark:bg-[#5E5CE6]/15 border-[#5856D6]/30 dark:border-[#5E5CE6]/30 text-[#5856D6] dark:text-[#5E5CE6]"
										: "bg-white dark:bg-white/10 border-apple-border-light dark:border-apple-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/15"
								}`}
							>
								<ArrowUpDown className="w-3 h-3" /> Sort
								{sorts.length > 0 && (
									<span className="ml-1 bg-[#5856D6] dark:bg-[#5E5CE6] text-white text-[9px] py-0.5 px-1.5 rounded-full font-bold">
										{sorts.length}
									</span>
								)}
							</button>
						</div>
					</div>

					{/* Filters Configuration Panel */}
					{showFilters && (
						<div className="p-3 bg-slate-100/50 dark:bg-[#252526] border border-apple-border-light dark:border-apple-border-dark rounded-lg flex flex-col gap-2.5 shadow-sm animate-fade-in">
							<div className="flex justify-between items-center select-none border-b border-apple-border-light dark:border-apple-border-dark pb-1.5">
								<h4 className="text-[10px] font-bold text-apple-blue-light dark:text-apple-blue-dark flex items-center gap-1 uppercase tracking-wide">
									<Filter className="w-3 h-3" /> Advanced Filters
								</h4>
								<button
									onClick={() =>
										setFilters((prev) => [
											...prev,
											{ id: generateId(), columnId: activeTable.columns[0]?.id || "", operator: "contains", value: "" },
										])
									}
									className="text-[10px] font-bold text-apple-blue-light dark:text-apple-blue-dark hover:opacity-80 flex items-center gap-0.5"
								>
									<Plus className="w-2.5 h-2.5" /> Add Condition
								</button>
							</div>
							<div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
								{filters.length === 0 ? (
									<div className="text-[10px] text-slate-400 italic py-1">No active filter rules.</div>
								) : (
									filters.map((f, i) => (
										<div key={f.id} className="flex flex-wrap items-center gap-2 bg-white dark:bg-[#1E1E1E] p-1.5 rounded border border-apple-border-light dark:border-apple-border-dark">
											<span className="text-[9px] font-extrabold text-apple-gray-light dark:text-apple-gray-dark w-10 uppercase select-none">
												{i === 0 ? "Where" : "And"}
											</span>
											<select
												value={f.columnId}
												onChange={(e) => {
													const next = filters.map((item) => (item.id === f.id ? { ...item, columnId: e.target.value } : item));
													setFilters(next);
												}}
												className="px-2 py-0.5 text-xs bg-white dark:bg-[#1E1E1E] border border-apple-border-light dark:border-apple-border-dark rounded focus:border-apple-blue-light outline-none text-slate-800 dark:text-slate-200 font-semibold"
											>
												{activeTable.columns.map((c) => (
													<option key={c.id} value={c.id}>
														{c.name}
													</option>
												))}
											</select>
											<select
												value={f.operator}
												onChange={(e) => {
													const next = filters.map((item) =>
														item.id === f.id ? { ...item, operator: e.target.value as any } : item,
													);
													setFilters(next);
												}}
												className="px-2 py-0.5 text-xs bg-white dark:bg-[#1E1E1E] border border-apple-border-light dark:border-apple-border-dark rounded focus:border-apple-blue-light outline-none text-slate-700 dark:text-slate-350 font-semibold"
											>
												<option value="contains">Contains</option>
												<option value="equals">Equals</option>
												<option value="not_equals">Not equals</option>
												<option value="starts_with">Starts with</option>
												<option value="ends_with">Ends with</option>
												<option value="greater_than">Greater than</option>
												<option value="less_than">Less than</option>
												<option value="is_empty">Is empty</option>
												<option value="is_not_empty">Is not empty</option>
											</select>
											{!["is_empty", "is_not_empty"].includes(f.operator) && (
												<input
													type="text"
													value={f.value}
													onChange={(e) => {
														const next = filters.map((item) => (item.id === f.id ? { ...item, value: e.target.value } : item));
														setFilters(next);
													}}
													placeholder="Value..."
													className="flex-1 min-w-[120px] px-2 py-0.5 text-xs bg-white dark:bg-[#1E1E1E] border border-apple-border-light dark:border-apple-border-dark focus:border-apple-blue-light rounded outline-none text-slate-800 dark:text-slate-200 font-medium"
												/>
											)}
											<button
												onClick={() => setFilters(filters.filter((item) => item.id !== f.id))}
												className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 text-apple-gray-light dark:text-apple-gray-dark hover:text-rose-500 rounded"
											>
												<Trash2 className="w-3 h-3" />
											</button>
										</div>
									))
								)}
							</div>
						</div>
					)}

					{/* Sorting Rules Panel */}
					{showSorts && (
						<div className="p-3 bg-slate-100/50 dark:bg-[#252526] border border-apple-border-light dark:border-apple-border-dark rounded-lg flex flex-col gap-2.5 shadow-sm animate-fade-in">
							<div className="flex justify-between items-center select-none border-b border-apple-border-light dark:border-apple-border-dark pb-1.5">
								<h4 className="text-[10px] font-bold text-[#5856D6] dark:text-[#5E5CE6] flex items-center gap-1 uppercase tracking-wide">
									<ArrowUpDown className="w-3 h-3" /> Sorting Rules
								</h4>
								<button
									onClick={() =>
										setSorts((prev) => [
											...prev,
											{ id: generateId(), columnId: activeTable.columns[0]?.id || "", direction: "asc" },
										])
									}
									className="text-[10px] font-bold text-[#5856D6] dark:text-[#5E5CE6] hover:opacity-85 flex items-center gap-0.5"
								>
									<Plus className="w-2.5 h-2.5" /> Add Sort Rule
								</button>
							</div>
							<div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
								{sorts.length === 0 ? (
									<div className="text-[10px] text-slate-400 italic py-1">No active sorting rules.</div>
								) : (
									sorts.map((s, i) => (
										<div key={s.id} className="flex flex-wrap items-center gap-2 bg-white dark:bg-[#1E1E1E] p-1.5 rounded border border-apple-border-light dark:border-apple-border-dark">
											<span className="text-[9px] font-extrabold text-apple-gray-light dark:text-apple-gray-dark w-14 uppercase select-none">
												{i === 0 ? "Sort by" : "Then by"}
											</span>
											<select
												value={s.columnId}
												onChange={(e) => {
													const next = sorts.map((item) => (item.id === s.id ? { ...item, columnId: e.target.value } : item));
													setSorts(next);
												}}
												className="px-2 py-0.5 text-xs bg-white dark:bg-[#1E1E1E] border border-apple-border-light dark:border-apple-border-dark rounded focus:border-apple-blue-light outline-none text-slate-800 dark:text-slate-200 font-semibold"
											>
												{activeTable.columns.map((c) => (
													<option key={c.id} value={c.id}>
														{c.name}
													</option>
												))}
											</select>
											<select
												value={s.direction}
												onChange={(e) => {
													const next = sorts.map((item) =>
														item.id === s.id ? { ...item, direction: e.target.value as any } : item,
													);
													setSorts(next);
												}}
												className="px-2 py-0.5 text-xs bg-white dark:bg-[#1E1E1E] border border-apple-border-light dark:border-apple-border-dark rounded focus:border-apple-blue-light outline-none text-slate-700 dark:text-slate-350 font-semibold"
											>
												<option value="asc">Ascending (A-Z, 0-9)</option>
												<option value="desc">Descending (Z-A, 9-0)</option>
											</select>
											<button
												onClick={() => setSorts(sorts.filter((item) => item.id !== s.id))}
												className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 text-apple-gray-light dark:text-apple-gray-dark hover:text-rose-500 rounded"
											>
												<Trash2 className="w-3 h-3" />
											</button>
										</div>
									))
								)}
							</div>
						</div>
					)}

					{/* Main Table Grid Viewport */}
					<TableGrid
						columns={activeTable.columns}
						rows={processedRows}
						totalRowsCount={activeTable.rows.length}
						selectedRows={selectedRows}
						onToggleRowSelection={handleToggleRowSelection}
						onSelectAllRows={handleSelectAllRows}
						onCellChange={handleCellChange}
						onAddRow={handleAddRow}
						onDeleteRow={(rowId) => setModals((prev) => ({ ...prev, deleteRows: true, selectedRows: new Set([rowId]) }))}
						onDeleteColumn={(colId) => setModals((prev) => ({ ...prev, deleteColumns: [colId] }))}
						onReorderColumns={handleReorderColumns}
					/>

					{/* Status Bar */}
					<div className="flex items-center justify-between text-[11px] text-apple-gray-light dark:text-apple-gray-dark px-1 select-none font-semibold">
						<div className="flex items-center gap-3.5">
							<span>Rows: {processedRows.length} shown ({activeTable.rows.length} total)</span>
							<span>Columns: {activeTable.columns.length}</span>
						</div>
						<div className="truncate max-w-lg" title={activeFilePath || "Default Workspace File"}>
							{activeFilePath ? `Path: ${activeFilePath}` : "Autosave file active"}
						</div>
					</div>
				</main>
			) : (
				<div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#1E1E1E] p-5 transition-colors duration-200">
					<div className="text-center flex flex-col items-center max-w-xs gap-3">
						<Table2 className="w-10 h-10 text-slate-300 dark:text-slate-700 animate-pulse" />
						<div className="flex flex-col gap-1">
							<h3 className="font-bold text-slate-800 dark:text-slate-205 text-xs uppercase tracking-wider">No Tables</h3>
							<p className="text-[11px] text-apple-gray-light dark:text-apple-gray-dark font-medium">
								Your workspace currently does not contain any tables. Create a new table to start tracking your data.
							</p>
						</div>
						<button
							onClick={() => setModals((prev) => ({ ...prev, addTable: true }))}
							className="px-3.5 py-1.5 bg-apple-blue-light dark:bg-apple-blue-dark text-white hover:opacity-90 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
						>
							<Plus className="w-3.5 h-3.5" /> Create Table
						</button>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* MODALS RENDERING */}
			{/* ========================================================================= */}

			{/* Create Table Modal */}
			{renderModal(
				"addTable",
				"Create New Table",
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<label className="text-[10px] font-bold text-slate-455 dark:text-slate-400 uppercase tracking-wider select-none">Table Name</label>
						<input
							type="text"
							value={newTableName}
							onChange={(e) => setNewTableName(e.target.value)}
							placeholder="e.g. Clients"
							className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1E1E1E] border border-apple-border-light dark:border-apple-border-dark focus:border-apple-blue-light rounded outline-none text-slate-900 dark:text-slate-100 font-medium text-xs"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleAddTable();
							}}
							autoFocus
						/>
					</div>
					<button
						onClick={handleAddTable}
						className="w-full py-2 bg-apple-blue-light dark:bg-apple-blue-dark text-white rounded-md text-xs font-bold transition-all shadow"
					>
						Create
					</button>
				</div>,
			)}

			{/* Delete Table Modal */}
			{renderModal(
				"deleteTable",
				"Delete Table",
				<div className="flex flex-col gap-4">
					<p className="text-slate-600 dark:text-slate-350 text-[11px] leading-relaxed">
						Are you sure you want to permanently delete this table? All data, records, and columns associated with it will be destroyed. This operation cannot be undone.
					</p>
					<div className="flex justify-end gap-2.5 pt-1.5">
						<button
							onClick={() => setModals((prev) => ({ ...prev, deleteTable: null }))}
							className="px-3 py-1.5 bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/15 text-slate-705 dark:text-slate-200 border border-apple-border-light dark:border-apple-border-dark rounded-md font-semibold transition-all text-xs"
						>
							Cancel
						</button>
						<button
							onClick={handleDeleteTable}
							className="px-3 py-1.5 bg-rose-600 hover:bg-rose-650 text-white rounded-md font-semibold transition-all shadow-sm text-xs"
						>
							Delete Table
						</button>
					</div>
				</div>,
			)}

			{/* Delete Rows Confirm */}
			{renderModal(
				"deleteRows",
				"Delete Rows",
				<div className="flex flex-col gap-4">
					<p className="text-slate-650 dark:text-slate-350 text-[11px] leading-relaxed">
						Are you sure you want to delete the selected row(s)? Selected data will be permanently wiped out. This operation is immediate and cannot be undone.
					</p>
					<div className="flex justify-end gap-2.5 pt-1.5">
						<button
							onClick={() => setModals((prev) => ({ ...prev, deleteRows: false }))}
							className="px-3 py-1.5 bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/15 text-slate-705 dark:text-slate-200 border border-apple-border-light dark:border-apple-border-dark rounded-md font-semibold transition-all text-xs"
						>
							Cancel
						</button>
						<button
							onClick={handleDeleteSelectedRows}
							className="px-3 py-1.5 bg-rose-600 hover:bg-rose-655 text-white rounded-md font-semibold transition-all shadow-sm text-xs"
						>
							Delete
						</button>
					</div>
				</div>,
			)}

			{/* Delete Columns Confirm */}
			{renderModal(
				"deleteColumns",
				"Delete Column",
				<div className="flex flex-col gap-4">
					<p className="text-slate-650 dark:text-slate-350 text-[11px] leading-relaxed">
						Are you sure you want to delete this column?
					</p>
					<p className="text-[10px] text-rose-605 dark:text-rose-400 font-semibold bg-rose-100/30 dark:bg-rose-955/15 p-2 rounded border border-rose-500/10">
						Warning: All cells in the entire table matching this column will have their data deleted permanently.
					</p>
					<div className="flex justify-end gap-2.5 pt-1.5">
						<button
							onClick={() => setModals((prev) => ({ ...prev, deleteColumns: null }))}
							className="px-3 py-1.5 bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/15 text-slate-705 dark:text-slate-200 border border-apple-border-light dark:border-apple-border-dark rounded-md font-semibold transition-all text-xs"
						>
							Cancel
						</button>
						<button
							onClick={handleDeleteColumns}
							className="px-3 py-1.5 bg-rose-600 hover:bg-rose-650 text-white rounded-md font-semibold transition-all shadow-sm text-xs"
						>
							Delete Column
						</button>
					</div>
				</div>,
			)}

			{/* Save Workspace As Filename Modal */}
			{renderModal(
				"saveAs",
				"Save Workspace As",
				<div className="flex flex-col gap-3.5">
					<div className="flex flex-col gap-1.5">
						<label className="text-[10px] font-bold text-slate-455 dark:text-slate-400 uppercase tracking-wider select-none">Filename</label>
						<input
							type="text"
							value={saveAsFilename}
							onChange={(e) => setSaveAsFilename(e.target.value)}
							placeholder="e.g. database_backup.json"
							className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1E1E1E] border border-apple-border-light dark:border-apple-border-dark focus:border-apple-blue-light rounded outline-none text-slate-900 dark:text-slate-100 font-medium text-xs"
							onKeyDown={(e) => {
								if (e.key === "Enter") executeSaveWorkspaceAs();
							}}
							autoFocus
						/>
					</div>
					<div className="text-[10px] text-apple-gray-light dark:text-apple-gray-dark bg-[#F6F6F6] dark:bg-[#1E1E1E] p-2 rounded border border-apple-border-light dark:border-apple-border-dark flex gap-2 font-medium">
						<Info className="w-3.5 h-3.5 text-apple-blue-light dark:text-apple-blue-dark flex-shrink-0" />
						<span>You will be prompted to choose the folder directory to save this file in next.</span>
					</div>
					<button
						onClick={executeSaveWorkspaceAs}
						className="w-full py-2 bg-apple-blue-light dark:bg-apple-blue-dark text-white rounded-md text-xs font-bold transition-all shadow-sm"
					>
						Choose Folder...
					</button>
				</div>,
			)}

			{/* Help Information Modal */}
			{renderModal(
				"help",
				"Data Manager - Help Guide",
				<div className="space-y-4 text-slate-650 dark:text-slate-350 leading-relaxed text-[11px] font-medium">
					<div>
						<h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs mb-1 flex items-center gap-1.5 uppercase tracking-wide">
							<span className="w-1.5 h-1.5 rounded-full bg-apple-blue-light dark:bg-apple-blue-dark" />
							Workspace & Tables
						</h4>
						<ul className="list-disc pl-5 space-y-0.5 text-slate-500 dark:text-slate-450">
							<li><strong>Offline Mode:</strong> Runs completely offline. Native style, icons, and fonts are compiled locally.</li>
							<li><strong>Auto-save:</strong> Workspace files are stored natively. Saves occur automatically.</li>
							<li><strong>Reordering Tabs:</strong> Arrange vertical table tabs inside the sidebar by dragging and dropping them.</li>
						</ul>
					</div>

					<div>
						<h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs mb-1 flex items-center gap-1.5 uppercase tracking-wide">
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500" />
							Columns & Data types
						</h4>
						<ul className="list-disc pl-5 space-y-0.5 text-slate-500 dark:text-slate-455">
							<li><strong>Data Types:</strong> Text, Long Text, Number, Date, Time, Date & Time, and Code.</li>
							<li><strong>Reorder Columns:</strong> Grab any column header cell and drag it horizontally to rearrange the column order.</li>
							<li><strong>Rename Columns:</strong> Edit column names instantly inside the column config modal.</li>
						</ul>
					</div>

					<div>
						<h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs mb-1 flex items-center gap-1.5 uppercase tracking-wide">
							<span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-500" />
							Cell Editing & Keyboard
						</h4>
						<ul className="list-disc pl-5 space-y-0.5 text-slate-500 dark:text-slate-455">
							<li><strong>Keyboard Indentation:</strong> Pressing <code>Tab</code> in code fields or textareas inserts a literal tab character (<code>\t</code>) instead of shifting focus to the next cell.</li>
							<li><strong>Type Checks:</strong> Input validation updates state automatically as you type.</li>
						</ul>
					</div>

					<div>
						<h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs mb-1 flex items-center gap-1.5 uppercase tracking-wide">
							<span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
							Querying Panels
						</h4>
						<ul className="list-disc pl-5 space-y-0.5 text-slate-500 dark:text-slate-455">
							<li><strong>Filters:</strong> Build multi-clause AND filters on any column.</li>
							<li><strong>Sorting:</strong> Chain multiple nested sort conditions (e.g. sort by Status, then by Priority).</li>
						</ul>
					</div>
				</div>,
				"max-w-md",
			)}

			{/* Export and Clipboard Modal */}
			{renderModal(
				"export",
				"Export Workspace Data",
				<div className="space-y-4 text-xs font-semibold">
					<div className="flex flex-col gap-2.5">
						<h4 className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wide select-none">Save to disk</h4>
						<div className="grid grid-cols-2 gap-2.5">
							<button
								onClick={handleExportSingleTable}
								className="flex flex-col items-center justify-center p-3 bg-[#F6F6F6] dark:bg-[#262626] hover:bg-[#ECECEC] dark:hover:bg-white/10 border border-apple-border-light dark:border-apple-border-dark rounded-lg transition-all gap-1.5 group text-center"
							>
								<Download className="w-4.5 h-4.5 text-apple-gray-light dark:text-apple-gray-dark group-hover:text-apple-blue-light dark:group-hover:text-apple-blue-dark transition-colors" />
								<div>
									<span className="block font-semibold text-xs text-slate-800 dark:text-slate-200">Current Table</span>
									<span className="text-[9px] text-apple-gray-light dark:text-apple-gray-dark">Save active sheet as JSON</span>
								</div>
							</button>
							<button
								onClick={handleExportAllTables}
								className="flex flex-col items-center justify-center p-3 bg-[#F6F6F6] dark:bg-[#262626] hover:bg-[#ECECEC] dark:hover:bg-white/10 border border-apple-border-light dark:border-apple-border-dark rounded-lg transition-all gap-1.5 group text-center"
							>
								<Download className="w-4.5 h-4.5 text-apple-gray-light dark:text-apple-gray-dark group-hover:text-apple-blue-light dark:group-hover:text-apple-blue-dark transition-colors" />
								<div>
									<span className="block font-semibold text-xs text-slate-800 dark:text-slate-200">Full Workspace</span>
									<span className="text-[9px] text-apple-gray-light dark:text-apple-gray-dark">Save all tables as JSON</span>
								</div>
							</button>
						</div>
					</div>

					<div className="border-t border-apple-border-light dark:border-apple-border-dark pt-3.5 flex flex-col gap-2.5">
						<h4 className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wide select-none">Copy to clipboard</h4>
						
						<div className="flex flex-col gap-2">
							{/* Current Table Copies */}
							<div className="flex flex-col gap-1">
								<span className="text-[9px] text-slate-500 select-none">Active Sheet</span>
								<div className="flex gap-2">
									<button
										onClick={handleCopyCurrentTableJS}
										className="flex-1 flex items-center justify-between px-2.5 py-1.5 bg-[#F6F6F6] dark:bg-white/5 hover:bg-[#ECECEC] dark:hover:bg-white/10 border border-apple-border-light dark:border-apple-border-dark rounded transition-all text-xs font-semibold text-slate-700 dark:text-slate-200"
									>
										<span>JS Object Array</span>
										{copyFeedback === "single-js" ? (
											<Check className="w-3 h-3 text-emerald-600 dark:text-emerald-450 animate-bounce" />
										) : (
											<Copy className="w-3 h-3 text-apple-gray-light dark:text-apple-gray-dark" />
										)}
									</button>
									<button
										onClick={handleCopyCurrentTablePy}
										className="flex-1 flex items-center justify-between px-2.5 py-1.5 bg-[#F6F6F6] dark:bg-white/5 hover:bg-[#ECECEC] dark:hover:bg-white/10 border border-apple-border-light dark:border-apple-border-dark rounded transition-all text-xs font-semibold text-slate-700 dark:text-slate-200"
									>
										<span>Python List Dict</span>
										{copyFeedback === "single-py" ? (
											<Check className="w-3 h-3 text-emerald-600 dark:text-emerald-450 animate-bounce" />
										) : (
											<Copy className="w-3 h-3 text-apple-gray-light dark:text-apple-gray-dark" />
										)}
									</button>
								</div>
							</div>

							{/* All Tables Copies */}
							<div className="flex flex-col gap-1 mt-1">
								<span className="text-[9px] text-apple-gray-light dark:text-apple-gray-dark select-none">Entire Workspace</span>
								<div className="flex gap-2">
									<button
										onClick={handleCopyAllTablesJS}
										className="flex-1 flex items-center justify-between px-2.5 py-1.5 bg-[#F6F6F6] dark:bg-white/5 hover:bg-[#ECECEC] dark:hover:bg-white/10 border border-apple-border-light dark:border-apple-border-dark rounded transition-all text-xs font-semibold text-slate-700 dark:text-slate-200"
									>
										<span>JS Workspace Map</span>
										{copyFeedback === "all-js" ? (
											<Check className="w-3 h-3 text-emerald-600 dark:text-emerald-450 animate-bounce" />
										) : (
											<Copy className="w-3 h-3 text-apple-gray-light dark:text-apple-gray-dark" />
										)}
									</button>
									<button
										onClick={handleCopyAllTablesPy}
										className="flex-1 flex items-center justify-between px-2.5 py-1.5 bg-[#F6F6F6] dark:bg-white/5 hover:bg-[#ECECEC] dark:hover:bg-white/10 border border-apple-border-light dark:border-apple-border-dark rounded transition-all text-xs font-semibold text-slate-700 dark:text-slate-200"
									>
										<span>Python Workspace Map</span>
										{copyFeedback === "all-py" ? (
											<Check className="w-3 h-3 text-emerald-600 dark:text-emerald-455 animate-bounce" />
										) : (
											<Copy className="w-3 h-3 text-slate-400 dark:text-slate-550" />
										)}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>,
				"max-w-sm",
			)}

			{/* Column Configuration Modal */}
			{activeTable && renderModal(
				"manageColumns",
				"Column Manager",
				<div className="space-y-5">
					<div>
						<div className="flex justify-between items-center mb-2 select-none">
							<label className="text-[9px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
								Columns ({activeTable.columns.length})
							</label>
							{selectedColumns.size > 0 && (
								<button
									onClick={() => {
										if (activeTable.columns.length - selectedColumns.size >= 1) {
											setModals((prev) => ({
												...prev,
												manageColumns: false,
												deleteColumns: Array.from(selectedColumns),
											}));
										} else {
											alert("You must leave at least one column in the table.");
										}
									}}
									className={`text-[9px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1 ${
										activeTable.columns.length - selectedColumns.size >= 1
											? "text-rose-600 bg-rose-100/60 dark:bg-rose-955/25 hover:bg-rose-100"
											: "text-apple-gray-light bg-apple-bg-light dark:bg-white/5 cursor-not-allowed border border-apple-border-light dark:border-transparent"
									}`}
								>
									<Trash2 className="w-2.8 h-2.8" /> Delete Selected ({selectedColumns.size})
								</button>
							)}
						</div>
						<div className="max-h-48 overflow-y-auto p-2 border border-apple-border-light dark:border-apple-border-dark rounded-md bg-[#F6F6F6] dark:bg-black/15 flex flex-col gap-1">
							{activeTable.columns.map((col) => (
								<div
									key={col.id}
									className="flex items-center gap-2.5 p-1.5 hover:bg-white dark:hover:bg-[#1E1E1E] border border-transparent hover:border-apple-border-light dark:hover:border-apple-border-dark rounded-md transition-colors group"
								>
									<input
										type="checkbox"
										checked={selectedColumns.has(col.id)}
										onChange={(e) => {
											setSelectedColumns((prev) => {
												const next = new Set(prev);
												if (e.target.checked) next.add(col.id);
												else next.delete(col.id);
												return next;
											});
										}}
										className="cursor-pointer w-3.5 h-3.5 rounded bg-white dark:bg-black/35 border-apple-border-light dark:border-apple-border-dark text-apple-blue-light dark:text-apple-blue-dark focus:ring-apple-blue-light"
									/>
									<div className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 flex-1 font-semibold">
										{getColIcon(col.type)}
										<input
											type="text"
											value={col.name}
											onChange={(e) => handleRenameColumn(col.id, e.target.value)}
											className="flex-1 bg-transparent border-b border-transparent hover:border-apple-border-light dark:hover:border-apple-border-dark focus:border-apple-blue-light outline-none px-1 py-0.5 transition-colors text-xs font-semibold"
											placeholder="Column Name"
										/>
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="border-t border-apple-border-light dark:border-apple-border-dark pt-4">
						<h4 className="text-[9px] font-bold text-apple-gray-light dark:text-apple-gray-dark uppercase tracking-wider mb-2.5 select-none">
							Add New Column
						</h4>
						<div className="space-y-3.5">
							<div className="flex flex-col gap-1.5">
								<label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Column Name</label>
								<input
									type="text"
									value={newColName}
									onChange={(e) => setNewColName(e.target.value)}
									placeholder="e.g. Total"
									className="w-full px-2.5 py-1.5 bg-white dark:bg-black/35 border border-apple-border-light dark:border-apple-border-dark focus:border-apple-blue-light rounded outline-none text-slate-900 dark:text-slate-100 text-xs font-semibold"
									onKeyDown={(e) => {
										if (e.key === "Enter") handleAddColumn();
									}}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label className="text-[10px] font-semibold text-apple-gray-light dark:text-apple-gray-dark select-none">Data Type</label>
								<div className="grid grid-cols-3 gap-1.5">
									{[
										["text", "Text"],
										["textarea", "Long Text"],
										["number", "Number"],
										["date", "Date"],
										["time", "Time"],
										["datetime", "Date & Time"],
										["code", "Code"],
									].map(([type, label]) => {
										const isSelected = newColType === type;
										return (
											<button
												key={type}
												onClick={() => setNewColType(type as ColumnType)}
												className={`flex items-center gap-1 justify-center py-1.5 px-0.5 rounded border transition-all text-[10px] font-semibold ${
													isSelected
														? "border-apple-blue-light dark:border-apple-blue-dark bg-apple-blue-light/10 text-apple-blue-light dark:text-apple-blue-dark shadow-sm"
														: "border-apple-border-light dark:border-apple-border-dark bg-[#F6F6F6] dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-[#ECECEC] dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-205"
												}`}
											>
												{getColIcon(type as ColumnType)}
												<span>{label}</span>
											</button>
										);
									})}
								</div>
							</div>
							<button
								onClick={handleAddColumn}
								disabled={!newColName.trim()}
								className={`w-full py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-sm ${
									newColName.trim()
										? "bg-apple-blue-light dark:bg-apple-blue-dark text-white cursor-pointer"
										: "bg-apple-bg-light dark:bg-white/5 text-apple-gray-light dark:text-apple-gray-dark cursor-not-allowed border border-apple-border-light dark:border-transparent"
								}`}
							>
								<Plus className="w-3.5 h-3.5" /> Add Column
							</button>
						</div>
					</div>
				</div>,
				"max-w-sm",
			)}
		</div>
	);
}

export default App;
