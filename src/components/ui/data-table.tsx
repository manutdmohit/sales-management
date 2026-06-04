"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { PaginationMeta, SortDir } from "@/lib/pagination";
import type { TablePageSizeOption } from "@/domain/table-settings";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTableSettings } from "@/lib/table-settings-context";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  /** When set (and `onSortChange` is provided), the header becomes sortable. */
  sortKey?: string;
  /** Title on auto-generated mobile cards. First match wins; else first column with a header. */
  mobilePrimary?: boolean;
  /** Footer actions on auto-generated mobile cards. Empty headers are treated as actions. */
  mobileActions?: boolean;
  /** Omit from compact mobile column sets (row cards still show every field). */
  hideOnMobile?: boolean;
};

type MobileLayout = "rows" | "table" | "cards";

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: ReactNode;
  meta?: PaginationMeta | null;
  page?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  sort?: string;
  dir?: SortDir;
  onSortChange?: (key: string, dir: SortDir) => void;
  /** Fully custom mobile card; when omitted, cards are built from column metadata. */
  renderMobileCard?: (row: T) => ReactNode;
  /** Mobile layout: row detail cards (default), scrollable table, or custom cards. */
  mobileLayout?: MobileLayout;
};

function hasHeader(header: ReactNode): boolean {
  if (header == null) return false;
  if (typeof header === "string") return header.trim().length > 0;
  return true;
}

function partitionColumns<T>(columns: DataTableColumn<T>[]) {
  const primary =
    columns.find((c) => c.mobilePrimary) ??
    columns.find((c) => hasHeader(c.header) && !c.mobileActions);
  const actions = columns.filter(
    (c) =>
      c.mobileActions ||
      (!hasHeader(c.header) && c !== primary) ||
      c.id === "actions" ||
      c.id === "add"
  );
  const details = columns.filter(
    (c) => c !== primary && !actions.includes(c) && hasHeader(c.header)
  );
  return { primary, details, actions };
}

function MobileRowCard<T>({
  row,
  columns,
}: {
  row: T;
  columns: DataTableColumn<T>[];
}) {
  const { primary, details, actions } = partitionColumns(columns);

  return (
    <article className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm ring-1 ring-foreground/[0.03]">
      {primary && (
        <div className="border-b border-border/40 bg-muted/20 px-4 py-3.5">
          <div className="text-base font-semibold leading-snug tracking-tight">
            {primary.cell(row)}
          </div>
        </div>
      )}
      {details.length > 0 && (
        <div className="overflow-x-auto px-4 py-1">
          <table className="w-full text-sm">
            <tbody>
              {details.map((col) => (
                <tr
                  key={col.id}
                  className="border-b border-border/30 last:border-0"
                >
                  <th
                    scope="row"
                    className="py-2.5 pr-3 text-left align-top text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {col.header}
                  </th>
                  <td
                    className={cn(
                      "py-2.5 text-right align-top font-medium [&_.font-mono]:text-[13px]",
                      col.className
                    )}
                  >
                    {col.cell(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/40 bg-muted/10 px-3 py-2.5">
          {actions.map((col) => (
            <div key={col.id} className="min-w-0 shrink-0">
              {col.cell(row)}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function TableSection<T>({
  columns,
  data,
  rowKey,
  loading,
  emptyMessage,
  colSpan,
  sort,
  dir,
  onSortChange,
  mobile = false,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading: boolean;
  emptyMessage: ReactNode;
  colSpan: number;
  sort?: string;
  dir?: SortDir;
  onSortChange?: (key: string, dir: SortDir) => void;
  mobile?: boolean;
}) {
  return (
    <div className={cn("overflow-x-auto", mobile && "-webkit-overflow-scrolling-touch")}>
      <Table className={mobile ? "min-w-max text-xs" : undefined}>
        <TableHeader>
          <TableRow>
            {columns.map((col) => {
              const sortable = Boolean(col.sortKey && onSortChange);
              const active = sortable && sort === col.sortKey;
              return (
                <TableHead
                  key={col.id}
                  className={cn(
                    col.headerClassName,
                    mobile && "whitespace-normal px-2 text-xs"
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSortChange!(
                          col.sortKey!,
                          active && dir === "asc" ? "desc" : "asc"
                        )
                      }
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 hover:text-foreground",
                        active ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {col.header}
                      {active ? (
                        dir === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="h-24 text-center text-muted-foreground"
              >
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!loading && data.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            data.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      col.className,
                      mobile &&
                        "min-w-[5.5rem] max-w-[12rem] whitespace-normal align-top px-2 text-xs"
                    )}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = "No records found.",
  meta,
  onPageChange,
  className,
  sort,
  dir,
  onSortChange,
  renderMobileCard,
  mobileLayout = "rows",
}: DataTableProps<T>) {
  const { pageSize, setPageSize } = useTableSettings();
  const colSpan = columns.length;
  const useCustomCards =
    mobileLayout === "cards" && Boolean(renderMobileCard);

  const mobileRowCards = (
    <div className="space-y-3 md:hidden">
      {loading && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      )}
      {!loading && data.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      )}
      {!loading &&
        data.map((row) => (
          <MobileRowCard key={rowKey(row)} row={row} columns={columns} />
        ))}
    </div>
  );

  const mobileCustomCards = (
    <div className="space-y-3 md:hidden">
      {loading && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      )}
      {!loading && data.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      )}
      {!loading &&
        data.map((row) => (
          <div key={rowKey(row)}>{renderMobileCard!(row)}</div>
        ))}
    </div>
  );

  const mobileTable = (
    <div className="md:hidden">
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm ring-1 ring-foreground/[0.03]">
        <TableSection
          columns={columns}
          data={data}
          rowKey={rowKey}
          loading={loading}
          emptyMessage={emptyMessage}
          colSpan={colSpan}
          sort={sort}
          dir={dir}
          onSortChange={onSortChange}
          mobile
        />
      </div>
    </div>
  );

  const mobileView =
    useCustomCards
      ? mobileCustomCards
      : mobileLayout === "table"
        ? mobileTable
        : mobileRowCards;

  return (
    <div
      className={cn(
        "overflow-hidden md:rounded-xl md:border md:border-border/60 md:bg-card md:card-elevated",
        className
      )}
    >
      {mobileView}
      <div className="hidden md:block">
        <TableSection
          columns={columns}
          data={data}
          rowKey={rowKey}
          loading={loading}
          emptyMessage={emptyMessage}
          colSpan={colSpan}
          sort={sort}
          dir={dir}
          onSortChange={onSortChange}
        />
      </div>
      {meta && onPageChange && meta.total > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm ring-1 ring-foreground/[0.03] md:mt-0 md:rounded-none md:border-0 md:bg-transparent md:shadow-none md:ring-0">
          <Pagination
          meta={meta}
          onPageChange={onPageChange}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            void setPageSize(size);
            onPageChange(1);
          }}
        />
        </div>
      )}
    </div>
  );
}
