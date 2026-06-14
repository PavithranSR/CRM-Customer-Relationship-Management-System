"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface ClientsModuleTopNavProps {
  activeLabel?: "contacts" | "manage-colleges";
  contactsHref?: string;
  manageCollegesHref?: string;
}

function getLabelClassName(active: boolean) {
  return cn(
    "shrink-0 whitespace-nowrap transition-colors",
    active ? "font-semibold text-slate-900" : "text-slate-500 hover:text-slate-800"
  );
}

export function ClientsModuleTopNav({
  activeLabel,
  contactsHref = "/clients",
  manageCollegesHref,
}: ClientsModuleTopNavProps) {
  return (
    <div className="flex min-w-0 items-center gap-8 text-lg">
      <Link href={contactsHref} className={getLabelClassName(activeLabel === "contacts")}>
        Contacts
      </Link>
      {manageCollegesHref ? (
        <Link
          href={manageCollegesHref}
          className={cn(getLabelClassName(activeLabel === "manage-colleges"), "cursor-pointer")}
        >
          Manage Colleges
        </Link>
      ) : null}
    </div>
  );
}
