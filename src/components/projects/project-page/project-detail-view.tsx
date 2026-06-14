import Link from "next/link";
import { format } from "date-fns";
import {
  ChartNoAxesCombined,
  Circle,
  CircleCheckBig,
  Mail,
  Pencil,
  Search,
  Settings,
  Star,
  Tag,
  User,
} from "lucide-react";
import { ProjectActions } from "@/components/projects/project-actions";
import { ProjectComments } from "@/components/projects/project-comments";
import { ProjectPlannedDateEditor } from "@/components/projects/project-planned-date-editor";
import { ProjectWorkflowSelectionEditor } from "@/components/projects/project-page/project-workflow-selection-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getProjectActivityLabel,
  getProjectLead,
  type ProjectDetailLog,
  type ProjectPageProject,
  type ProjectPageStats,
} from "./project-page-helpers";

interface ProjectDetailViewProps {
  canEditByPermission: boolean;
  canUseProjectActions: boolean;
  isAdmin: boolean;
  project: ProjectPageProject;
  projectLogs: ProjectDetailLog[];
  projectTaskCount: number;
  stats: ProjectPageStats;
}

interface ProjectSettingCardProps {
  label: string;
  value: string;
  secondaryValue?: string;
}

function ProjectSettingCard({
  label,
  value,
  secondaryValue,
}: ProjectSettingCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-slate-900">{value}</p>
      {secondaryValue ? <p className="mt-1 text-sm text-slate-500">{secondaryValue}</p> : null}
    </div>
  );
}

function formatProjectDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not set";
  }

  return format(parsed, "MMM d, yyyy");
}

export function ProjectDetailView({
  canEditByPermission,
  canUseProjectActions,
  isAdmin,
  project,
  projectLogs,
  projectTaskCount,
  stats,
}: ProjectDetailViewProps) {
  const detailProjectLead = getProjectLead(project);
  const activityFeed = projectLogs.slice(0, 12);
  const detailClientName = project.client?.name || "Select Customer";
  const detailCollegeName = project.client?.collegeName || "College not provided";
  const detailProjectName = project.client?.projectName?.trim() || project.name || "Project name not set";
  const detailAssignedToName = detailProjectLead?.name || "Not assigned";
  const detailTagsText = project.tags?.trim() || "Select Tags";
  const detailStatusText = project.status.replaceAll("_", " ");
  const detailPlannedStartText = formatProjectDate(project.startDate);
  const detailPlannedEndText = formatProjectDate(project.expectedClosingDate);
  const canEditPlannedDate = canUseProjectActions || canEditByPermission;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex items-center gap-1.5">
            <Button
              asChild
              size="sm"
              className="h-8 rounded-lg bg-[#44a2de] px-3.5 text-sm font-semibold text-white hover:bg-[#3991ca]"
            >
              <Link href="/projects/new">New</Link>
            </Button>
            <div className="min-w-0 space-y-0.5">
              <Link
                href={`/projects/${project.id}?view=details`}
                className="block text-[15px] font-medium leading-tight text-[#0b7f8b] hover:text-[#08646e]"
              >
                {detailProjectName}
              </Link>
              <div className="flex min-w-0 items-center gap-1">
                <p className="truncate text-[13px] leading-tight text-slate-600">{project.code || "PRJ"}</p>
                <Button
                  asChild
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <Link href="/settings" aria-label="Open settings">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-start lg:justify-center">
            <div className="inline-flex items-stretch overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <Link
                href={`/projects/${project.id}?view=kanban`}
                className="flex min-h-[34px] min-w-[90px] items-center justify-center gap-1.5 px-3 py-1 text-center hover:bg-slate-50"
              >
                <CircleCheckBig className="h-3 w-3 text-[#7b556f]" />
                <span className="space-y-0.5">
                  <span className="block text-[11px] font-semibold leading-tight text-slate-900">Tasks</span>
                  <span className="block text-[11px] leading-tight text-slate-700">
                    {projectTaskCount} ({project.progress}%)
                  </span>
                </span>
              </Link>
              <div className="my-1 w-px bg-slate-200" />
              <div className="flex min-h-[34px] min-w-[90px] items-center justify-center gap-1.5 px-3 py-1 text-center">
                <Circle className="h-3 w-3 text-slate-400" />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-semibold leading-tight text-slate-900">Status</p>
                  <p className="text-[11px] leading-tight text-slate-700">{detailStatusText}</p>
                </div>
              </div>
              {isAdmin ? (
                <>
                  <div className="my-1 w-px bg-slate-200" />
                  <Link
                    href={`/projects/${project.id}?view=reports`}
                    className="flex min-h-[34px] min-w-[118px] items-center justify-center gap-1.5 px-3 py-1 text-center hover:bg-slate-50"
                  >
                    <ChartNoAxesCombined className="h-3 w-3 text-[#7b556f]" />
                    <span className="text-[11px] font-semibold leading-tight text-slate-900">Burndown Chart</span>
                  </Link>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex justify-start lg:justify-end">
            {(canUseProjectActions || canEditByPermission) ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {canUseProjectActions ? <ProjectActions project={project} /> : null}
                {canEditByPermission ? (
                  <Button asChild variant="outline" className="border-slate-200 bg-white hover:bg-slate-50">
                    <Link href={`/projects/${project.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_380px]">
        <Card className="gap-0 overflow-hidden border-slate-200 py-0 shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-slate-200 px-6 py-5 xl:px-7">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4 xl:min-w-0 xl:max-w-[58%] xl:pr-8">
                  <div className="flex items-start gap-3">
                    <Star className="mt-0.5 h-8 w-8 text-slate-500" strokeWidth={1.7} />
                    <div className="min-w-0">
                      <h1 className="truncate text-3xl font-light tracking-tight text-slate-950">
                        {detailProjectName}
                      </h1>
                      {project.code ? <p className="mt-1 text-sm text-slate-500">{project.code}</p> : null}
                    </div>
                  </div>

                  <div className="space-y-3 text-base text-slate-600">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-slate-500" />
                      <div className="space-y-0.5">
                        <p className="font-medium text-slate-900">{detailClientName}</p>
                        <p className="text-sm text-slate-500">{detailCollegeName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Tag className="h-5 w-5 text-slate-500" />
                      <span>{detailTagsText}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:min-w-[360px] xl:max-w-[440px]">
                  <div className="grid grid-cols-[140px_1fr] items-center gap-3 xl:grid-cols-[150px_1fr] xl:gap-4">
                    <p className="text-[0.95rem] font-semibold text-slate-900">Assigned To</p>
                    <div className="flex items-center gap-2.5 text-[1.02rem] text-slate-700">
                      {detailProjectLead ? (
                        <>
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#c89212] text-sm font-semibold text-white">
                            {detailProjectLead.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-slate-900">{detailAssignedToName}</span>
                        </>
                      ) : (
                        <span>Not assigned</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-3 xl:grid-cols-[150px_1fr] xl:gap-4">
                    <p className="text-[0.95rem] font-semibold text-slate-900">Planned Date</p>
                    <ProjectPlannedDateEditor
                      canEdit={canEditPlannedDate}
                      expectedClosingDate={project.expectedClosingDate}
                      projectId={project.id}
                      startDate={project.startDate}
                    />
                  </div>

                  <ProjectWorkflowSelectionEditor
                    canEdit={canEditPlannedDate}
                    projectId={project.id}
                  />
                </div>
              </div>
            </div>

            <Tabs defaultValue="description" className="w-full">
              <div className="border-b border-slate-200 px-6">
                <TabsList className="h-auto gap-0 bg-transparent p-0">
                  <TabsTrigger
                    value="description"
                    className="rounded-none border border-b-0 border-slate-200 bg-white px-5 py-3 text-base font-medium text-slate-700 shadow-none data-[state=active]:border-b-white data-[state=active]:text-[#7b556f]"
                  >
                    Description
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="rounded-none border border-b-0 border-l-0 border-slate-200 bg-white px-5 py-3 text-base font-medium text-slate-700 shadow-none data-[state=active]:border-b-white data-[state=active]:text-[#7b556f]"
                  >
                    Settings
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="description" className="m-0 min-h-[320px] px-6 py-6">
                <p className="text-lg text-slate-400">
                  {project.description?.trim() || "Project description..."}
                </p>
              </TabsContent>

              <TabsContent value="settings" className="m-0 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <ProjectSettingCard
                    label="Client"
                    value={detailClientName}
                    secondaryValue={detailCollegeName}
                  />
                  <ProjectSettingCard label="Project Name" value={detailProjectName} />
                  <ProjectSettingCard
                    label="Project Manager"
                    value={detailProjectLead?.name || "Not assigned"}
                  />
                  <ProjectSettingCard label="Assigned To" value={detailAssignedToName} />
                  <ProjectSettingCard label="Priority" value={project.priority} />
                  <ProjectSettingCard label="Status" value={project.status.replace("_", " ")} />
                  <ProjectSettingCard
                    label="Start Date"
                    value={detailPlannedStartText}
                  />
                  <ProjectSettingCard label="End Date" value={detailPlannedEndText} />
                  <ProjectSettingCard label="Team Size" value={String(project.assignments.length)} />
                  <ProjectSettingCard label="Hours Logged" value={`${stats.totalHours.toFixed(1)}h`} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <Tabs defaultValue="activity" className="w-full">
              <div className="border-b border-slate-200 px-4 pb-1.5 pt-0.5">
                <div className="flex items-center justify-between gap-3">
                  <TabsList className="h-auto gap-2 bg-transparent p-0">
                    <TabsTrigger
                      value="message"
                      className="rounded-md bg-slate-100 px-3.5 py-1 text-sm font-semibold leading-tight text-slate-700 data-[state=active]:bg-[#7b556f] data-[state=active]:text-white"
                    >
                      Send message
                    </TabsTrigger>
                    <TabsTrigger
                      value="note"
                      className="rounded-md bg-slate-100 px-3.5 py-1 text-sm font-semibold leading-tight text-slate-700 data-[state=active]:bg-[#7b556f] data-[state=active]:text-white"
                    >
                      Log note
                    </TabsTrigger>
                    <TabsTrigger
                      value="activity"
                      className="rounded-md bg-slate-100 px-3.5 py-1 text-sm font-semibold leading-tight text-slate-700 data-[state=active]:bg-[#7b556f] data-[state=active]:text-white"
                    >
                      Activity
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-2 text-slate-500">
                    <button
                      type="button"
                      className="rounded-md p-1 transition hover:bg-slate-100 hover:text-slate-900"
                      aria-label="Search project details"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <TabsContent value="message" className="m-0 space-y-4 px-4 py-4">
                {detailProjectLead?.email ? (
                  <>
                    <Button asChild className="bg-[#7b556f] text-white hover:bg-[#69485f]">
                      <a href={`mailto:${detailProjectLead.email}`}>
                        <Mail className="mr-2 h-4 w-4" />
                        Send message
                      </a>
                    </Button>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">{detailProjectLead.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{detailProjectLead.email}</p>
                    </div>
                  </>
                ) : (
                  <p className="px-1 text-sm text-slate-500">Project lead email is not available yet.</p>
                )}
              </TabsContent>

              <TabsContent value="note" className="m-0 px-4 py-4">
                <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none">
                  <ProjectComments projectId={project.id} />
                </div>
              </TabsContent>

              <TabsContent value="activity" className="m-0 px-4 py-4">
                {activityFeed.length === 0 ? (
                  <p className="text-sm text-slate-500">No project activity yet.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span>TODAY</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                    {activityFeed.map((log) => (
                      <div key={log.id} className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#c89212] text-base font-semibold text-white">
                          {(log.createdBy?.name || "S").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold text-slate-900">{log.createdBy?.name || "System"}</span>
                            <span className="text-xs text-slate-500">
                              {format(new Date(log.createdAt), "h:mm a")}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">{getProjectActivityLabel(log)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
