import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActivityLogs } from "@/actions/activity-log.actions";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityAction } from "@prisma/client";

interface ActivityLogsPageProps {
  searchParams: Promise<{
    action?: ActivityAction;
    entityType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function ActivityLogsPage({ searchParams }: ActivityLogsPageProps) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasProjectModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("PROJECT");

  if (!hasProjectModuleAccess) {
    redirect("/dashboard");
  }

  let logs: Awaited<ReturnType<typeof getActivityLogs>> = [];
  try {
    logs = await getActivityLogs({
      action: params.action,
      entityType: params.entityType,
      userId: params.userId || undefined,
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      endDate: params.endDate ? new Date(params.endDate) : undefined,
      limit: 100,
    });
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground">Monitor all system activity</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select name="action" defaultValue={params.action || "all"}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="ASSIGN">Assign</SelectItem>
                  <SelectItem value="UNASSIGN">Unassign</SelectItem>
                  <SelectItem value="STATUS_CHANGE">Status Change</SelectItem>
                  <SelectItem value="HOLD">Hold</SelectItem>
                  <SelectItem value="RESTART">Restart</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select name="entityType" defaultValue={params.entityType || "all"}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="project_task">Task</SelectItem>
                  <SelectItem value="project_task_state">Task State</SelectItem>
                  <SelectItem value="project_comment">Project Comment</SelectItem>
                  <SelectItem value="task_comment">Task Comment</SelectItem>
                  <SelectItem value="time_entry">Time Entry</SelectItem>
                  <SelectItem value="auth">Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>User ID</Label>
              <Input
                name="userId"
                defaultValue={params.userId}
                placeholder="Filter by target user id"
                className="w-52"
              />
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                name="startDate"
                defaultValue={params.startDate}
                className="w-40"
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                name="endDate"
                defaultValue={params.endDate}
                className="w-40"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <ActivityFeed logs={logs} />
    </div>
  );
}

