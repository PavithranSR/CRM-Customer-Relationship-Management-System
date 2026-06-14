"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  EmployeePerformanceChartDatum,
  EmployeePerformanceRevenueTrendDatum,
  EmployeePerformanceTaskBarDatum,
  EmployeePerformanceTrendDatum,
} from "@/lib/employee-performance-types";

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "color-mix(in srgb, var(--secondary) 84%, white)",
  "color-mix(in srgb, var(--danger) 84%, white)",
  "color-mix(in srgb, var(--warning) 84%, white)",
];

interface EmptyChartProps {
  title: string;
  message: string;
}

function EmptyChart({ title, message }: EmptyChartProps) {
  return (
      <Card className="border-border/70 bg-card/95 shadow-[var(--shadow-lg)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground">
          {message}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployeeTaskCompletionChart({
  data,
}: {
  data: EmployeePerformanceTaskBarDatum[];
}) {
  if (data.length === 0) {
    return <EmptyChart title="Tasks Completed" message="No task data is available for this range." />;
  }

  return (
      <Card className="border-border/70 bg-card/95 shadow-[var(--shadow-lg)]">
      <CardHeader>
        <CardTitle>Tasks Completed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid
                stroke="color-mix(in srgb, var(--border) 80%, transparent)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                  background: "var(--card)",
                }}
              />
              <Legend />
              <Bar dataKey="completed" name="Completed" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="pending" name="Pending" fill="var(--chart-3)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployeePerformanceTrendChart({
  data,
}: {
  data: EmployeePerformanceTrendDatum[];
}) {
  if (data.length === 0) {
    return <EmptyChart title="Performance Over Time" message="No timeline data is available for this range." />;
  }

  return (
      <Card className="border-border/70 bg-card/95 shadow-[var(--shadow-lg)]">
      <CardHeader>
        <CardTitle>Performance Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid
                stroke="color-mix(in srgb, var(--border) 80%, transparent)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(value, name) => [
                  name === "hours" ? `${Number(value).toFixed(1)}h` : value,
                  name === "hours" ? "Hours" : "Tasks Completed",
                ]}
                contentStyle={{
                  borderRadius: 16,
                  borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                  background: "var(--card)",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="hours"
                name="Hours"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--chart-1)" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="tasksCompleted"
                name="Tasks Completed"
                stroke="var(--chart-2)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--chart-2)" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployeeProjectContributionChart({
  data,
}: {
  data: EmployeePerformanceChartDatum[];
}) {
  if (data.length === 0) {
    return <EmptyChart title="Project Contribution" message="No project contribution is available yet." />;
  }

  return (
      <Card className="border-border/70 bg-card/95 shadow-[var(--shadow-lg)]">
      <CardHeader>
        <CardTitle>Project Contribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={58}
                outerRadius={102}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`${entry.label}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [
                  new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(Number(value) || 0),
                  "Contribution",
                ]}
                contentStyle={{
                  borderRadius: 16,
                  borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                  background: "var(--card)",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployeeRevenueTrendChart({
  data,
}: {
  data: EmployeePerformanceRevenueTrendDatum[];
}) {
  if (data.length === 0) {
    return <EmptyChart title="Revenue Trend" message="Revenue trend will appear once work and project value data overlap." />;
  }

  return (
      <Card className="border-border/70 bg-card/95 shadow-[var(--shadow-lg)]">
      <CardHeader>
        <CardTitle>Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid
                stroke="color-mix(in srgb, var(--border) 80%, transparent)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(value) => [
                  new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(Number(value) || 0),
                  "Revenue",
                ]}
                contentStyle={{
                  borderRadius: 16,
                  borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                  background: "var(--card)",
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="var(--chart-4)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--chart-4)" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
