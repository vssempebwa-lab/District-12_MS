"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthPoint } from "@/lib/data";
import { expenseBreakdown } from "@/lib/data";
import { formatUGX } from "@/lib/format";

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card p-2.5 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-semibold text-foreground">
            {formatUGX(Number(entry.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function GroupTrendChart({
  data,
  height = 250,
}: {
  data: MonthPoint[];
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C81E1E" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#C81E1E" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e7e7" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            dy={6}
          />
          <YAxis
            tickFormatter={(value) => `${(Number(value) / 1e9).toFixed(1)}B`}
            tickLine={false}
            axisLine={false}
            width={38}
            tick={{ fontSize: 11, fill: "#6b7280" }}
          />
          <Tooltip content={<MoneyTooltip />} cursor={{ stroke: "#d6d3d1" }} />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#C81E1E"
            strokeWidth={2}
            fill="url(#revenueFill)"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke="#1F2937"
            strokeWidth={2}
            strokeDasharray="4 3"
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompanyRevenueChart({
  data,
  height = 250,
}: {
  data: Array<{ name: string; revenue: number; color?: string }>;
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#5b6472" }}
            dy={6}
          />
          <YAxis
            tickFormatter={(value) => `${(Number(value) / 1e9).toFixed(1)}B`}
            tickLine={false}
            axisLine={false}
            width={38}
            tick={{ fontSize: 11, fill: "#5b6472" }}
          />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#f3f4f6" }} />
          <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={38}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color ?? "#C81E1E"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseDonut({ height = 220 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={expenseBreakdown}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {expenseBreakdown.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string) => `${value}%`}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
