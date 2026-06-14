"use client";

import { useEffect, useMemo, useState } from "react";
import { getProjectTasks } from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTaskStatus, normalizeTask, type ProjectTask } from "@/lib/project-task-utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface TlTeamMembersProps {
  projectId: string;
  employees: TeamMember[];
}

function getCurrentStatus(activeTasks: number, completedTasks: number) {
  if (activeTasks > 0) return "Busy";
  if (completedTasks > 0) return "Completed";
  return "Idle";
}

export function TlTeamMembers({ projectId, employees }: TlTeamMembersProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);

  useEffect(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        setTasks([]);
        return;
      }

      setTasks(
        result.data
          .map(normalizeTask)
          .filter((task): task is ProjectTask => Boolean(task))
      );
    });
  }, [projectId]);

  const membersWithStats = useMemo(
    () =>
      employees.map((employee) => {
        const myTasks = tasks.filter(
          (task) =>
            task.employeeAssigneeId === employee.id ||
            (!task.employeeAssigneeId && task.assigneeId === employee.id)
        );
        const completedTasks = myTasks.filter((task) => getTaskStatus(task) === "DONE").length;
        const activeTasks = myTasks.length - completedTasks;
        const currentStatus = getCurrentStatus(activeTasks, completedTasks);

        return {
          ...employee,
          activeTasks,
          completedTasks,
          currentStatus,
        };
      }),
    [employees, tasks]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
      </CardHeader>
      <CardContent>
        {membersWithStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employees assigned to this project.</p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium">Employee Name</th>
                  <th className="px-4 py-3 font-medium">Active Tasks</th>
                  <th className="px-4 py-3 font-medium">Completed Tasks</th>
                  <th className="px-4 py-3 font-medium">Current Status</th>
                </tr>
              </thead>
              <tbody>
                {membersWithStats.map((member) => (
                  <tr key={member.id} className="border-t">
                    <td className="px-4 py-3">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </td>
                    <td className="px-4 py-3">{member.activeTasks}</td>
                    <td className="px-4 py-3">{member.completedTasks}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{member.currentStatus}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
