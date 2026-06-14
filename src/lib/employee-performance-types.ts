export type EmployeePerformanceRange = "daily" | "weekly" | "monthly";

export interface EmployeePerformanceListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  position: string | null;
  joinDate: string | null;
  isActive: boolean;
  totalProjects: number;
  completedProjects: number;
  monthlyHours: number;
  monthlyRevenue: number;
}

export interface EmployeePerformanceListSummary {
  employeeCount: number;
  activeEmployees: number;
  totalProjects: number;
  monthlyHours: number;
  monthlyRevenue: number;
  averageProjectsPerEmployee: number;
}

export interface EmployeePerformanceListResponse {
  range: EmployeePerformanceRange;
  rangeLabel: string;
  summary: EmployeePerformanceListSummary;
  employees: EmployeePerformanceListItem[];
}

export interface EmployeePerformanceEmployeeInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  joinDate: string | null;
  status: "Active" | "Inactive";
}

export interface EmployeePerformanceSummary {
  totalProjects: number;
  ongoingProjects: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalHours: number;
  billableHours: number;
  billableShare: number;
  totalRevenue: number;
}

export interface EmployeePerformanceProjectRow {
  id: string;
  name: string;
  code: string;
  status: "Ongoing" | "Completed";
  rawStatus: string;
  deadline: string | null;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  timeSpentHours: number;
  revenue: number;
  totalProjectValue: number;
}

export interface EmployeePerformanceTaskRow {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  status: "Completed" | "Pending";
  assignedDate: string;
  completionDate: string | null;
  dueDate: string | null;
  timeTakenHours: number;
  revenue: number;
  updateCount: number;
}

export interface EmployeePerformanceChartDatum {
  label: string;
  value: number;
}

export interface EmployeePerformanceTaskBarDatum {
  label: string;
  completed: number;
  pending: number;
}

export interface EmployeePerformanceTrendDatum {
  label: string;
  hours: number;
  tasksCompleted: number;
}

export interface EmployeePerformanceRevenueTrendDatum {
  label: string;
  revenue: number;
}

export interface EmployeePerformanceChangeSummary {
  totalChanges: number;
  stageChanges: number;
  dailyUpdates: number;
  commentsAdded: number;
  tasksCreated: number;
  tasksCompleted: number;
}

export interface EmployeePerformanceChangeItem {
  id: string;
  title: string;
  detail: string;
  field: string;
  projectName: string | null;
  taskName: string | null;
  actorName: string;
  timestamp: string;
}

export interface EmployeePerformanceCharts {
  taskCompletion: EmployeePerformanceTaskBarDatum[];
  performanceTrend: EmployeePerformanceTrendDatum[];
  projectContribution: EmployeePerformanceChartDatum[];
  revenueTrend: EmployeePerformanceRevenueTrendDatum[];
}

export interface EmployeePerformanceDetailResponse {
  range: EmployeePerformanceRange;
  rangeLabel: string;
  employee: EmployeePerformanceEmployeeInfo;
  summary: EmployeePerformanceSummary;
  projects: EmployeePerformanceProjectRow[];
  tasks: EmployeePerformanceTaskRow[];
  charts: EmployeePerformanceCharts;
  changes: {
    summary: EmployeePerformanceChangeSummary;
    items: EmployeePerformanceChangeItem[];
  };
  notes: string[];
}
