import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Search,
  Package,
  AlertCircle,
  Loader2,
  ExternalLink,
  Plus,
  RefreshCw,
  ChevronDown,
  FileText,
  TrendingUp,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { useInventorySearch, useInventoryDetails, useTableColumns } from '../hooks/useInventorySearch';
import { getTableDisplayName } from '../config/inventoryTableSchemas';
import { CreateROFromInventoryDialog } from './CreateROFromInventoryDialog';
import { InventoryIndexBuilder } from './InventoryIndexBuilder';
import { InventoryFileViewer } from './InventoryFileViewer';
import type { InventorySearchResult } from '../services/inventoryService';
import { useMsal } from '@azure/msal-react';

export function InventorySearchTab() {
  const { accounts } = useMsal();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<{ tableName: string; rowId: string } | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventorySearchResult | null>(null);
  const [showIndexBuilder, setShowIndexBuilder] = useState(false);
  const [showAdminSection, setShowAdminSection] = useState(false);

  // Check if current user has admin access
  const hasAdminAccess = accounts[0]?.username?.toLowerCase() === 'cmalagon@genthrust.net';

  const { data: results = [], isLoading, error } = useInventorySearch(searchQuery);
  const { data: details, isLoading: detailsLoading } = useInventoryDetails(
    selectedItem?.tableName || null,
    selectedItem?.rowId || null
  );
  const { data: columns = [] } = useTableColumns(selectedItem?.tableName || null);

  const handleViewDetails = (tableName: string, rowId: string) => {
    setSelectedItem({ tableName, rowId });
  };

  const handleCreateRO = (item: InventorySearchResult) => {
    setSelectedInventoryItem(item);
  };

  const handleROCreated = () => {
    // Refresh search results after RO creation and inventory decrement
    setSearchQuery(searchQuery + ' '); // Force re-search
    setTimeout(() => setSearchQuery(searchQuery.trim()), 100);
  };

  const getTotalQuantity = () => {
    return results.reduce((sum, item) => sum + item.qty, 0);
  };

  const getLowStockCount = () => {
    return results.filter(item => item.qty < 2).length;
  };

  const getLocationsCount = () => {
    return results.length;
  };

  const hasSearched = searchQuery.trim().length > 0;
  const hasResults = results.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-h1 text-foreground mb-1 sm:mb-2">
            Inventory Search
          </h1>
          <p className="text-sm sm:text-[15px] text-muted-foreground font-normal">
            Search aircraft parts across all inventory locations
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
        <Input
          placeholder="Enter part number (e.g., MS20470AD4-6, AN470AD4-6)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 sm:pl-11 h-12 sm:h-14 border-2 border-input focus:border-bright-blue focus:ring-4 focus:ring-bright-blue/10 focus:bg-bg-secondary rounded-xl transition-all duration-200 text-sm"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Stats Cards - Only show when there are results */}
      {hasSearched && hasResults && (
        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card-blue border-l-[4px] sm:border-l-[5px] border-l-bright-blue border-t border-r border-b border-border shadow-[0_4px_12px_rgba(2,132,199,0.08)] lift-on-hover rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
              <CardTitle className="text-[11px] sm:text-[12px] md:text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                TOTAL QTY
              </CardTitle>
              <div className="bg-bright-blue/15 p-2 sm:p-2.5 md:p-3 rounded-full">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-bright-blue" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] sm:text-[36px] md:text-[40px] font-bold text-foreground leading-none">
                {getTotalQuantity()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">units available</p>
            </CardContent>
          </Card>

          <Card className="bg-card-green border-l-[4px] sm:border-l-[5px] border-l-success border-t border-r border-b border-border shadow-[0_4px_12px_rgba(16,185,129,0.08)] lift-on-hover rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
              <CardTitle className="text-[11px] sm:text-[12px] md:text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                LOCATIONS
              </CardTitle>
              <div className="bg-success/15 p-2 sm:p-2.5 md:p-3 rounded-full">
                <MapPin className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-success" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] sm:text-[36px] md:text-[40px] font-bold text-foreground leading-none">
                {getLocationsCount()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">found</p>
            </CardContent>
          </Card>

          <Card className={`border-l-[4px] sm:border-l-[5px] ${getLowStockCount() > 0 ? 'bg-card-red border-l-destructive' : 'bg-card-gray border-l-muted'} border-t border-r border-b border-border shadow-[0_4px_12px_rgba(239,68,68,0.08)] lift-on-hover rounded-xl`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
              <CardTitle className="text-[11px] sm:text-[12px] md:text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                LOW STOCK
              </CardTitle>
              <div className={`${getLowStockCount() > 0 ? 'bg-destructive/15' : 'bg-muted/15'} p-2 sm:p-2.5 md:p-3 rounded-full`}>
                <AlertTriangle className={`h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 ${getLowStockCount() > 0 ? 'text-destructive' : 'text-muted-foreground'}`} strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-[32px] sm:text-[36px] md:text-[40px] font-bold leading-none ${getLowStockCount() > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {getLowStockCount()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">items {'<'} 2 units</p>
            </CardContent>
          </Card>

          <Card className="bg-card-purple border-l-[4px] sm:border-l-[5px] border-l-[#8b5cf6] border-t border-r border-b border-border shadow-[0_4px_12px_rgba(139,92,246,0.08)] lift-on-hover rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
              <CardTitle className="text-[11px] sm:text-[12px] md:text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                TABLES
              </CardTitle>
              <div className="bg-[#8b5cf6]/15 p-2 sm:p-2.5 md:p-3 rounded-full">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-[#8b5cf6]" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] sm:text-[36px] md:text-[40px] font-bold text-foreground leading-none">
                {new Set(results.map(r => r.tableName)).size}
              </div>
              <p className="text-xs text-muted-foreground mt-1">sources</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {isLoading && searchQuery && (
        <Card>
          <CardContent className="py-2">
            <LoadingSpinner size="md" text="Searching inventory..." />
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Search Error</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'Failed to search inventory'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {!isLoading && hasResults && (
        <Card className="rounded-xl shadow-vibrant-lg border border-border">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl text-foreground">
              Search Results
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Found in {new Set(results.map(r => r.tableName)).size} different inventory tables
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Part Number</TableHead>
                      <TableHead className="font-semibold">Qty</TableHead>
                      <TableHead className="font-semibold">Condition</TableHead>
                      <TableHead className="font-semibold">Location</TableHead>
                      <TableHead className="font-semibold hidden md:table-cell">Description</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <span className="font-mono text-sm font-medium">
                            {item.partNumber}
                          </span>
                          {item.serialNumber && (
                            <div className="text-xs text-muted-foreground">
                              S/N: {item.serialNumber}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.qty < 2 ? "destructive" : "secondary"}
                            className="font-mono font-semibold"
                          >
                            {item.qty}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{item.condition || '-'}</TableCell>
                        <TableCell className="text-sm font-medium">{item.location || '-'}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate hidden md:table-cell">
                          {item.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getTableDisplayName(item.tableName)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleCreateRO(item)}
                              disabled={item.qty < 1}
                              className="h-8 bg-green-600 hover:bg-green-700 text-white"
                              title={item.qty < 1 ? "Insufficient quantity" : "Create repair order from this part"}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Create RO
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(item.tableName, item.rowId)}
                              className="h-8"
                              title="View full details"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {!isLoading && hasSearched && !hasResults && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-muted mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No parts found</h3>
              <p className="text-sm text-muted-foreground">
                Try searching with a different part number
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State - Before Search */}
      {!hasSearched && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-bright-blue/10 mb-4">
                <Search className="h-8 w-8 text-bright-blue" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Search Inventory</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Enter a part number above to search across all 11 warehouse locations and 6,571 indexed parts
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collapsible Admin Section - Only visible to authorized users */}
      {hasAdminAccess && (
        <Collapsible open={showAdminSection} onOpenChange={setShowAdminSection}>
          <Card className="rounded-xl shadow-lg border border-border">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Advanced Management
                  </CardTitle>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showAdminSection ? 'transform rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">File Structure Viewer</h3>
                    <InventoryFileViewer />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Index Management</h3>
                    <Card className="bg-muted/30">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Total Parts</p>
                              <p className="text-2xl font-bold text-foreground">6,571</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Tables</p>
                              <p className="text-2xl font-bold text-foreground">11</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => setShowIndexBuilder(true)}
                            className="w-full bg-bright-blue hover:bg-blue-700 text-white"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Rebuild Index
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            ⚠️ Rebuilding takes ~25 minutes. Only rebuild after Excel file changes.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Details Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Full Inventory Details</DialogTitle>
            <DialogDescription>
              Source: {selectedItem && getTableDisplayName(selectedItem.tableName)}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading && (
            <LoadingSpinner size="sm" />
          )}

          {details && columns.length > 0 && (
            <div className="space-y-2">
              {columns.map((colName, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-4 py-2 border-b last:border-0">
                  <div className="text-sm font-medium text-muted-foreground">
                    {colName}
                  </div>
                  <div className="col-span-2 text-sm font-mono">
                    {details[idx] !== null && details[idx] !== undefined && details[idx] !== ''
                      ? String(details[idx])
                      : '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create RO from Inventory Dialog */}
      <CreateROFromInventoryDialog
        inventoryItem={selectedInventoryItem}
        open={!!selectedInventoryItem}
        onClose={() => setSelectedInventoryItem(null)}
        onSuccess={handleROCreated}
      />

      {/* Index Builder Dialog - Only accessible to authorized users */}
      {hasAdminAccess && (
        <Dialog open={showIndexBuilder} onOpenChange={setShowIndexBuilder}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Rebuild Inventory Index</DialogTitle>
              <DialogDescription>
                This will rebuild the search index from all 11 inventory Excel tables. This process takes approximately 25 minutes.
              </DialogDescription>
            </DialogHeader>
            <InventoryIndexBuilder />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
