"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Timer } from "lucide-react";
import { getProjectTasks } from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectTask, getTaskStatus, normalizeTask } from "@/lib/project-task-utils";

interface TeamPerson {
  id: string;
  name: string;
  role: string;
}

interface HoursByUser {
  userId: string;
  _sum: { hours: number | null };
}

interface AdminProjectReportsProps {
  projectId: string;
  teamMembers: TeamPerson[];
  hoursByUser: HoursByUser[];
}

export function AdminProjectReports({
  projectId,
  teamMembers,
  hoursByUser,
}: AdminProjectReportsProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);

  useEffect(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        setTasks([]);
        return;
      }
      setTasks(
        (result.data ?? [])
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
      );
    });
  }, [projectId]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => getTaskStatus(task) === "DONE").length;

  const tlPerformance = useMemo(() => {
    const tls = teamMembers.filter((member) => member.role === "TEAMLEADER");
    return tls.map((tl) => {
      const tlTasks = tasks.filter(
        (task) =>
          task.assignedTlId === tl.id ||
          (!task.assignedTlId && task.assigneeId === tl.id)
      );
      const doneCount = tlTasks.filter((task) => getTaskStatus(task) === "DONE").length;
      const completionRate = tlTasks.length === 0 ? 0 : Math.round((doneCount / tlTasks.length) * 100);

      return {
        id: tl.id,
        name: tl.name,
        total: tlTasks.length,
        completed: doneCount,
        completionRate,
      };
    });
  }, [teamMembers, tasks]);

  const employeeHours = useMemo(() => {
    const hoursMap = new Map(hoursByUser.map((entry) => [entry.userId, Number(entry._sum.hours ?? 0)]));
    return teamMembers
      .filter((member) => member.role === "EMPLOYEE")
      .map((member) => ({
        id: member.id,
        name: member.name,
        hours: hoursMap.get(member.id) ?? 0,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [teamMembers, hoursByUser]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Total Tasks</CardTitle>
              <ClipboardList className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-slate-900">{totalTasks}</p>
            <p className="mt-1 text-xs text-muted-foreground">All tasks in this project</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Completed Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-slate-900">{completedTasks}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)}% completion
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-lg">Team Leader Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {tlPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team leaders assigned.</p>
          ) : (
            <div className="space-y-4">
              {tlPerformance.map((tl) => (
                <div key={tl.id} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{tl.name}</p>
                    <Badge variant="outline" className="border-slate-300 text-slate-700">
                      {tl.completed}/{tl.total} completed
                    </Badge>
                  </div>
                  <Progress value={tl.completionRate} className="h-2" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Completion rate</p>
                    <p className="text-xs font-semibold text-slate-700">{tl.completionRate}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Employee Working Hours</CardTitle>
            <Timer className="h-4 w-4 text-slate-500" />
          </div>
        </CardHeader>
        <CardContent>
          {employeeHours.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees assigned.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-700">Employee</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Working Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeHours.map((employee) => (
                    <tr key={employee.id} className="border-t hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-slate-900">{employee.name}</td>
                      <td className="px-4 py-3">{employee.hours.toFixed(1)} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
