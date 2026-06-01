import React, { useState } from "react";
import {
	GripHorizontal,
	Trash2,
	AlignLeft,
	FileText,
	Hash,
	Calendar,
	Clock,
	Code,
	Plus
} from "lucide-react";

export type ColumnType = "text" | "textarea" | "number" | "date" | "time" | "datetime" | "code";

export interface Column {
	id: string;
	name: string;
	type: ColumnType;
}

export interface Row {
	id: string;
	[columnId: string]: string | number;
}

interface TableGridProps {
	columns: Column[];
	rows: Row[]; // Pre-filtered and pre-sorted rows
	totalRowsCount: number; // Count before filters
	selectedRows: Set<string>;
	onToggleRowSelection: (rowId: string, checked: boolean) => void;
	onSelectAllRows: (checked: boolean) => void;
	onCellChange: (rowId: string, colId: string, value: string) => void;
	onAddRow: () => void;
	onDeleteRow: (rowId: string) => void;
	onDeleteColumn: (colId: string) => void;
	onReorderColumns: (draggedColId: string, targetColId: string) => void;
}

export const getColIcon = (type: ColumnType) => {
	switch (type) {
		case "textarea":
			return <FileText className="w-3.5 h-3.5 text-apple-blue-light dark:text-apple-blue-dark" />;
		case "number":
			return <Hash className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
		case "date":
			return <Calendar className="w-3.5 h-3.5 text-rose-550 dark:text-rose-400" />;
		case "time":
			return <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />;
		case "datetime":
			return <Calendar className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />;
		case "code":
			return <Code className="w-3.5 h-3.5 text-[#5856D6] dark:text-[#5E5CE6]" />;
		default:
			return <AlignLeft className="w-3.5 h-3.5 text-apple-gray-light dark:text-apple-gray-dark" />;
	}
};

export const TableGrid: React.FC<TableGridProps> = ({
	columns,
	rows,
	totalRowsCount,
	selectedRows,
	onToggleRowSelection,
	onSelectAllRows,
	onCellChange,
	onAddRow,
	onDeleteRow,
	onDeleteColumn,
	onReorderColumns,
}) => {
	const [draggedColId, setDraggedColId] = useState<string | null>(null);

	const allSelected = rows.length > 0 && rows.every((r) => selectedRows.has(r.id));

	// Handle custom tab key insertion in textareas
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Tab") {
			e.preventDefault();
			const el = e.currentTarget;
			const start = el.selectionStart;
			const end = el.selectionEnd;
			const val = el.value;

			const newVal = val.substring(0, start) + "\t" + val.substring(end);
			el.value = newVal;

			// Restore selection range
			el.selectionStart = el.selectionEnd = start + 1;

			// Trigger change event manually
			const rowId = el.dataset.row!;
			const colId = el.dataset.col!;
			onCellChange(rowId, colId, newVal);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-white dark:bg-apple-bg-dark rounded-xl border border-apple-border-light dark:border-apple-border-dark relative transition-colors duration-250">
			<table className="w-full text-left border-collapse min-w-max">
				<thead className="sticky top-0 bg-apple-bg-light/95 dark:bg-apple-sidebar-dark/95 backdrop-blur z-20 table-header-glow">
					<tr className="border-b border-apple-border-light dark:border-apple-border-dark">
						<th className="w-14 px-3 py-3.5 text-center bg-apple-bg-light/95 dark:bg-apple-sidebar-dark/95 align-middle">
							<input
								type="checkbox"
								checked={allSelected}
								onChange={(e) => onSelectAllRows(e.target.checked)}
								className="cursor-pointer w-4 h-4 rounded bg-white dark:bg-black/35 border-apple-border-light dark:border-apple-border-dark text-apple-blue-light dark:text-apple-blue-dark focus:ring-apple-blue-light dark:focus:ring-apple-blue-dark focus:ring-offset-white dark:focus:ring-offset-apple-bg-dark"
								title="Select All"
							/>
						</th>
						{columns.map((col) => (
							<th
								key={col.id}
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData("text/plain", "");
									setDraggedColId(col.id);
								}}
								onDragEnd={() => setDraggedColId(null)}
								onDragOver={(e) => e.preventDefault()}
								onDrop={() => {
									if (draggedColId && draggedColId !== col.id) {
										onReorderColumns(draggedColId, col.id);
									}
								}}
								className={`px-4 py-3.5 border-r border-apple-border-light dark:border-apple-border-dark/50 font-semibold text-slate-700 dark:text-slate-200 text-xs group relative min-w-[180px] bg-apple-bg-light/95 dark:bg-apple-sidebar-dark/95 cursor-grab active:cursor-grabbing transition-opacity ${
									draggedColId === col.id ? "opacity-30 bg-apple-blue-light/10 dark:bg-apple-blue-dark/15" : ""
								}`}
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 select-none">
										<GripHorizontal className="w-3.5 h-3.5 text-apple-gray-light dark:text-apple-gray-dark opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
										{getColIcon(col.type)}
										<span className="truncate">{col.name}</span>
									</div>
									{columns.length > 1 && (
										<button
											onClick={() => onDeleteColumn(col.id)}
											className="opacity-0 group-hover:opacity-100 p-1 text-apple-gray-light dark:text-apple-gray-dark hover:text-rose-500 dark:hover:text-rose-400 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-all ml-1.5"
											title="Delete Column"
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									)}
								</div>
							</th>
						))}
					</tr>
				</thead>
				<tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
					{rows.length === 0 ? (
						<tr>
							<td
								colSpan={columns.length + 1}
								className="p-12 text-center text-apple-gray-light dark:text-apple-gray-dark font-medium text-xs"
							>
								{totalRowsCount === 0 ? (
									<div className="flex flex-col items-center gap-3">
										<span>Table is empty</span>
										<button
											onClick={onAddRow}
											className="px-3.5 py-1.5 bg-apple-blue-light dark:bg-apple-blue-dark hover:opacity-90 text-white rounded-md text-xs font-semibold transition-all shadow flex items-center gap-1.5"
										>
											<Plus className="w-4 h-4" /> Add your first row
										</button>
									</div>
								) : (
									"No rows match your filters"
								)}
							</td>
						</tr>
					) : (
						rows.map((row, index) => {
							const isRowSelected = selectedRows.has(row.id);
							return (
								<tr
									key={row.id}
									className={`hover:bg-apple-bg-light/40 dark:hover:bg-white/5 transition-colors group ${
										isRowSelected ? "bg-apple-blue-light/10 dark:bg-apple-blue-dark/15" : ""
									}`}
								>
									<td className="px-3 py-2 text-center align-top pt-3 border-r border-apple-border-light dark:border-apple-border-dark/50 bg-apple-bg-light/20 dark:bg-black/10">
										<div className="flex flex-col items-center gap-2.5">
											<input
												type="checkbox"
												checked={isRowSelected}
												onChange={(e) => onToggleRowSelection(row.id, e.target.checked)}
												className="cursor-pointer w-4 h-4 rounded bg-white dark:bg-black/35 border-apple-border-light dark:border-apple-border-dark text-apple-blue-light dark:text-apple-blue-dark focus:ring-apple-blue-light dark:focus:ring-apple-blue-dark focus:ring-offset-white dark:focus:ring-offset-apple-bg-dark"
											/>
											<div className="h-6 flex items-center justify-center">
												<span className="text-[10px] font-semibold text-apple-gray-light dark:text-apple-gray-dark group-hover:hidden transition-opacity">
													{index + 1}
												</span>
												<button
													onClick={() => onDeleteRow(row.id)}
													className="p-1 text-apple-gray-light dark:text-apple-gray-dark hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-955/20 rounded transition-all hidden group-hover:flex items-center justify-center"
													title="Delete Row"
												>
													<Trash2 className="w-3.5 h-3.5" />
												</button>
											</div>
										</div>
									</td>
									{columns.map((col) => {
										const val = String(row[col.id] ?? "");
										let inputElement;

										if (col.type === "code") {
											inputElement = (
												<textarea
													data-row={row.id}
													data-col={col.id}
													value={val}
													onChange={(e) => onCellChange(row.id, col.id, e.target.value)}
													onKeyDown={handleKeyDown}
													className="cell-input code-textarea w-full bg-slate-50 dark:bg-black/35 text-slate-850 dark:text-slate-100 p-2.5 rounded-lg border border-apple-border-light dark:border-apple-border-dark hover:border-apple-blue-light/50 dark:hover:border-apple-blue-dark/50 focus:border-apple-blue-light dark:focus:border-apple-blue-dark focus:ring-1 focus:ring-apple-blue-light dark:focus:ring-apple-blue-dark text-[11px] min-h-[90px] outline-none transition-all resize-y"
													placeholder="// Code here..."
												/>
											);
										} else if (col.type === "textarea") {
											inputElement = (
												<textarea
													data-row={row.id}
													data-col={col.id}
													value={val}
													onChange={(e) => onCellChange(row.id, col.id, e.target.value)}
													onKeyDown={handleKeyDown}
													className="cell-input w-full min-h-[90px] p-2.5 text-xs bg-apple-bg-light/50 dark:bg-black/20 hover:bg-apple-bg-light/80 dark:hover:bg-black/35 focus:bg-white dark:focus:bg-[#1E1E1E] border border-apple-border-light dark:border-apple-border-dark hover:border-apple-blue-light/50 dark:hover:border-apple-blue-dark/50 focus:border-apple-blue-light dark:focus:border-apple-blue-dark focus:ring-1 focus:ring-apple-blue-light dark:focus:ring-apple-blue-dark rounded-lg outline-none transition-all resize-y text-slate-800 dark:text-slate-200"
													placeholder="Write here... (Tab to indent)"
												/>
											);
										} else {
											let inputType = "text";
											if (col.type === "number") inputType = "number";
											else if (col.type === "date") inputType = "date";
											else if (col.type === "time") inputType = "time";
											else if (col.type === "datetime") inputType = "datetime-local";

											inputElement = (
												<input
													data-row={row.id}
													data-col={col.id}
													type={inputType}
													value={val}
													onChange={(e) => onCellChange(row.id, col.id, e.target.value)}
													className="cell-input w-full px-3 py-2 text-xs bg-transparent hover:bg-apple-bg-light/60 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-[#1E1E1E] border border-transparent hover:border-apple-border-light dark:hover:border-apple-border-dark focus:border-apple-blue-light dark:focus:border-apple-blue-dark rounded-lg outline-none transition-all text-slate-800 dark:text-slate-200 [color-scheme:dark]"
													placeholder="-"
												/>
											);
										}

										return (
											<td
												key={col.id}
												className="p-2 border-r border-apple-border-light dark:border-apple-border-dark/50 align-top bg-apple-bg-light/5 dark:bg-white/5"
											>
												{inputElement}
											</td>
										);
									})}
								</tr>
							);
						})
					)}
				</tbody>
			</table>
		</div>
	);
};
