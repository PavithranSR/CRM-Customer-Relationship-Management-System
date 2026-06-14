import { ActivityAction, Role } from "@prisma/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityActor {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface ProjectActivityLog {
  id: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  createdAt: Date;
  metadata: unknown;
  user?: ActivityActor | null;
  createdBy?: ActivityActor | null;
}

interface ProjectActivityHistoryProps {
  logs: ProjectActivityLog[];
}

function getLabel(log: ProjectActivityLog) {
  const metadata = (log.metadata && typeof log.metadata === "object"
    ? log.metadata
    : null) as Record<string, unknown> | null;

  if (log.entityType === "project_comment") {
    return "Project comment added";
  }
  if (log.entityType === "task_comment") {
    return "Task comment added";
  }
  if (log.entityType === "project_task" && log.action === "CREATE") {
    return `Task created: ${String(metadata?.title ?? "Untitled")}`;
  }
  if (log.entityType === "project_task" && log.action === "UPDATE") {
    return "Task updated";
  }
  if (log.entityType === "project_task_state") {
    return "Task board state updated";
  }
  if (log.entityType === "project_milestone_state") {
    return "Milestone board updated";
  }
  if (log.entityType === "project_sprint_state") {
    return "Sprint board updated";
  }
  return `${log.entityType.replaceAll("_", " ")} ${log.action.toLowerCase()}`;
}

export function ProjectActivityHistory({ logs }: ProjectActivityHistoryProps) {
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Project Activity History</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity logs for this project yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{getLabel(log)}</p>
                  <Badge variant="outline">{format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>By {log.createdBy?.name || "System"}</span>
                  <Badge variant="secondary">{log.action}</Badge>
                  <Badge variant="outline">{log.entityType}</Badge>
                  {log.user && log.createdBy && log.user.id !== log.createdBy.id ? (
                    <span>Monitored user: {log.user.name}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
