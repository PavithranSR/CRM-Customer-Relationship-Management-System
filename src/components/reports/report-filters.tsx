"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

interface ReportFiltersProps {
  employees?: { id: string; name: string }[];
  projects?: { id: string; name: string }[];
  isManager: boolean;
}

export function ReportFilters({ employees, projects, isManager }: ReportFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStartDate = searchParams.get("startDate") || format(startOfMonth(new Date()), "yyyy-MM-dd");
  const currentEndDate = searchParams.get("endDate") || format(endOfMonth(new Date()), "yyyy-MM-dd");
  const currentEmployee = searchParams.get("employeeId") || "";
  const currentProject = searchParams.get("projectId") || "";

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/reports?${params.toString()}`);
  };

  const setPreset = (preset: "thisMonth" | "lastMonth" | "last3Months") => {
    const params = new URLSearchParams(searchParams.toString());
    let start: Date;
    let end: Date;

    switch (preset) {
      case "thisMonth":
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
        break;
      case "lastMonth":
        start = startOfMonth(subMonths(new Date(), 1));
        end = endOfMonth(subMonths(new Date(), 1));
        break;
      case "last3Months":
        start = startOfMonth(subMonths(new Date(), 2));
        end = endOfMonth(new Date());
        break;
    }

    params.set("startDate", format(start, "yyyy-MM-dd"));
    params.set("endDate", format(end, "yyyy-MM-dd"));
    router.push(`/reports?${params.toString()}`);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={currentStartDate}
              onChange={(e) => updateFilters("startDate", e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={currentEndDate}
              onChange={(e) => updateFilters("endDate", e.target.value)}
              className="w-40"
            />
          </div>

          {isManager && employees && (
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={currentEmployee || "all"} onValueChange={(v) => updateFilters("employeeId", v === "all" ? "" : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {projects && (
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={currentProject || "all"} onValueChange={(v) => updateFilters("projectId", v === "all" ? "" : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreset("thisMonth")}>
              This Month
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset("lastMonth")}>
              Last Month
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset("last3Months")}>
              Last 3 Months
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
