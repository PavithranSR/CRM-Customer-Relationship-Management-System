"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SalesMonthlyChartPoint {
  month: string;
  revenue: number;
}

interface SalesMonthlyChartProps {
  data: SalesMonthlyChartPoint[];
}

export function SalesMonthlyChart({ data }: SalesMonthlyChartProps) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="color-mix(in srgb, var(--border) 80%, transparent)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={{ stroke: "var(--border)" }}
          />
          <Tooltip
            formatter={(value) => [
              new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }).format(Number(value ?? 0)),
              "Revenue",
            ]}
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              boxShadow: "0 20px 40px -28px rgba(15,23,42,0.55)",
            }}
            labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600 }}
            itemStyle={{ color: "var(--popover-foreground)" }}
            cursor={{ stroke: "color-mix(in srgb, var(--primary) 35%, transparent)", strokeWidth: 1.5 }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={{ fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

