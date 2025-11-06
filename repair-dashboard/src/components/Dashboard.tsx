import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "../hooks/useROs";
import {
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
  Wrench,
  Truck,
} from "lucide-react";

export function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (!stats) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statCards = [
    {
      title: "Active ROs",
      value: stats.totalActive,
      icon: Package,
      color: "text-blue-600",
    },
    {
      title: "Overdue",
      value: stats.overdue,
      icon: AlertTriangle,
      color: "text-red-600",
      alert: stats.overdue > 0,
    },
    {
      title: "Waiting Quote",
      value: stats.waitingQuote,
      icon: Clock,
      color: "text-yellow-600",
    },
    {
      title: "Approved",
      value: stats.approved,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      title: "Being Repaired",
      value: stats.beingRepaired,
      icon: Wrench,
      color: "text-purple-600",
    },
    {
      title: "Shipping",
      value: stats.shipping,
      icon: Truck,
      color: "text-cyan-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <div className="text-sm text-muted-foreground">
          Total Value:{" "}
          <span className="font-semibold">
            {formatCurrency(stats.totalValue)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={stat.alert ? "border-red-300 bg-red-50" : ""}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
