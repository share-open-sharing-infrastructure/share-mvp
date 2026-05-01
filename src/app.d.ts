// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			pb: import('pocketbase').default;
			user: import('pocketbase').Record | null;
		}
		// interface Error {}
		interface PageData {
			currentUser: import('pocketbase').Record | null;
			unreadNotificationCount?: number;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module "simple-datatables" {
  export { DataTable } from "simple-datatables/dist/dts/datatable";
  export { convertCSV, convertJSON } from "simple-datatables/dist/dts/convert";
  export { exportCSV, exportJSON, exportSQL, exportTXT } from "simple-datatables/dist/dts/export";
  export { createElement, isJson, isObject } from "simple-datatables/dist/dts/helpers";
  export { makeEditable } from "simple-datatables/dist/dts/editing";
  export { addColumnFilter } from "simple-datatables/dist/dts/column_filter";

  export type { DataTableOptions, DataTableConfiguration, ColumnOption, cellType, inputCellType, dataRowType, inputRowType, headerCellType, inputHeaderCellType, TableDataType, DataOption, renderType, nodeType, elementNodeType, textNodeType, cellDataType } from "simple-datatables/dist/dts/datatable";

  export interface SelectableDataRow {
    selected?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
}

export {};
