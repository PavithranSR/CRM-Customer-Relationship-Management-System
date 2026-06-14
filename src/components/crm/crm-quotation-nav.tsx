"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CrmQuotationNavProps {
  leadId: string;
  backHref?: string;
  forceBackHref?: boolean;
  showNew?: boolean;
  showBack?: boolean;
  newVariant?: "outline" | "default";
  newClassName?: string;
}

export function CrmQuotationNav({
  leadId,
  backHref,
  forceBackHref = false,
  showNew = true,
  showBack = true,
  newVariant = "outline",
  newClassName,
}: CrmQuotationNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const base = `/crm/${leadId}/quotations`;
  const newHref = `${base}/new`;
  const resolvedBackHref = backHref || "/crm/quotations";

  return (
    <div className="flex items-center gap-2">
      {showNew ? (
        <Button asChild size="sm" variant={newVariant} className={newClassName ?? "rounded-lg"}>
          <Link href={newHref} className={pathname === newHref ? "font-semibold" : undefined}>
            New Quotation
          </Link>
        </Button>
      ) : null}
      {showBack ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-lg"
          onClick={() => {
            if (forceBackHref) {
              router.push(resolvedBackHref);
              return;
            }
            if (window.history.length > 1) {
              router.back();
              return;
            }
            router.push(resolvedBackHref);
          }}
        >
          Back
        </Button>
      ) : null}
    </div>
  );
}
