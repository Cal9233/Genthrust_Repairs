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
      bgColor: "bg-blue-50",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      borderColor: "border-blue-200",
    },
    {
      title: "Overdue",
      value: stats.overdue,
      icon: AlertTriangle,
      bgColor: stats.overdue > 0 ? "bg-red-50" : "bg-gray-50",
      iconBg: stats.overdue > 0 ? "bg-red-100" : "bg-gray-100",
      iconColor: stats.overdue > 0 ? "text-red-600" : "text-gray-600",
      borderColor: stats.overdue > 0 ? "border-red-200" : "border-gray-200",
      alert: stats.overdue > 0,
    },
    {
      title: "Waiting Quote",
      value: stats.waitingQuote,
      icon: Clock,
      bgColor: "bg-yellow-50",
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      borderColor: "border-yellow-200",
    },
    {
      title: "Approved",
      value: stats.approved,
      icon: CheckCircle,
      bgColor: "bg-green-50",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      borderColor: "border-green-200",
    },
    {
      title: "Being Repaired",
      value: stats.beingRepaired,
      icon: Wrench,
      bgColor: "bg-purple-50",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      borderColor: "border-purple-200",
    },
    {
      title: "Shipping",
      value: stats.shipping,
      icon: Truck,
      bgColor: "bg-cyan-50",
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-600",
      borderColor: "border-cyan-200",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">
            Overview of all repair orders
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 px-6 py-4 rounded-xl border border-blue-200">
          <div className="text-xs font-medium text-blue-700 uppercase tracking-wide">
            Total Value
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-1">
            {formatCurrency(stats.totalValue)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={`${stat.bgColor} ${stat.borderColor} border-2 hover:shadow-md transition-shadow duration-200`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                {stat.title}
              </CardTitle>
              <div className={`${stat.iconBg} p-2 rounded-lg`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {stat.value}
              </div>
              {stat.alert && (
                <div className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Requires attention
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
