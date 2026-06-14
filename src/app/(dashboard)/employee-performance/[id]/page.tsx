import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmployeePerformanceDetailShell } from "@/components/employee-performance/employee-performance-detail-shell";

interface EmployeePerformanceDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EmployeePerformanceDetailPage({
  params,
}: EmployeePerformanceDetailPageProps) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { id } = await params;

  return <EmployeePerformanceDetailShell employeeId={id} />;
}
