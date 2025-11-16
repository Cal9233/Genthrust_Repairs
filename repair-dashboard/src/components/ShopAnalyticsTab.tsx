import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, TrendingUp, TrendingDown, Minus, BarChart3, Clock, Package, Calendar } from 'lucide-react';
import { useROs } from '../hooks/useROs';
import { buildShopAnalytics, predictCompletion, type ShopAnalyticsProfile } from '../services/analyticsEngine';
import type { RepairOrder } from '../types';

export function ShopAnalyticsTab() {
  const { data: repairOrders, isLoading } = useROs();
  const [expandedShop, setExpandedShop] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!repairOrders || repairOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Shop Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No repair orders available for analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const profiles = buildShopAnalytics(repairOrders);
  const profileArray = Array.from(profiles.values()).sort(
    (a, b) => b.activeROs.length - a.activeROs.length
  );

  const getTrendIcon = (trend: ShopAnalyticsProfile['trend']) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTrendText = (trend: ShopAnalyticsProfile['trend']) => {
    switch (trend) {
      case 'improving':
        return 'Improving';
      case 'declining':
        return 'Declining';
      default:
        return 'Stable';
    }
  };

  const getTrendColor = (trend: ShopAnalyticsProfile['trend']) => {
    switch (trend) {
      case 'improving':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'declining':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-300';
    }
  };

  const getStatusColor = (status: 'on-track' | 'at-risk' | 'overdue') => {
    switch (status) {
      case 'on-track':
        return 'text-green-600';
      case 'at-risk':
        return 'text-yellow-600';
      case 'overdue':
        return 'text-red-600';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-display text-foreground mb-1 sm:mb-2">
          Shop Analytics
        </h1>
        <p className="text-sm sm:text-[15px] text-muted-foreground font-normal">
          Performance metrics and predictions for repair shops
        </p>
      </div>

      <Card className="bg-card-blue rounded-xl shadow-vibrant-lg border border-border">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <BarChart3 className="h-5 w-5 text-bright-blue" />
            Shop Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-bright-blue/5 to-electric/5 border-b border-border/50">
                  <TableHead className="px-4 w-[30%]">Shop</TableHead>
                  <TableHead className="text-center px-4 w-[10%]">Active ROs</TableHead>
                  <TableHead className="text-center px-4 w-[10%] hidden md:table-cell">Total ROs</TableHead>
                  <TableHead className="text-center px-4 w-[20%]">Median Turnaround</TableHead>
                  <TableHead className="text-center px-4 w-[15%]">Trend</TableHead>
                  <TableHead className="text-center px-4 w-[15%] hidden lg:table-cell">Shipping</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {profileArray.map((profile) => {
                  const isOpen = expandedShop === profile.shopName;

                  return (
                    <>
                      {/* MAIN ROW */}
                      <TableRow
                        key={profile.shopName}
                        className="cursor-pointer hover:bg-bright-blue/5 transition-colors border-b border-border/30"
                        onClick={() =>
                          setExpandedShop(isOpen ? null : profile.shopName)
                        }
                      >
                        <TableCell className="px-4">{profile.shopName}</TableCell>

                        <TableCell className="text-center px-4">
                          <Badge className="bg-bright-blue/10 text-bright-blue border-bright-blue/20">
                            {profile.activeROs.length}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center px-4 hidden md:table-cell">
                          {profile.totalROs}
                        </TableCell>

                        <TableCell className="text-center px-4">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-electric" />
                            <span className="font-medium">
                              {profile.medianTurnaround > 0
                                ? profile.medianTurnaround.toFixed(1)
                                : 'N/A'}
                            </span>
                            {profile.medianTurnaround > 0 && (
                              <span className="text-muted-foreground text-sm">days</span>
                            )}
                          </span>
                        </TableCell>

                        <TableCell className="text-center px-4">
                          <Badge
                            variant="outline"
                            className={`${getTrendColor(profile.trend)} border font-medium flex items-center gap-1`}
                          >
                            {getTrendIcon(profile.trend)}
                            {getTrendText(profile.trend)}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center px-4 hidden lg:table-cell">
                          {profile.shippingDays.min}-{profile.shippingDays.max} days
                        </TableCell>

                        <TableCell className="text-center px-4">
                          <ChevronDown
                            className={`h-4 w-4 text-bright-blue transition-transform ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </TableCell>
                      </TableRow>

                      {/* EXPANDED ROW */}
                      {isOpen && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="bg-gradient-to-r from-bright-blue/5 to-electric/5 border-b border-border/30"
                          >
                            <div className="py-6 space-y-6">

                              {/* PERFORMANCE METRICS CARD */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-xl border border-border bg-card-blue p-5 shadow">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Overall Median
                                  </div>
                                  <div className="text-3xl font-bold">{profile.overallMedian.toFixed(1)}</div>
                                  <div className="text-sm text-muted-foreground mt-1">days</div>
                                </div>

                                <div className="rounded-xl border border-border bg-card-blue p-5 shadow">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Recent Median (30d)
                                  </div>
                                  <div className="text-3xl font-bold">{profile.recentMedian.toFixed(1)}</div>
                                  <div className="text-sm text-muted-foreground mt-1">days</div>
                                </div>

                                <div className="rounded-xl border border-border bg-card-blue p-5 shadow">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Variance (MAD)
                                  </div>
                                  <div className="text-3xl font-bold">±{profile.variance.toFixed(1)}</div>
                                  <div className="text-sm text-muted-foreground mt-1">days</div>
                                </div>
                              </div>

                              {/* ACTIVE RO PREDICTIONS */}
                              {profile.activeROs.length > 0 && (
                                <div className="rounded-xl border border-border bg-card-blue p-5 shadow">
                                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                                    <Package className="h-4 w-4 text-bright-blue" />
                                    Active Repair Orders & Predictions
                                  </h4>

                                  <div className="space-y-2">
                                    {profile.activeROs.map((roNumber) => {
                                      const ro = repairOrders.find(
                                        (r: RepairOrder) => r.roNumber === roNumber
                                      );
                                      if (!ro) return null;

                                      const prediction = predictCompletion(ro, profiles);
                                      if (!prediction) return null;

                                      return (
                                        <div
                                          key={roNumber}
                                          className="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50 border border-border/30 hover:bg-background/80"
                                        >
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono font-semibold">{roNumber}</span>
                                              <Badge variant="outline" className="text-xs bg-electric/10 text-electric border-electric/20">
                                                {ro.currentStatus}
                                              </Badge>
                                            </div>
                                          </div>

                                          <div className="text-right ml-4">
                                            <div className="flex items-center gap-1.5">
                                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                              <span className={`font-semibold ${getStatusColor(prediction.status)}`}>
                                                {prediction.estimatedDate.toLocaleDateString('en-US', {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  year: 'numeric',
                                                })}
                                              </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                              ±{prediction.confidenceDays} days
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* STATUS VELOCITY */}
                              {Object.keys(profile.statusVelocity).length > 0 && (
                                <div className="rounded-xl border border-border bg-card-blue p-5 shadow">
                                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-bright-blue" />
                                    Status Velocity
                                  </h4>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {Object.entries(profile.statusVelocity)
                                      .filter(([_, days]) => days > 0)
                                      .map(([status, days]) => (
                                        <div
                                          key={status}
                                          className="bg-background/50 border border-border/30 rounded-lg p-3"
                                        >
                                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                            {status}
                                          </div>
                                          <div className="text-xl font-bold">{days.toFixed(1)}</div>
                                          <div className="text-xs text-muted-foreground">days</div>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
