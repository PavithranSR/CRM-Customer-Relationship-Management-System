import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmProjectTypeById } from "@/actions/crm-project-types.actions";
import { getCrmProjectById } from "@/actions/crm-projects.actions";
import { CrmModuleTopNav } from "@/components/crm/crm-module-top-nav";

interface CrmProjectDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CrmProjectDetailPage({ params }: CrmProjectDetailPageProps) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const projectRecord = await getCrmProjectById(id);
  const projectType = projectRecord ? null : await getCrmProjectTypeById(id);
  const project = projectRecord || projectType;

  if (!project) {
    notFound();
  }

  const budgetAmount = projectRecord ? projectRecord.price : projectType!.budget;
  const gstPercent = projectRecord ? projectRecord.gstPercent : projectType!.gstPercent;
  const projectStatus = projectRecord ? projectRecord.status : projectType!.status;
  const projectDescription = projectRecord ? projectRecord.description : projectType!.description;
  const gstAmount = budgetAmount * (gstPercent / 100);
  const totalAmount = budgetAmount + gstAmount;
  const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

  return (
    <div className="space-y-4">
      <CrmModuleTopNav activeItem="configuration" />

      <div className="rounded-md border bg-white">
        <div className="border-b bg-slate-50 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
              <p className="mt-1 text-sm text-slate-600">Full project details on one page.</p>
            </div>
            <Link
              href="/crm/quotations?tab=projects"
              className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Projects
            </Link>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Name</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{project.name}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{project.category || "Other"}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {currency.format(budgetAmount)}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GST %</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{gstPercent.toFixed(2)}%</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GST Amount</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{currency.format(gstAmount)}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Commitments</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{currency.format(totalAmount)}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{projectStatus}</p>
          </div>
        </div>

        <div className="grid gap-4 border-t p-6 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Overview</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <dt className="text-slate-500">Project ID</dt>
                <dd className="font-medium text-slate-900">
                  {projectRecord ? projectRecord.projectCode || projectRecord.id : project.id}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <dt className="text-slate-500">Updated At</dt>
                <dd className="font-medium text-slate-900">{new Date(project.updatedAt).toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <dt className="text-slate-500">Budget Amount</dt>
                <dd className="font-medium text-slate-900">{budgetAmount.toFixed(2)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <dt className="text-slate-500">GST</dt>
                <dd className="font-medium text-slate-900">
                  {gstPercent.toFixed(2)}% ({currency.format(gstAmount)})
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Total Commitments</dt>
                <dd className="font-medium text-slate-900">{currency.format(totalAmount)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Actions</p>
            {projectDescription ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{projectDescription}</p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/crm/quotations?tab=projects"
                className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open Projects List
              </Link>
              <Link
                href={`/crm/projects/new?next=${encodeURIComponent(`/crm/projects/${project.id}`)}`}
                className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Create New Project
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              This page shows the selected project in a dedicated full-page layout instead of only inside the list.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
