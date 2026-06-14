import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getEmployeePerformanceDetailData,
  parseEmployeePerformanceReferenceDate,
  parseEmployeePerformanceRange,
} from "@/lib/employee-performance";

interface EmployeePerformanceRouteContext {
  params: Promise<{
    employeeId: string;
  }>;
}

export async function GET(request: NextRequest, context: EmployeePerformanceRouteContext) {
  const session = await auth();

  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { employeeId } = await context.params;
  const range = parseEmployeePerformanceRange(request.nextUrl.searchParams.get("range"));
  const referenceDate = parseEmployeePerformanceReferenceDate(request.nextUrl.searchParams.get("date"));
  const payload = await getEmployeePerformanceDetailData(employeeId, range, referenceDate);

  if (!payload) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.json(payload);
}
