import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEmployeePerformanceListData } from "@/lib/employee-performance";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const payload = await getEmployeePerformanceListData();
  return NextResponse.json(payload);
}
