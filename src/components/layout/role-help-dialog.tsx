"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CircleHelp } from "lucide-react";

interface RoleHelpDialogProps {
  role: string;
}

interface HelpSection {
  heading: string;
  items: string[];
}

interface RoleHelpContent {
  title: string;
  intro: string;
  sections: HelpSection[];
}

const roleHelpMap: Record<string, RoleHelpContent> = {
  ADMIN: {
    title: "Admin Quick Guide",
    intro:
      "As Admin, you control users, teams, clients, and overall project operations. Your actions affect every department.",
    sections: [
      {
        heading: "Start of Day",
        items: [
          "Open Dashboard and check delayed projects, low progress items, and unassigned work.",
          "Review notifications for approvals, escalations, and important system messages.",
        ],
      },
      {
        heading: "User and Team Control",
        items: [
          "Use Employees to add/edit staff, update role, and maintain active status.",
          "Use Team Management to assign members under BA and Team Leader structure.",
          "Ensure no employee remains without reporting hierarchy or project alignment.",
        ],
      },
      {
        heading: "Business and Delivery",
        items: [
          "Use Clients and CRM to manage lead lifecycle from registration to quotation and invoice.",
          "Use Projects to create projects, assign managers, set deadlines, and track progress.",
          "Intervene on blocked projects by reallocating team members or adjusting priorities.",
        ],
      },
      {
        heading: "Governance",
        items: [
          "Use Reports weekly to compare effort, productivity, and completion trends.",
          "Use Activity Logs for audit trail of major actions like assignment, update, hold, and restart.",
          "Use Security settings to protect access and enforce role-based control.",
        ],
      },
    ],
  },
  BA: {
    title: "Business Analyst Quick Guide",
    intro:
      "As BA, your focus is planning, coordination, and delivery quality across your team and active projects.",
    sections: [
      {
        heading: "Start of Day",
        items: [
          "Open Dashboard and list projects that are behind schedule or missing updates.",
          "Check My Team for current allocation and identify overloaded or idle members.",
        ],
      },
      {
        heading: "Execution Tracking",
        items: [
          "Review Projects for status movement, new dependencies, and pending approvals.",
          "Coordinate with Team Leaders to split work clearly and remove blockers early.",
          "Confirm priority tasks are assigned with realistic deadlines.",
        ],
      },
      {
        heading: "Effort Validation",
        items: [
          "Use Work Tracking to verify daily time entries are complete and meaningful.",
          "Compare planned effort vs actual effort and follow up on major gaps.",
          "Use Reports to monitor velocity, utilization, and delivery stability.",
        ],
      },
      {
        heading: "Operational Follow-up",
        items: [
          "Use Activity Logs to confirm who changed status, assignments, and key updates.",
          "Escalate risks to Admin with clear impact and recommended action.",
        ],
      },
    ],
  },
  TEAMLEADER: {
    title: "Team Leader Quick Guide",
    intro:
      "As Team Leader, your core responsibility is task execution: assign clearly, track daily, and deliver on time.",
    sections: [
      {
        heading: "Start of Day",
        items: [
          "Open Dashboard and identify urgent tasks due today or overdue.",
          "Check project progress gaps and prepare assignment updates for your team.",
        ],
      },
      {
        heading: "Task Management",
        items: [
          "Use Projects to break work into small assignable tasks with clear output.",
          "Assign each task to the right employee based on skill and availability.",
          "Update status and progress frequently so BA/Admin can trust project visibility.",
        ],
      },
      {
        heading: "Team Monitoring",
        items: [
          "Confirm every member submits Work Tracking daily with meaningful descriptions.",
          "Review blockers in comments and resolve quickly through clarification or reassignment.",
          "Keep effort balanced to avoid burnout and missed deadlines.",
        ],
      },
      {
        heading: "Performance Review",
        items: [
          "Use Reports to identify low throughput, delayed tasks, and rework patterns.",
          "Use Activity Logs to validate critical task and status actions.",
        ],
      },
    ],
  },
  EMPLOYEE: {
    title: "Employee Quick Guide",
    intro:
      "As Employee, your success depends on completing assigned tasks on time and updating your work transparently every day.",
    sections: [
      {
        heading: "Start of Day",
        items: [
          "Open Dashboard and check your assigned tasks and latest instructions.",
          "Prioritize items by due date and urgency shared by your Team Leader.",
        ],
      },
      {
        heading: "Task Execution",
        items: [
          "Open Projects and read task details fully before starting work.",
          "Post updates/comments when a task is blocked or scope is unclear.",
          "Move tasks forward consistently instead of waiting until end of day.",
        ],
      },
      {
        heading: "Daily Time Entry",
        items: [
          "Use Work Tracking every day and enter hours against correct project/task.",
          "Write clear descriptions of what was completed, not generic text.",
          "Submit entries before day end so leads can track progress accurately.",
        ],
      },
      {
        heading: "Escalation",
        items: [
          "If requirement is unclear, ask Team Leader immediately before continuing.",
          "If deadline risk appears, report it early with reason and remaining effort.",
        ],
      },
    ],
  },
};

const defaultHelp: RoleHelpContent = {
  title: "Quick Guide",
  intro: "This guide helps you understand your daily workflow in the system.",
  sections: [
    {
      heading: "Basic Workflow",
      items: [
        "Open Dashboard first to understand pending work.",
        "Use only modules visible to your role in the sidebar.",
        "Update tasks and work tracking entries daily.",
      ],
    },
  ],
};

export function RoleHelpDialog({ role }: RoleHelpDialogProps) {
  const help = roleHelpMap[role] ?? defaultHelp;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Role help">
          <CircleHelp className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{help.title}</DialogTitle>
          <DialogDescription>{help.intro}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          {help.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h4 className="text-sm font-semibold">{section.heading}</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-current" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
