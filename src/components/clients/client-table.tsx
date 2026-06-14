"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Clock3,
  MoreHorizontal,
  SlidersHorizontal,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
} from "lucide-react";
import {
  deleteClient,
  exportClientsCsv,
  toggleClientStatus,
  type ClientListItem,
  type ClientStatusFilter,
} from "@/actions/client.actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClientImportDialog } from "./client-import-dialog";
import { ClientDeleteDialog } from "./client-delete-dialog";
import { ClientTableToolbar } from "./client-table-toolbar";
import { getDisplayClientEmail } from "@/lib/client-contact";

interface ClientTableProps {
  clients: ClientListItem[];
  page: number;
  pages: number;
  query: string;
  status: ClientStatusFilter;
  filters: {
    collegeName: string;
    courseName: string;
    country: string;
    state: string;
    city: string;
    serviceName: string;
    projectName: string;
    tags: string;
  };
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

interface ClientColumnOption {
  key: string;
  label: string;
}

interface ClientColumnDefinition {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (client: ClientListItem) => ReactNode;
}

const CLIENT_COLUMN_OPTIONS: ClientColumnOption[] = [
  { key: "name", label: "Student Name" },
  { key: "collegeName", label: "College Name" },
  { key: "courseName", label: "Course Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "activities", label: "Activities" },
  { key: "country", label: "Country" },
  { key: "serviceName", label: "Service" },
  { key: "projectName", label: "Project" },
  { key: "tags", label: "Tags" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created" },
];

const DEFAULT_VISIBLE_COLUMN_KEYS = ["name", "email", "phone", "activities", "country"];
export function ClientTable({
  clients,
  page,
  pages,
  query,
  status,
  filters,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}: ClientTableProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [search, setSearch] = useState(query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(DEFAULT_VISIBLE_COLUMN_KEYS);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const displayedClients = clients;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const columnDefinitions = useMemo<ClientColumnDefinition[]>(
    () => [
      {
        key: "name",
        label: "Student Name",
        render: (client) => (
          <Link href={`/clients/${client.id}`} className="font-medium text-slate-800 hover:underline" onClick={(event) => event.stopPropagation()}>
            {client.name}
          </Link>
        ),
      },
      {
        key: "collegeName",
        label: "College Name",
        render: (client) => client.collegeName || "-",
      },
      {
        key: "courseName",
        label: "Course Name",
        render: (client) => client.courseName || "-",
      },
      {
        key: "email",
        label: "Email",
        render: (client) => getDisplayClientEmail(client.email) || "-",
      },
      {
        key: "phone",
        label: "Phone",
        render: (client) => client.phone || "-",
      },
      {
        key: "activities",
        label: "Activities",
        render: (client) => (
          <div className="inline-flex items-center gap-1 text-slate-600">
            <Clock3 className="h-4 w-4" />
            <span>{client.activityCount}</span>
          </div>
        ),
      },
      {
        key: "country",
        label: "Country",
        render: (client) => client.country || "-",
      },
      {
        key: "serviceName",
        label: "Service",
        render: (client) => client.serviceName || "-",
      },
      {
        key: "projectName",
        label: "Project",
        render: (client) => client.projectName || "-",
      },
      {
        key: "tags",
        label: "Tags",
        render: (client) => client.tags || "-",
      },
      {
        key: "status",
        label: "Status",
        render: (client) => (
          <span className={client.isActive ? "font-medium text-emerald-600" : "font-medium text-slate-500"}>
            {client.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        key: "createdAt",
        label: "Created",
        render: (client) => format(client.createdAt, "MMM d, yyyy"),
      },
    ],
    []
  );
  const normalizedColumnKeys = useMemo(
    () => CLIENT_COLUMN_OPTIONS.map((option) => option.key).filter((key) => columnDefinitions.some((column) => column.key === key)),
    [columnDefinitions]
  );

  useEffect(() => {
    setSearch(query);
  }, [query]);

  useEffect(() => {
    const visibleIds = new Set(displayedClients.map((client) => client.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [displayedClients]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setVisibleColumnKeys(DEFAULT_VISIBLE_COLUMN_KEYS);
  }, []);

  const allSelected = useMemo(
    () => displayedClients.length > 0 && displayedClients.every((client) => selectedIdSet.has(client.id)),
    [displayedClients, selectedIdSet]
  );
  const stickyHeaderCellClassName = "sticky top-0 z-10 bg-slate-50";
  const visibleColumns = useMemo(
    () => columnDefinitions.filter((column) => visibleColumnKeys.includes(column.key)),
    [columnDefinitions, visibleColumnKeys]
  );
  const tableMinWidth = Math.max(760, visibleColumns.length * 150 + 120);

  useEffect(() => {
    setVisibleColumnKeys((current) => {
      const next = current.filter((key) => normalizedColumnKeys.includes(key));
      return next.length > 0 ? next : DEFAULT_VISIBLE_COLUMN_KEYS;
    });
  }, [normalizedColumnKeys]);

  const updateParams = ({
    nextQuery = query,
    nextPage = page,
    nextStatus = status,
    nextFilters = filters,
  }: {
    nextQuery?: string;
    nextPage?: number;
    nextStatus?: ClientStatusFilter;
    nextFilters?: Partial<ClientTableProps["filters"]>;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQuery) {
      params.set("q", nextQuery);
    } else {
      params.delete("q");
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }

    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    } else {
      params.delete("status");
    }

    const mergedFilters = { ...filters, ...nextFilters };
    (Object.entries(mergedFilters) as [keyof typeof mergedFilters, string][]).forEach(([key, value]) => {
      if (value && value.trim()) {
        params.set(key, value.trim());
      } else {
        params.delete(key);
      }
    });

    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(url);
  };

  const toErrorMessage = (error: unknown) => {
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      return Object.values(error as Record<string, string[] | undefined>)
        .flat()
        .filter(Boolean)
        .join(", ");
    }
    return "Something went wrong";
  };

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParams({ nextQuery: search.trim(), nextPage: 1 });
  };

  const handleDelete = () => {
    if (!deleteId) return;

    startTransition(async () => {
      const result = await deleteClient(deleteId);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
      } else {
        toast.success("Client deleted successfully");
        router.refresh();
      }
      setDeleteId(null);
    });
  };

  const handleToggleStatus = (id: string) => {
    startTransition(async () => {
      const result = await toggleClientStatus(id);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
      } else {
        const isActive = "data" in result ? result.data?.isActive : undefined;
        toast.success(`Client ${isActive ? "activated" : "deactivated"} successfully`);
        router.refresh();
      }
    });
  };

  const handleExport = () => {
    startTransition(async () => {
      try {
        const csv = await exportClientsCsv({ query, status });
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "contacts-export.csv";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        toast.success("Contacts exported successfully");
      } catch {
        toast.error("Unable to export contacts");
      }
    });
  };

  const openClientDetails = (clientId: string) => {
    router.push(`/clients/${clientId}`);
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(displayedClients.map((item) => item.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleColumn = (columnKey: string, checked: boolean) => {
    setVisibleColumnKeys((current) => {
      if (checked) {
        const next = normalizedColumnKeys.filter((key) => key === columnKey || current.includes(key));
        return next.length > 0 ? next : DEFAULT_VISIBLE_COLUMN_KEYS;
      }

      if (current.length === 1 && current.includes(columnKey)) {
        return current;
      }

      const next = normalizedColumnKeys.filter((key) => key !== columnKey && current.includes(key));
      return next.length > 0 ? next : current;
    });
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
        <ClientTableToolbar
          canCreate={canCreate}
          filters={filters}
          isPending={isPending}
          onExport={handleExport}
          onOpenImport={() => setIsImportDialogOpen(true)}
          onPageChange={(nextPage) => updateParams({ nextPage })}
          onSearchChange={setSearch}
          onSearchSubmit={onSearchSubmit}
          onFiltersChange={(nextFilters, nextStatus) => updateParams({ nextFilters, nextStatus, nextPage: 1 })}
          page={page}
          pages={pages}
          search={search}
          status={status}
        />

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full text-sm" style={{ minWidth: tableMinWidth }}>
            <thead className="bg-slate-50/95 backdrop-blur">
              <tr className="border-b bg-slate-50 text-left">
                <th className={`${stickyHeaderCellClassName} w-12 px-4 py-3`}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                {visibleColumns.map((column) => (
                  <th key={column.key} className={`${stickyHeaderCellClassName} px-4 py-3 font-semibold`}>
                    {column.label}
                  </th>
                ))}
                <th className={`${stickyHeaderCellClassName} w-16 px-4 py-3 text-right`}>
                  <Popover open={isColumnPickerOpen} onOpenChange={setIsColumnPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        title="Choose visible list fields"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[280px] p-0">
                      <div className="border-b border-slate-200 px-4 py-3 text-left">
                        <p className="text-sm font-semibold text-slate-900">List Fields</p>
                        <p className="text-xs text-slate-500">Choose which contact details to show.</p>
                      </div>
                      <div className="max-h-[420px] space-y-1 overflow-y-auto px-2 py-2">
                        {CLIENT_COLUMN_OPTIONS.map((column) => {
                          const checked = visibleColumnKeys.includes(column.key);
                          const isOnlySelected = checked && visibleColumnKeys.length === 1;

                          return (
                            <label
                              key={column.key}
                              className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-900 hover:bg-slate-50 ${isOnlySelected ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isOnlySelected}
                                onChange={(event) => toggleColumn(column.key, event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                              />
                              <span>{column.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
                        Selections save automatically.
                      </div>
                    </PopoverContent>
                  </Popover>
                </th>
              </tr>
          </thead>
            <tbody>
              {displayedClients.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="px-4 py-10 text-center text-slate-500">
                    No contacts found.
                  </td>
                </tr>
              ) : (
                displayedClients.map((client) => (
                  <tr
                    key={client.id}
                    className="h-16 cursor-pointer border-b hover:bg-slate-50/70"
                    onClick={() => openClientDetails(client.id)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openClientDetails(client.id);
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(client.id)}
                        onChange={() => toggleSelectOne(client.id)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    {visibleColumns.map((column) => (
                      <td key={`${client.id}-${column.key}`} className={`px-4 py-3 ${column.cellClassName || ""}`}>
                        {column.render(client)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/clients/${client.id}`}>View</Link>
                          </DropdownMenuItem>
                          {canUpdate && (
                            <DropdownMenuItem asChild>
                              <Link href={`/clients/${client.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {canUpdate && (
                            <DropdownMenuItem onClick={() => handleToggleStatus(client.id)}>
                              {client.isActive ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteId(client.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClientImportDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} />

      <ClientDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
          }
        }}
        onConfirm={handleDelete}
      />
    </>
  );
}
