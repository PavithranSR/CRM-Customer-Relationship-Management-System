import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, BookOpen, Mail, Phone, Pencil, School } from "lucide-react";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientActivityPanel } from "@/components/clients/client-activity-panel";
import { getDisplayClientEmail } from "@/lib/client-contact";
import { fetchClientActivityLogs, fetchClientById } from "@/lib/client-read";

interface ClientPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientPage({ params }: ClientPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasClientModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("CRM");

  if (!hasClientModuleAccess) {
    redirect("/dashboard");
  }

  const canUpdate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("UPDATE") ||
    session.user.permissions.actionPermissions.includes("EDIT");

  const client = await fetchClientById(id);
  if (!client) {
    notFound();
  }

  const logs = await fetchClientActivityLogs(id, 20);
  const displayEmail = getDisplayClientEmail(client.email);

  const initials = client.name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  const addressLines = [
    client.street,
    client.address,
    [client.city, client.state, client.zip].filter(Boolean).join(", "),
    client.country,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const renderValue = (value: string | null | undefined) => value?.trim() || "-";
  const hasText = (value: string | null | undefined) => Boolean(value?.trim());

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Client Details</h1>
            <p className="text-sm text-muted-foreground">View contact information</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={client.isActive ? "default" : "secondary"}>
            {client.isActive ? "Active" : "Inactive"}
          </Badge>
          {canUpdate && (
            <Button asChild>
              <Link href={`/clients/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_520px] 2xl:grid-cols-[minmax(0,1fr)_600px]">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/30 p-6 shadow-sm">
          <div className="grid gap-5 border-b border-sky-100 pb-7 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-center">
            <div className="flex h-[160px] w-[160px] items-center justify-center rounded-2xl bg-white text-4xl font-medium text-slate-500 ring-1 ring-sky-100">
              {initials || "C"}
            </div>
            <div className="space-y-4">
              <div>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{client.name}</h2>
              </div>
              <div className="grid gap-4 text-base text-slate-700">
                {hasText(client.collegeName) ? (
                  <div className="flex items-start gap-3">
                    <School className="mt-0.5 h-5 w-5 shrink-0 text-[#7c4a69]" />
                    <div>
                      <p className="text-base text-slate-900">{renderValue(client.collegeName)}</p>
                    </div>
                  </div>
                ) : null}
                {hasText(client.courseName) ? (
                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[#7c4a69]" />
                    <div>
                      <p className="text-base text-slate-900">{renderValue(client.courseName)}</p>
                    </div>
                  </div>
                ) : null}
                {hasText(displayEmail) ? (
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#7c4a69]" />
                    <div>
                      <p className="text-base text-slate-900">{renderValue(displayEmail)}</p>
                    </div>
                  </div>
                ) : null}
                {hasText(client.phone) ? (
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[#7c4a69]" />
                    <div>
                      <p className="text-base text-slate-900">{renderValue(client.phone)}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-0 py-7 md:grid-cols-2">
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-slate-900">Address</h3>
              <div className="space-y-4 text-base text-slate-700">
                {addressLines.length > 0 ? (
                  addressLines.map((line) => <p key={line}>{line}</p>)
                ) : (
                  <p>-</p>
                )}
              </div>

              <div className="pt-2">
                <h3 className="text-lg font-semibold text-slate-900">Tags</h3>
                <p className="mt-4 text-base text-slate-700">{renderValue(client.tags)}</p>
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-slate-900">Project Name</h3>
              <p className="mt-4 text-base text-slate-700">{renderValue(client.projectName)}</p>
            </div>

            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">Notes</h3>
              <p className="mt-4 whitespace-pre-wrap text-base text-slate-700">{renderValue(client.notes)}</p>
            </div>
          </div>

          <div className="border-t border-sky-100 pt-5 text-sm text-slate-500">
            <p>Created: {format(new Date(client.createdAt), "MMM d, yyyy h:mm a")}</p>
            <p>Updated: {format(new Date(client.updatedAt), "MMM d, yyyy h:mm a")}</p>
          </div>
        </div>

        <ClientActivityPanel
          clientId={client.id}
          clientName={client.name}
          clientEmail={displayEmail}
          logs={logs}
        />
      </div>
    </div>
  );
}
