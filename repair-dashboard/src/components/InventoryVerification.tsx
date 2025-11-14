import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { useMsal } from '@azure/msal-react';

interface TableInfo {
  name: string;
  columns: Array<{ name: string; index: number }>;
  rowCount?: number;
}

interface VerificationResult {
  worksheets: string[];
  tables: TableInfo[];
  missing: string[];
  success: boolean;
}

const EXPECTED_TABLES = [
  'APA_SANFORD_757_TABLE',
  'ASIS_AR_PARTS_Table',
  'BER_RAI_Table',
  'BinsInventoryTable',
  'BOLIVIA_PART_TABLE',
  'DELTA_APA_TABLE',
  'Inventory_727PartsTable',
  'MD82PartsTable',
  'PARTS_AR_ASIA_SANFORD_Table',  // Changed from PARTES to PARTS
  'StockRoomInventoryTable',
  'TERRAInventoryTable',
  'InventoryIndexTable',
  'InventoryTransactionsTable',
];

export function InventoryVerification() {
  const { instance, accounts } = useMsal();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = async () => {
    const request = {
      scopes: ['Files.ReadWrite.All', 'Sites.Read.All'],
      account: accounts[0],
    };

    try {
      const response = await instance.acquireTokenSilent(request);
      return response.accessToken;
    } catch (error) {
      const response = await instance.acquireTokenPopup(request);
      return response.accessToken;
    }
  };

  const callGraphAPI = async (endpoint: string, token: string) => {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  };

  const getDriveId = async (token: string): Promise<string> => {
    const siteUrl = import.meta.env.VITE_SHAREPOINT_SITE_URL;
    if (!siteUrl) {
      throw new Error('VITE_SHAREPOINT_SITE_URL not found in .env.local');
    }

    const url = new URL(siteUrl);
    const hostname = url.hostname;
    const sitePath = url.pathname;

    // Get site ID
    const siteResponse = await callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`,
      token
    );

    // Get drive ID
    const driveResponse = await callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${siteResponse.id}/drive`,
      token
    );

    return driveResponse.id;
  };

  const runVerification = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = await getAccessToken();
      const fileId = import.meta.env.VITE_INVENTORY_WORKBOOK_ID;

      if (!fileId) {
        throw new Error('VITE_INVENTORY_WORKBOOK_ID not found in .env.local');
      }

      // Get SharePoint drive ID
      const driveId = await getDriveId(token);

      // Get all worksheets
      const worksheetsResponse = await callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/worksheets`,
        token
      );
      const worksheets = worksheetsResponse.value.map((w: any) => w.name);

      // Get all tables
      const tablesResponse = await callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/tables`,
        token
      );

      const tables: TableInfo[] = [];

      for (const table of tablesResponse.value) {
        try {
          const columnsResponse = await callGraphAPI(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/tables/${table.name}/columns`,
            token
          );

          tables.push({
            name: table.name,
            columns: columnsResponse.value.map((col: any, idx: number) => ({
              name: col.name,
              index: idx,
            })),
            rowCount: table.rowCount,
          });
        } catch (err) {
          tables.push({
            name: table.name,
            columns: [],
          });
        }
      }

      // Check for missing tables
      const foundTableNames = tables.map((t) => t.name);
      const missing = EXPECTED_TABLES.filter((name) => !foundTableNames.includes(name));

      setResult({
        worksheets,
        tables,
        missing,
        success: missing.length === 0,
      });
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Inventory Excel Verification
        </CardTitle>
        <CardDescription>
          Verify that all inventory tables are properly configured in Excel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && !error && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              Click the button below to verify your Excel inventory setup
            </p>
            <Button onClick={runVerification} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Verification
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Verification Failed</p>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            </div>
            <Button variant="outline" onClick={runVerification} className="mt-4">
              Try Again
            </Button>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="flex items-center gap-2 p-4 rounded-lg border bg-card">
              {result.success ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-700 dark:text-green-400">
                      ✅ All Tables Found!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Found {result.tables.length} Excel tables
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">
                      ⚠️ Missing Tables
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {result.missing.length} table(s) need to be created
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Worksheets */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Worksheets ({result.worksheets.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {result.worksheets.map((name) => (
                  <Badge key={name} variant="outline" className="justify-start">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Tables */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Excel Tables ({result.tables.length})
              </h3>
              <div className="space-y-3">
                {result.tables.map((table) => {
                  const isExpected = EXPECTED_TABLES.includes(table.name);
                  return (
                    <div
                      key={table.name}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpected ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          )}
                          <span className="font-medium">{table.name}</span>
                        </div>
                        {table.rowCount !== undefined && (
                          <Badge variant="secondary">{table.rowCount} rows</Badge>
                        )}
                      </div>
                      {table.columns.length > 0 && (
                        <div className="ml-6">
                          <p className="text-xs text-muted-foreground mb-1">
                            Columns ({table.columns.length}):
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                            {table.columns.slice(0, 8).map((col) => (
                              <span key={col.index} className="text-xs truncate">
                                [{col.index}] {col.name}
                              </span>
                            ))}
                            {table.columns.length > 8 && (
                              <span className="text-xs text-muted-foreground">
                                +{table.columns.length - 8} more...
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Missing Tables */}
            {result.missing.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                  Missing Tables ({result.missing.length})
                </h3>
                <ul className="space-y-1">
                  {result.missing.map((name) => (
                    <li key={name} className="text-sm text-amber-800 dark:text-amber-400">
                      • {name}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-3">
                  Please create these tables in Excel before proceeding.
                </p>
              </div>
            )}

            <Button variant="outline" onClick={runVerification} className="w-full">
              Run Verification Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
