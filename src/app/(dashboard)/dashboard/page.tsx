import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { EmployeePermissions } from "@/lib/employee-permissions";
import { buildProjectWhereForViewer } from "@/lib/employee-permissions";
import { getCrmAllowedCreatorIds } from "@/lib/crm-record-rules.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FolderKanban, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";
import { SalesMonthlyChart } from "@/components/dashboard/sales-monthly-chart";
import { BestSellerBarChart } from "@/components/dashboard/best-seller-charts";

function isDatabaseConnectionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P1001"
  );
}

async function getDashboardStats(
  userId: string,
  role: string,
  permissions: EmployeePermissions,
  options: {
    showProjectInsights: boolean;
    showTimeInsights: boolean;
    showEmployeeInsights: boolean;
  }
) {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const employeeCount = options.showEmployeeInsights && role === "ADMIN"
      ? await db.user.count({ where: { isActive: true } })
      : null;

    const projectWhere = options.showProjectInsights
      ? buildProjectWhereForViewer({ userId, role, permissions })
      : { id: "__no_access__" };

    const projects = options.showProjectInsights
      ? await db.project.findMany({
          where: projectWhere,
          include: {
            assignments: { include: { user: true } },
          },
        })
      : [];

    const activeProjects = projects.filter(p => p.status === "IN_PROGRESS").length;
    const completedProjects = projects.filter(p => p.status === "COMPLETED").length;
    const onHoldProjects = projects.filter(p => p.status === "ON_HOLD").length;

    const monthlyHours = options.showTimeInsights
      ? await db.timeEntry.aggregate({
          where:
            role === "ADMIN" || permissions.recordRules.includes("RECORD_RULES")
              ? { date: { gte: startOfMonth } }
              : { date: { gte: startOfMonth }, project: projectWhere },
          _sum: { hours: true },
        })
      : null;

    const recentProjects = options.showProjectInsights
      ? await db.project.findMany({
          where: projectWhere,
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: {
            manager: { select: { name: true } },
            assignments: {
              where: { isActive: true },
              include: { user: { select: { name: true } } },
              take: 3,
            },
          },
        })
      : [];

    const upcomingDeadlines = options.showProjectInsights
      ? await db.project.findMany({
          where: {
            ...projectWhere,
            deadline: { gte: today },
            status: { in: ["PLANNING", "IN_PROGRESS"] },
          },
          orderBy: { deadline: "asc" },
          take: 5,
        })
      : [];

    return {
      employeeCount,
      activeProjects,
      completedProjects,
      onHoldProjects,
      totalProjects: projects.length,
      monthlyHours: monthlyHours?._sum.hours || 0,
      recentProjects,
      upcomingDeadlines,
      dbError: null,
    };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.warn("Dashboard stats unavailable due to database connectivity.");
    } else {
      console.warn("Dashboard stats unavailable due to an unexpected data error.");
    }
    return {
      employeeCount: null,
      activeProjects: 0,
      completedProjects: 0,
      onHoldProjects: 0,
      totalProjects: 0,
      monthlyHours: 0,
      recentProjects: [],
      upcomingDeadlines: [],
      dbError: "Unable to connect to the database right now. Please check your DATABASE_URL and Neon connectivity.",
    };
  }
}

async function getSalesDashboardStats(userId: string, role: string, permissions: EmployeePermissions) {
  try {
    const allowedCreatorIds = await getCrmAllowedCreatorIds(userId, role, permissions);
    if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
      return {
        quotationsCount: 0,
        ordersCount: 0,
        revenue: 0,
        averageOrderValue: 0,
        monthlySales: [] as { month: string; revenue: number }[],
        topQuotations: [] as Array<{
          id: string;
          quotationNo: string;
          clientName: string;
          salespersonName: string | null;
          totalAmount: number;
        }>,
        topSalesOrders: [] as Array<{
          id: string;
          quotationNo: string;
          clientName: string;
          salespersonName: string | null;
          totalAmount: number;
        }>,
      };
    }

    const leadFilter =
      allowedCreatorIds === null
        ? {}
        : {
            crmLead: {
              OR: [
                { createdById: { in: allowedCreatorIds } },
                { ownerId: { in: allowedCreatorIds } },
              ],
            },
          };

    const ordersFilter = {
      ...leadFilter,
      status: "SENT" as const,
    };

    const [quotationsCount, ordersCount, revenueAgg, recentOrders, topQuotations, topSalesOrders] =
      await Promise.all([
        db.crmQuotation.count({
          where: leadFilter,
        }),
        db.crmQuotation.count({
          where: ordersFilter,
        }),
        db.crmQuotation.aggregate({
          where: ordersFilter,
          _sum: { totalAmount: true },
        }),
        db.crmQuotation.findMany({
          where: {
            ...ordersFilter,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
            },
          },
          select: {
            createdAt: true,
            totalAmount: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        db.crmQuotation.findMany({
          where: leadFilter,
          select: {
            id: true,
            quotationNo: true,
            clientName: true,
            totalAmount: true,
            createdBy: { select: { name: true } },
          },
          orderBy: { totalAmount: "desc" },
          take: 8,
        }),
        db.crmQuotation.findMany({
          where: ordersFilter,
          select: {
            id: true,
            quotationNo: true,
            clientName: true,
            totalAmount: true,
            createdBy: { select: { name: true } },
          },
          orderBy: { totalAmount: "desc" },
          take: 8,
        }),
      ]);

    const monthlyBuckets = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
      monthlyBuckets.set(format(date, "MMM yyyy"), 0);
    }

    for (const row of recentOrders) {
      const key = format(new Date(row.createdAt), "MMM yyyy");
      if (!monthlyBuckets.has(key)) continue;
      monthlyBuckets.set(key, (monthlyBuckets.get(key) || 0) + Number(row.totalAmount || 0));
    }

    const revenue = Number(revenueAgg._sum.totalAmount || 0);
    const averageOrderValue = ordersCount > 0 ? revenue / ordersCount : 0;

    return {
      quotationsCount,
      ordersCount,
      revenue,
      averageOrderValue,
      monthlySales: Array.from(monthlyBuckets.entries()).map(([month, amount]) => ({
        month,
        revenue: Math.round(amount),
      })),
      topQuotations: topQuotations.map((row) => ({
        id: row.id,
        quotationNo: row.quotationNo,
        clientName: row.clientName,
        salespersonName: row.createdBy?.name ?? null,
        totalAmount: Number(row.totalAmount || 0),
      })),
      topSalesOrders: topSalesOrders.map((row) => ({
        id: row.id,
        quotationNo: row.quotationNo,
        clientName: row.clientName,
        salespersonName: row.createdBy?.name ?? null,
        totalAmount: Number(row.totalAmount || 0),
      })),
    };
  } catch {
    return {
      quotationsCount: 0,
      ordersCount: 0,
      revenue: 0,
      averageOrderValue: 0,
      monthlySales: [] as { month: string; revenue: number }[],
      topQuotations: [] as Array<{
        id: string;
        quotationNo: string;
        clientName: string;
        salespersonName: string | null;
        totalAmount: number;
      }>,
      topSalesOrders: [] as Array<{
        id: string;
        quotationNo: string;
        clientName: string;
        salespersonName: string | null;
        totalAmount: number;
      }>,
    };
  }
}

async function getInvoicingDashboardStats(userId: string, role: string, permissions: EmployeePermissions) {
  try {
    const allowedCreatorIds = await getCrmAllowedCreatorIds(userId, role, permissions);
    if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
      return {
        invoicedAmount: 0,
        averageInvoice: 0,
        dsoDays: 0,
        monthlyInvoiced: [] as { month: string; revenue: number }[],
        topInvoices: [] as Array<{
          id: string;
          reference: string;
          salespersonName: string | null;
          status: "PAID" | "PARTIAL" | "UNPAID";
          clientName: string;
          date: Date;
          amount: number;
        }>,
      };
    }

    const leadFilter =
      allowedCreatorIds === null
        ? {}
        : {
            quotation: {
              crmLead: {
                OR: [
                  { createdById: { in: allowedCreatorIds } },
                  { ownerId: { in: allowedCreatorIds } },
                ],
              },
            },
          };

    const invoices = await db.crmQuotationInvoice.findMany({
      where: leadFilter,
      select: {
        id: true,
        quotationId: true,
        amount: true,
        balanceAmount: true,
        createdAt: true,
        quotation: {
          select: {
            quotationNo: true,
            totalAmount: true,
            clientName: true,
            createdBy: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const invoicedAmount = invoices.reduce(
      (sum, item) => sum + Number(item.quotation.totalAmount || 0),
      0
    );
    const averageInvoice = invoices.length > 0 ? invoicedAmount / invoices.length : 0;

    const now = new Date();
    const unpaidInvoices = invoices.filter((item) => Number(item.balanceAmount || 0) > 0);
    const dsoDays =
      unpaidInvoices.length > 0
        ? Math.round(
            unpaidInvoices.reduce((sum, item) => {
              const diff = now.getTime() - new Date(item.createdAt).getTime();
              return sum + Math.max(0, diff / (1000 * 60 * 60 * 24));
            }, 0) / unpaidInvoices.length
          )
        : 0;

    const monthlyBuckets = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyBuckets.set(format(date, "MMM yyyy"), 0);
    }

    for (const row of invoices) {
      const key = format(new Date(row.createdAt), "MMM yyyy");
      if (!monthlyBuckets.has(key)) continue;
      monthlyBuckets.set(
        key,
        (monthlyBuckets.get(key) || 0) + Number(row.quotation.totalAmount || 0)
      );
    }

    const topInvoices = invoices.slice(0, 10).map((item) => {
      const balance = Number(item.balanceAmount || 0);
      const total = Number(item.quotation.totalAmount || 0);
      const status: "PAID" | "PARTIAL" | "UNPAID" =
        balance <= 0 ? "PAID" : balance < total ? "PARTIAL" : "UNPAID";

      return {
        id: item.id,
        reference: `INV/${item.quotation.quotationNo}`,
        salespersonName: item.quotation.createdBy?.name ?? null,
        status,
        clientName: item.quotation.clientName,
        date: item.createdAt,
        amount: total,
      };
    });

    return {
      invoicedAmount,
      averageInvoice,
      dsoDays,
      monthlyInvoiced: Array.from(monthlyBuckets.entries()).map(([month, amount]) => ({
        month,
        revenue: Math.round(amount),
      })),
      topInvoices,
    };
  } catch {
    return {
      invoicedAmount: 0,
      averageInvoice: 0,
      dsoDays: 0,
      monthlyInvoiced: [] as { month: string; revenue: number }[],
      topInvoices: [] as Array<{
        id: string;
        reference: string;
        salespersonName: string | null;
        status: "PAID" | "PARTIAL" | "UNPAID";
        clientName: string;
        date: Date;
        amount: number;
      }>,
    };
  }
}

async function getExpensesDashboardStats(userId: string, role: string, permissions: EmployeePermissions) {
  try {
    const allowedCreatorIds = await getCrmAllowedCreatorIds(userId, role, permissions);
    if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
      return {
        expensesCount: 0,
        reportAmount: 0,
        validateAmount: 0,
        reimburseAmount: 0,
        monthlyExpenses: [] as { month: string; revenue: number }[],
        topExpenses: [] as Array<{
          id: string;
          expense: string;
          employee: string | null;
          total: number;
        }>,
        topCategories: [] as Array<{
          category: string;
          count: number;
          total: number;
        }>,
      };
    }

    const leadFilter =
      allowedCreatorIds === null
        ? {}
        : {
            quotation: {
              crmLead: {
                OR: [
                  { createdById: { in: allowedCreatorIds } },
                  { ownerId: { in: allowedCreatorIds } },
                ],
              },
            },
          };

    const invoices = await db.crmQuotationInvoice.findMany({
      where: leadFilter,
      select: {
        id: true,
        paymentType: true,
        amount: true,
        balanceAmount: true,
        createdAt: true,
        quotation: {
          select: {
            quotationNo: true,
            totalAmount: true,
            createdBy: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const expensesCount = invoices.length;
    const reportAmount = invoices.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const validateAmount = invoices.reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0);
    const totalInvoiceAmount = invoices.reduce(
      (sum, item) => sum + Number(item.quotation.totalAmount || 0),
      0
    );
    const reimburseAmount = Math.max(totalInvoiceAmount - validateAmount, 0);

    const now = new Date();
    const monthlyBuckets = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyBuckets.set(format(date, "MMM yyyy"), 0);
    }
    for (const row of invoices) {
      const key = format(new Date(row.createdAt), "MMM yyyy");
      if (!monthlyBuckets.has(key)) continue;
      monthlyBuckets.set(key, (monthlyBuckets.get(key) || 0) + Number(row.amount || 0));
    }

    const topExpenses = invoices.slice(0, 10).map((row) => ({
      id: row.id,
      expense: `EXP/${row.quotation.quotationNo}`,
      employee: row.quotation.createdBy?.name ?? null,
      total: Number(row.amount || 0),
    }));

    const categoryMap = new Map<string, { count: number; total: number }>();
    for (const row of invoices) {
      const key = row.paymentType || "OTHER";
      const current = categoryMap.get(key) ?? { count: 0, total: 0 };
      categoryMap.set(key, {
        count: current.count + 1,
        total: current.total + Number(row.amount || 0),
      });
    }
    const topCategories = Array.from(categoryMap.entries())
      .map(([category, value]) => ({
        category,
        count: value.count,
        total: value.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      expensesCount,
      reportAmount,
      validateAmount,
      reimburseAmount,
      monthlyExpenses: Array.from(monthlyBuckets.entries()).map(([month, amount]) => ({
        month,
        revenue: Math.round(amount),
      })),
      topExpenses,
      topCategories,
    };
  } catch {
    return {
      expensesCount: 0,
      reportAmount: 0,
      validateAmount: 0,
      reimburseAmount: 0,
      monthlyExpenses: [] as { month: string; revenue: number }[],
      topExpenses: [] as Array<{
        id: string;
        expense: string;
        employee: string | null;
        total: number;
      }>,
      topCategories: [] as Array<{
        category: string;
        count: number;
        total: number;
      }>,
    };
  }
}

async function getProjectProductDashboardStats(
  userId: string,
  role: string,
  permissions: EmployeePermissions
) {
  try {
    const allowedCreatorIds = await getCrmAllowedCreatorIds(userId, role, permissions);
    if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
      return {
        topBestSeller: "-",
        topBestSellerSold: 0,
        topBestCategory: "-",
        topBestCategorySold: 0,
        bestSellerRevenue: [] as Array<{ name: string; value: number }>,
        bestSellerUnits: [] as Array<{ name: string; value: number }>,
      };
    }

    const leadFilter =
      allowedCreatorIds === null
        ? {}
        : {
            crmLead: {
              OR: [
                { createdById: { in: allowedCreatorIds } },
                { ownerId: { in: allowedCreatorIds } },
              ],
            },
          };

    const rows = await db.crmQuotation.findMany({
      where: {
        ...leadFilter,
        status: "SENT",
      },
      select: {
        projectTitle: true,
        serviceName: true,
        totalAmount: true,
        unitCount: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const sellerMap = new Map<string, { sold: number; revenue: number }>();
    const categoryMap = new Map<string, { sold: number }>();

    for (const row of rows) {
      const sellerName = row.projectTitle?.trim() || "Unknown";
      const category = row.serviceName?.trim() || "All";
      const sold = Number(row.unitCount || 0);
      const revenue = Number(row.totalAmount || 0);

      const sellerCurrent = sellerMap.get(sellerName) ?? { sold: 0, revenue: 0 };
      sellerMap.set(sellerName, {
        sold: sellerCurrent.sold + sold,
        revenue: sellerCurrent.revenue + revenue,
      });

      const categoryCurrent = categoryMap.get(category) ?? { sold: 0 };
      categoryMap.set(category, {
        sold: categoryCurrent.sold + sold,
      });
    }

    const sellers = Array.from(sellerMap.entries())
      .map(([name, value]) => ({
        name,
        sold: value.sold,
        revenue: value.revenue,
      }))
      .sort((a, b) => b.sold - a.sold);

    const categories = Array.from(categoryMap.entries())
      .map(([name, value]) => ({
        name,
        sold: value.sold,
      }))
      .sort((a, b) => b.sold - a.sold);

    const shorten = (text: string) => (text.length > 28 ? `${text.slice(0, 28)}...` : text);

    return {
      topBestSeller: sellers[0]?.name ?? "-",
      topBestSellerSold: sellers[0]?.sold ?? 0,
      topBestCategory: categories[0]?.name ?? "-",
      topBestCategorySold: categories[0]?.sold ?? 0,
      bestSellerRevenue: sellers.slice(0, 8).map((item) => ({
        name: shorten(item.name),
        value: Math.round(item.revenue),
      })),
      bestSellerUnits: sellers.slice(0, 8).map((item) => ({
        name: shorten(item.name),
        value: item.sold,
      })),
    };
  } catch {
    return {
      topBestSeller: "-",
      topBestSellerSold: 0,
      topBestCategory: "-",
      topBestCategorySold: 0,
      bestSellerRevenue: [] as Array<{ name: string; value: number }>,
      bestSellerUnits: [] as Array<{ name: string; value: number }>,
    };
  }
}

interface DashboardPageProps {
  searchParams?: Promise<{ panel?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user) return null;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedPanel = (resolvedSearchParams.panel || "").toLowerCase();
  const isAdmin = session.user.role === "ADMIN";
  const permissions = session.user.permissions;
  const hasProjectAccess = isAdmin || permissions.moduleAccess.includes("PROJECT");
  const hasSalesAccess = isAdmin || permissions.moduleAccess.includes("SALES");
  const allowedPanels = [
    ...(hasProjectAccess ? ["projects"] : []),
    ...(hasSalesAccess ? ["sales", "invoicing", "expenses"] : []),
  ];
  const currentPanel =
    allowedPanels.find((panel) => panel === requestedPanel) ||
    allowedPanels[0] ||
    "projects";
  const showProjectSection = hasProjectAccess && currentPanel === "projects";
  const showSalesSection = hasSalesAccess && currentPanel === "sales";
  const showInvoicingSection = hasSalesAccess && currentPanel === "invoicing";
  const showExpensesSection = hasSalesAccess && currentPanel === "expenses";
  const showProjectMetrics = false;
  const showProjectsPanel = showProjectSection;

  const stats = await getDashboardStats(
    session.user.id,
    session.user.role,
    session.user.permissions,
    {
      showProjectInsights: hasProjectAccess,
      showTimeInsights: hasProjectAccess,
      showEmployeeInsights: isAdmin,
    }
  );
  const salesStats = hasSalesAccess
    ? await getSalesDashboardStats(session.user.id, session.user.role, session.user.permissions)
    : null;
  const invoicingStats = showInvoicingSection
    ? await getInvoicingDashboardStats(session.user.id, session.user.role, session.user.permissions)
    : null;
  const expensesStats = showExpensesSection
    ? await getExpensesDashboardStats(session.user.id, session.user.role, session.user.permissions)
    : null;
  const projectProductStats = showProjectsPanel
    ? await getProjectProductDashboardStats(session.user.id, session.user.role, session.user.permissions)
    : null;
  const inrCurrency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-r from-card via-card to-muted/80 p-5 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.45)] dark:shadow-[0_28px_70px_-38px_rgba(2,6,23,0.9)]">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back!
        </p>
      </div>

      {stats.dbError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">{stats.dbError}</p>
            <p className="text-sm text-muted-foreground mt-1">
              If your Neon project is paused or unreachable, restore connectivity and refresh.
            </p>
          </CardContent>
        </Card>
      )}

      {showProjectMetrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.employeeCount !== null && (
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.employeeCount}</div>
                <p className="text-xs text-muted-foreground">Active employees</p>
              </CardContent>
            </Card>
          )}

          {hasProjectAccess && (
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeProjects}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.onHoldProjects} on hold, {stats.completedProjects} completed
                </p>
              </CardContent>
            </Card>
          )}

          {hasProjectAccess && (
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hours This Month</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.monthlyHours.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Total logged hours</p>
              </CardContent>
            </Card>
          )}

          {hasProjectAccess && (
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalProjects > 0
                    ? Math.round((stats.completedProjects / stats.totalProjects) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.completedProjects} of {stats.totalProjects} projects
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {showSalesSection && salesStats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Quotations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salesStats.quotationsCount}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salesStats.ordersCount}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inrCurrency.format(salesStats.revenue)}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {inrCurrency.format(salesStats.averageOrderValue)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
            <CardHeader>
              <CardTitle>Monthly Sales Graph</CardTitle>
              <CardDescription>Revenue trend for the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesMonthlyChart data={salesStats.monthlySales} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Quotations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/45 p-3">
                  {salesStats.topQuotations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No quotations available</p>
                  ) : (
                    salesStats.topQuotations.map((item) => (
                      <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="text-sm font-medium">{item.quotationNo}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.clientName} - {item.salespersonName || "Unassigned"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">{inrCurrency.format(item.totalAmount)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Sales Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/45 p-3">
                  {salesStats.topSalesOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sales orders available</p>
                  ) : (
                    salesStats.topSalesOrders.map((item) => (
                      <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="text-sm font-medium">{item.quotationNo}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.clientName} - {item.salespersonName || "Unassigned"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">{inrCurrency.format(item.totalAmount)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {showInvoicingSection && invoicingStats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Invoiced</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {inrCurrency.format(invoicingStats.invoicedAmount)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {inrCurrency.format(invoicingStats.averageInvoice)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">DSO (Days Sales Outstanding)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invoicingStats.dsoDays} days</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
            <CardHeader>
              <CardTitle>Invoiced by Month</CardTitle>
              <CardDescription>Invoice totals for the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesMonthlyChart data={invoicingStats.monthlyInvoiced} />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
            <CardHeader>
              <CardTitle>Top Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoicingStats.topInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-2">Reference</th>
                        <th className="p-2">Salesperson</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Customer</th>
                        <th className="p-2">Date</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicingStats.topInvoices.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="p-2 font-medium">{item.reference}</td>
                          <td className="p-2">{item.salespersonName || "Unassigned"}</td>
                          <td className="p-2">
                            <Badge variant="outline">{item.status}</Badge>
                          </td>
                          <td className="p-2">{item.clientName}</td>
                          <td className="p-2">{format(new Date(item.date), "MM/dd/yyyy")}</td>
                          <td className="p-2 text-right font-semibold">
                            {inrCurrency.format(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {showExpensesSection && expensesStats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expensesStats.expensesCount}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inrCurrency.format(expensesStats.reportAmount)}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Validate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inrCurrency.format(expensesStats.validateAmount)}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Reimburse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inrCurrency.format(expensesStats.reimburseAmount)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
            <CardHeader>
              <CardTitle>Expenses Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesMonthlyChart data={expensesStats.monthlyExpenses} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                {expensesStats.topExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expenses available</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-2">Expense</th>
                          <th className="p-2">Employee</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expensesStats.topExpenses.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="p-2 font-medium">{item.expense}</td>
                            <td className="p-2">{item.employee || "Unassigned"}</td>
                            <td className="p-2 text-right font-semibold">
                              {inrCurrency.format(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Category</CardTitle>
              </CardHeader>
              <CardContent>
                {expensesStats.topCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categories available</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-2">Category</th>
                          <th className="p-2 text-right"># Expenses</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expensesStats.topCategories.map((item) => (
                          <tr key={item.category} className="border-b last:border-0">
                            <td className="p-2 font-medium">{item.category}</td>
                            <td className="p-2 text-right">{item.count}</td>
                            <td className="p-2 text-right font-semibold">
                              {inrCurrency.format(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {showProjectsPanel && projectProductStats && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader>
                <CardTitle>Top Best Seller</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold md:text-[2rem]">{projectProductStats.topBestSeller}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {projectProductStats.topBestSellerSold} sold
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
              <CardHeader>
                <CardTitle>Top Best Category</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold md:text-[2rem]">{projectProductStats.topBestCategory}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {projectProductStats.topBestCategorySold} sold
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
            <CardHeader>
              <CardTitle>Best Seller Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <BestSellerBarChart
                data={projectProductStats.bestSellerRevenue}
                valueLabel="Revenue"
              />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
            <CardHeader>
              <CardTitle>Best Sellers by Units Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <BestSellerBarChart
                data={projectProductStats.bestSellerUnits}
                valueLabel="Units Sold"
                color="#2563eb"
              />
            </CardContent>
          </Card>
        </>
      )}

    </div>
  );
}

