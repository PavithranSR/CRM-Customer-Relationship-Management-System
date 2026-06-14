import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CrmDetailPageShellProps {
  navigation?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  navigationClassName?: string;
}

export function CrmDetailPageShell({
  navigation,
  header,
  children,
  className,
  navigationClassName,
}: CrmDetailPageShellProps) {
  return (
    <div className={cn("flex min-h-0 flex-col gap-4", className)}>
      {navigation ? (
        <div
          className={cn(
            "shrink-0 rounded-xl border bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80",
            navigationClassName
          )}
        >
          {navigation}
        </div>
      ) : null}
      {header ? <div className="shrink-0">{header}</div> : null}
      {children}
    </div>
  );
}
