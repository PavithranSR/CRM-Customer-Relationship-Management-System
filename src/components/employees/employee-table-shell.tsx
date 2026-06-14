"use client";

import dynamic from "next/dynamic";
import { Loader } from "@/components/ui/loader";
import type { EmployeeTableProps } from "@/components/employees/employee-table";

const EmployeeTableClient = dynamic(
  () => import("@/components/employees/employee-table").then((module) => module.EmployeeTable),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[70vh] w-full items-center justify-center">
        <div className="rounded-full border border-slate-200 bg-white/95 px-5 py-3 shadow-sm">
          <Loader label="Loading employees..." size="lg" center />
        </div>
      </div>
    ),
  }
);

export function EmployeeTableShell(props: EmployeeTableProps) {
  return <EmployeeTableClient {...props} />;
}
