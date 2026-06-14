"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartRow {
  name: string;
  value: number;
}

interface BestSellerChartProps {
  data: ChartRow[];
  color?: string;
  valueLabel: string;
}

export function BestSellerBarChart({
  data,
  color = "var(--primary)",
  valueLabel,
}: BestSellerChartProps) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="color-mix(in srgb, var(--border) 80%, transparent)" strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            angle={-20}
            textAnchor="end"
            height={70}
            interval={0}
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
            formatter={(value) => [Number(value ?? 0), valueLabel]}
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              boxShadow: "0 20px 40px -28px rgba(15,23,42,0.55)",
            }}
            labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600 }}
            itemStyle={{ color: "var(--popover-foreground)" }}
            cursor={{ fill: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

