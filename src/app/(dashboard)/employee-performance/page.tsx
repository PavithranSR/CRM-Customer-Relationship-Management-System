import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmployeePerformanceListShell } from "@/components/employee-performance/employee-performance-list-shell";

export default async function EmployeePerformancePage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <EmployeePerformanceListShell />;
}
