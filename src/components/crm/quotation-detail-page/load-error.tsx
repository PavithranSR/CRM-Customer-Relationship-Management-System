import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CrmQuotationDetailLoadError() {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <h1 className="text-base font-semibold">Database connection issue</h1>
      <p className="mt-1 text-sm">
        Could not connect to the database right now. Please check your `DATABASE_URL` and try again in a moment.
      </p>
      <div className="mt-3">
        <Button asChild variant="outline">
          <Link href="/crm">Back to CRM</Link>
        </Button>
      </div>
    </div>
  );
}
