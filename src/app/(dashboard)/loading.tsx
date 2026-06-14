import { Loader } from "@/components/ui/loader";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
      <div className="w-full max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        <div className="flex items-center justify-center pt-2">
          <Loader label="Loading page..." size="md" center />
        </div>
      </div>
    </div>
  );
}
