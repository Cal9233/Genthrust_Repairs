import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "../hooks/useROs";
import { ROTable } from "./ROTable";
import {
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
  Wrench,
  Truck,
  Calendar,
  AlertOctagon,
  TrendingUp,
  DollarSign,
  RotateCcw,
  XCircle,
  XOctagon,
  Receipt,
  ChevronDown,
  Trash2,
} from "lucide-react";

export function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

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
      title: "ACTIVE ROS",
      value: stats.totalActive,
      icon: Package,
      iconColor: "text-bright-blue",
      iconBg: "bg-bright-blue/20",
      borderColor: "border-l-bright-blue",
      bgGradient: "bg-card-blue",
      shadow: "shadow-[0_2px_8px_rgba(2,132,199,0.12)]",
    },
    {
      title: "OVERDUE",
      value: stats.overdue,
      icon: AlertTriangle,
      iconColor: "text-danger",
      iconBg: "bg-danger/20",
      borderColor: "border-l-danger",
      bgGradient: "bg-card-red",
      shadow: "shadow-[0_2px_8px_rgba(239,68,68,0.12)]",
      alert: stats.overdue > 0,
      alertColor: "text-danger",
    },
    {
      title: "WAITING QUOTE",
      value: stats.waitingQuote,
      icon: Clock,
      iconColor: "text-warning",
      iconBg: "bg-warning/20",
      borderColor: "border-l-warning",
      bgGradient: "bg-card-amber",
      shadow: "shadow-[0_2px_8px_rgba(245,158,11,0.12)]",
    },
    {
      title: "APPROVED",
      value: stats.approved,
      icon: CheckCircle,
      iconColor: "text-success",
      iconBg: "bg-success/20",
      borderColor: "border-l-success",
      bgGradient: "bg-card-green",
      shadow: "shadow-[0_2px_8px_rgba(16,185,129,0.12)]",
    },
    {
      title: "BEING REPAIRED",
      value: stats.beingRepaired,
      icon: Wrench,
      iconColor: "text-[#8b5cf6]",
      iconBg: "bg-[#8b5cf6]/20",
      borderColor: "border-l-[#8b5cf6]",
      bgGradient: "bg-card-purple",
      shadow: "shadow-[0_2px_8px_rgba(139,92,246,0.12)]",
    },
    {
      title: "SHIPPING",
      value: stats.shipping,
      icon: Truck,
      iconColor: "text-electric",
      iconBg: "bg-electric/20",
      borderColor: "border-l-electric",
      bgGradient: "bg-card-cyan",
      shadow: "shadow-[0_2px_8px_rgba(6,182,212,0.12)]",
    },
    {
      title: "DUE TODAY",
      value: stats.dueToday,
      icon: Calendar,
      iconColor: "text-warning",
      iconBg: "bg-warning/20",
      borderColor: "border-l-warning",
      bgGradient: "bg-card-amber",
      shadow: "shadow-[0_2px_8px_rgba(245,158,11,0.12)]",
      alert: stats.dueToday > 0,
      alertColor: "text-warning",
    },
    {
      title: "OVERDUE 30+ DAYS",
      value: stats.overdue30Plus,
      icon: AlertOctagon,
      iconColor: "text-danger",
      iconBg: "bg-danger/20",
      borderColor: "border-l-danger",
      bgGradient: "bg-card-red",
      shadow: "shadow-[0_2px_8px_rgba(239,68,68,0.12)]",
      alert: stats.overdue30Plus > 0,
      alertColor: "text-danger",
    },
    {
      title: "ON TRACK",
      value: stats.onTrack,
      icon: TrendingUp,
      iconColor: "text-success",
      iconBg: "bg-success/20",
      borderColor: "border-l-success",
      bgGradient: "bg-card-green",
      shadow: "shadow-[0_2px_8px_rgba(16,185,129,0.12)]",
    },
    {
      title: "APPROVED PAID",
      value: stats.approvedPaid,
      icon: DollarSign,
      iconColor: "text-success",
      iconBg: "bg-success/20",
      borderColor: "border-l-success",
      bgGradient: "bg-card-green",
      shadow: "shadow-[0_2px_8px_rgba(16,185,129,0.12)]",
    },
    {
      title: "RAI (RETURN AS IS)",
      value: stats.rai,
      icon: RotateCcw,
      iconColor: "text-[#f97316]",
      iconBg: "bg-[#f97316]/20",
      borderColor: "border-l-[#f97316]",
      bgGradient: "bg-card-amber",
      shadow: "shadow-[0_2px_8px_rgba(249,115,22,0.12)]",
    },
    {
      title: "BER",
      value: stats.ber,
      icon: XCircle,
      iconColor: "text-danger",
      iconBg: "bg-danger/20",
      borderColor: "border-l-danger",
      bgGradient: "bg-card-red",
      shadow: "shadow-[0_2px_8px_rgba(239,68,68,0.12)]",
    },
    {
      title: "SCRAPPED",
      value: stats.scrapped,
      icon: Trash2,
      iconColor: "text-amber-700",
      iconBg: "bg-amber-500/20",
      borderColor: "border-l-amber-500",
      bgGradient: "bg-card-amber",
      shadow: "shadow-[0_2px_8px_rgba(245,158,11,0.12)]",
    },
    {
      title: "CANCELLED",
      value: stats.cancel,
      icon: XOctagon,
      iconColor: "text-slate-500",
      iconBg: "bg-slate-500/20",
      borderColor: "border-l-slate-500",
      bgGradient: "bg-secondary",
      shadow: "shadow-[0_2px_8px_rgba(100,116,139,0.12)]",
    },
    {
      title: "APPROVED NET",
      value: stats.approvedNet,
      icon: Receipt,
      iconColor: "text-bright-blue",
      iconBg: "bg-bright-blue/20",
      borderColor: "border-l-bright-blue",
      bgGradient: "bg-card-blue",
      shadow: "shadow-[0_2px_8px_rgba(2,132,199,0.12)]",
    },
  ];

  // Top 3 priority status cards
  const priorityStatCards = [
    statCards[0],  // ACTIVE ROS
    statCards[1],  // OVERDUE
    statCards[8],  // ON TRACK
  ];

  // Remaining status cards for collapsible section
  const additionalStatCards = [
    statCards[2],  // WAITING QUOTE
    statCards[3],  // APPROVED
    statCards[4],  // BEING REPAIRED
    statCards[5],  // SHIPPING
    statCards[6],  // DUE TODAY
    statCards[7],  // OVERDUE 30+ DAYS
    statCards[9],  // APPROVED PAID
    statCards[10], // RAI
    statCards[11], // BER
    statCards[12], // CANCELLED
    statCards[13], // APPROVED NET
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Total Value Cards - Keep these */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Combined Total Value */}
        <div className="bg-gradient-value px-4 sm:px-5 md:px-6 py-4 sm:py-5 rounded-xl shadow-[0_8px_24px_rgba(6,182,212,0.25)] animate-shimmer bg-[length:200%_200%]">
          <div className="text-[10px] sm:text-[11px] font-semibold text-white/90 uppercase tracking-wider">
            TOTAL VALUE
          </div>
          <div className="text-2xl sm:text-3xl md:text-display text-white mt-1 font-bold">
            {formatCurrency(stats.totalValue)}
          </div>
        </div>

        {/* Estimated Value */}
        <div className="bg-gradient-to-br from-[#f59e0b] to-[#d97706] px-4 sm:px-5 md:px-6 py-4 sm:py-5 rounded-xl shadow-[0_8px_24px_rgba(245,158,11,0.25)]">
          <div className="text-[10px] sm:text-[11px] font-semibold text-white/90 uppercase tracking-wider">
            ESTIMATED VALUE
          </div>
          <div className="text-2xl sm:text-3xl md:text-display text-white mt-1 font-bold">
            {formatCurrency(stats.totalEstimatedValue)}
          </div>
        </div>

        {/* Final/Repaired Value */}
        <div className="bg-gradient-to-br from-[#10b981] to-[#059669] px-4 sm:px-5 md:px-6 py-4 sm:py-5 rounded-xl shadow-[0_8px_24px_rgba(16,185,129,0.25)]">
          <div className="text-[10px] sm:text-[11px] font-semibold text-white/90 uppercase tracking-wider">
            FINAL VALUE
          </div>
          <div className="text-2xl sm:text-3xl md:text-display text-white mt-1 font-bold">
            {formatCurrency(stats.totalFinalValue)}
          </div>
        </div>
      </div>

      {/* Top 3 Priority Status Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {priorityStatCards.map((stat) => (
          <Card
            key={stat.title}
            className={`${stat.bgGradient} border-l-[4px] sm:border-l-[5px] ${stat.borderColor} border-t border-r border-b border-border ${stat.shadow} lift-on-hover rounded-xl`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
              <CardTitle className="text-[11px] sm:text-[12px] md:text-[13px] font-semibold text-slate-600 dark:text-muted-foreground uppercase tracking-wider">
                {stat.title}
              </CardTitle>
              <div className={`${stat.iconBg} p-2 sm:p-2.5 md:p-3 rounded-full`}>
                <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 ${stat.iconColor}`} strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-[28px] sm:text-[32px] md:text-[36px] font-bold text-slate-900 dark:text-foreground leading-none">
                {stat.value}
              </div>
              {stat.alert && (
                <div className={`mt-2 sm:mt-3 text-[11px] sm:text-[12px] md:text-[13px] font-semibold ${stat.alertColor} flex items-center gap-1.5`}>
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Requires attention
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Repair Orders Table - MAIN FOCUS */}
      <div className="bg-background rounded-xl shadow-vibrant-lg border border-border p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">
          Repair Orders
        </h2>
        <ROTable />
      </div>

      {/* Collapsible Additional Statistics Section */}
      <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
        <Card className="bg-background border border-border rounded-xl shadow-vibrant-lg">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-colors"
              aria-label={isStatsExpanded ? "Collapse additional statistics" : "Expand additional statistics"}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Additional Statistics</span>
                <span className="text-xs text-muted-foreground">
                  ({additionalStatCards.length} more metrics)
                </span>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                  isStatsExpanded ? "rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {additionalStatCards.map((stat) => (
                  <Card
                    key={stat.title}
                    className={`${stat.bgGradient} border-l-[4px] ${stat.borderColor} border-t border-r border-b border-border ${stat.shadow} rounded-lg`}
                  >
                    <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
                      <CardTitle className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-muted-foreground uppercase tracking-wider">
                        {stat.title}
                      </CardTitle>
                      <div className={`${stat.iconBg} p-2 rounded-full`}>
                        <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} strokeWidth={2.5} />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-[24px] sm:text-[28px] font-bold text-slate-900 dark:text-foreground leading-none">
                        {stat.value}
                      </div>
                      {stat.alert && (
                        <div className={`mt-2 text-[10px] sm:text-[11px] font-semibold ${stat.alertColor} flex items-center gap-1`}>
                          <AlertTriangle className="h-3 w-3" />
                          Requires attention
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
