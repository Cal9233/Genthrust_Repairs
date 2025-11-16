import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Store, Calendar } from 'lucide-react';
import { useROs } from '../hooks/useROs';
import { buildShopAnalytics, predictCompletion } from '../services/analyticsEngine';
import type { RepairOrder } from '../types';

export function DashboardShopWidget() {
  const { data: repairOrders, isLoading } = useROs();
  const [expandedShop, setExpandedShop] = useState<string | null>(null);

  if (isLoading || !repairOrders) {
    return null;
  }

  const profiles = buildShopAnalytics(repairOrders);
  const activeShops = Array.from(profiles.values())
    .filter((profile) => profile.activeROs.length > 0)
    .sort((a, b) => b.activeROs.length - a.activeROs.length);

  if (activeShops.length === 0) {
    return null;
  }

  const getStatusColor = (status: 'on-track' | 'at-risk' | 'overdue') => {
    switch (status) {
      case 'on-track':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'at-risk':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'overdue':
        return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  return (
    <Card className="bg-card-blue rounded-xl shadow-vibrant-lg border border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Store className="h-5 w-5 text-bright-blue" />
          Active ROs by Shop
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activeShops.map((profile) => (
            <Collapsible
              key={profile.shopName}
              open={expandedShop === profile.shopName}
              onOpenChange={(open) => setExpandedShop(open ? profile.shopName : null)}
            >
              <div className="rounded-lg border border-border bg-background">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{profile.shopName}</span>
                      <Badge variant="secondary" className="bg-bright-blue/10 text-bright-blue border-bright-blue/20">
                        {profile.activeROs.length} active
                      </Badge>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedShop === profile.shopName ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-border p-3 space-y-2">
                    {profile.activeROs.map((roNumber) => {
                      const ro = repairOrders.find((r: RepairOrder) => r.roNumber === roNumber);
                      if (!ro) return null;

                      const prediction = predictCompletion(ro, profiles);
                      if (!prediction) {
                        return (
                          <div
                            key={roNumber}
                            className="flex items-center justify-between py-2 px-3 rounded bg-muted/30"
                          >
                            <div>
                              <span className="font-mono font-medium text-sm">{roNumber}</span>
                              <span className="text-xs text-muted-foreground ml-2">{ro.currentStatus}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">Estimating...</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={roNumber}
                          className="flex items-center justify-between py-2 px-3 rounded bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium text-sm">{roNumber}</span>
                              <Badge variant="outline" className="text-xs">
                                {ro.currentStatus}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{ro.partNumber}</div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className={`font-semibold ${getStatusColor(prediction.status).split(' ')[0]}`}>
                                {prediction.estimatedDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">±{prediction.confidenceDays}d</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
