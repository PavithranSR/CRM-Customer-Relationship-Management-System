import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getReportData } from "@/actions/report.actions";
import { ReportFilters } from "@/components/reports/report-filters";
import { ExportButton } from "@/components/reports/export-button";
import {
  EmployeeHoursChart,
  ProjectHoursChart,
  DailyTrendChart,
  MonthlyComparisonChart,
} from "@/components/reports/report-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, DollarSign, TrendingUp } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { buildProjectWhereForViewer } from "@/lib/employee-permissions";

interface ReportsPageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    projectId?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user) return null;
  if (
    session.user.role !== "ADMIN" &&
    !session.user.permissions.moduleAccess.includes("PROJECT")
  ) {
    redirect("/dashboard");
  }

  const canViewTeamData =
    session.user.role === "ADMIN" ||
    session.user.permissions.recordRules.includes("RECORD_RULES") ||
    session.user.permissions.recordRules.includes("TEAM_RECORD") ||
    session.user.permissions.recordRules.includes("ASSIGN_PROJECT");

  const startDate = params.startDate
    ? new Date(params.startDate)
    : startOfMonth(new Date());
  const endDate = params.endDate
    ? new Date(params.endDate)
    : endOfMonth(new Date());

  const reportData = await getReportData(
    startDate,
    endDate,
    params.employeeId,
    params.projectId
  );

  const employees = canViewTeamData
    ? reportData.employeeHours.map((employee) => ({
        id: employee.userId,
        name: employee.name,
      }))
    : undefined;

  const projectWhere = buildProjectWhereForViewer({
    userId: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  });

  const projects = await db.project.findMany({
    where: session.user.role === "ADMIN" ? {} : projectWhere,
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            {format(startDate, "MMM d, yyyy")} - {format(endDate, "MMM d, yyyy")}
          </p>
        </div>
        <ExportButton startDate={startDate} endDate={endDate} />
      </div>

      <Suspense fallback={<Skeleton className="h-20" />}>
        <ReportFilters employees={employees} projects={projects} isManager={canViewTeamData} />
      </Suspense>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.totalHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">Hours logged in period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Hours</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.billableHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              {reportData.summary.billablePercentage}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.projectHours.length}</div>
            <p className="text-xs text-muted-foreground">Projects with logged time</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {reportData.dailyTrend.length > 0 && (
          <DailyTrendChart data={reportData.dailyTrend} />
        )}

        {reportData.monthlyData.length > 0 && (
          <MonthlyComparisonChart data={reportData.monthlyData} />
        )}

        {canViewTeamData && reportData.employeeHours.length > 0 && (
          <EmployeeHoursChart data={reportData.employeeHours} />
        )}

        {reportData.projectHours.length > 0 && (
          <ProjectHoursChart data={reportData.projectHours} />
        )}
      </div>

      {/* Data Tables */}
      {canViewTeamData && reportData.employeeHours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Employee Hours Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reportData.employeeHours
                .sort((a, b) => b.hours - a.hours)
                .map((employee) => (
                  <div key={employee.userId} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{employee.name}</p>
                      <p className="text-sm text-muted-foreground">{employee.department || "No department"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{employee.hours.toFixed(1)}h</p>
                      <p className="text-sm text-muted-foreground">
                        {((employee.hours / reportData.summary.totalHours) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {reportData.projectHours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Hours Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reportData.projectHours
                .sort((a, b) => b.hours - a.hours)
                .map((project) => (
                  <div key={project.projectId} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted-foreground">{project.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{project.hours.toFixed(1)}h</p>
                      <p className="text-sm text-muted-foreground">
                        {((project.hours / reportData.summary.totalHours) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

