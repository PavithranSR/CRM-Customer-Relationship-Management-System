"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CrmLeadArrowNavProps {
  currentCount: number;
  totalCount: number;
  prevLeadId: string | null;
  nextLeadId: string | null;
  basePath?: string;
  queryString?: string;
  compact?: boolean;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function CrmLeadArrowNav({
  currentCount,
  totalCount,
  prevLeadId,
  nextLeadId,
  basePath = "/crm",
  queryString = "",
  compact = false,
}: CrmLeadArrowNavProps) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "ArrowLeft" && prevLeadId) {
        event.preventDefault();
        router.push(`${basePath}/${prevLeadId}${queryString}`);
      }

      if (event.key === "ArrowRight" && nextLeadId) {
        event.preventDefault();
        router.push(`${basePath}/${nextLeadId}${queryString}`);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [basePath, nextLeadId, prevLeadId, queryString, router]);

  return (
    <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      <span className={`${compact ? "text-base" : "text-sm"} font-medium text-slate-700`}>
        {currentCount} / {totalCount}
      </span>
      <div className="flex overflow-hidden rounded-md border">
        {prevLeadId ? (
          <Link
            href={`${basePath}/${prevLeadId}${queryString}`}
            className={`border-r bg-slate-50 text-slate-700 hover:bg-slate-100 ${compact ? "p-2.5" : "p-2"}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={`border-r bg-slate-50 text-slate-300 ${compact ? "p-2.5" : "p-2"}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {nextLeadId ? (
          <Link
            href={`${basePath}/${nextLeadId}${queryString}`}
            className={`bg-slate-50 text-slate-700 hover:bg-slate-100 ${compact ? "p-2.5" : "p-2"}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={`bg-slate-50 text-slate-300 ${compact ? "p-2.5" : "p-2"}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
