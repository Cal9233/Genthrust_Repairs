import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Database, AlertCircle } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { v4 as uuidv4 } from 'uuid';
import { useLogger } from '@/utils/logger';

interface BuildProgress {
  currentTable: string;
  currentTableProgress: number;
  currentTableTotal: number;
  tablesCompleted: number;
  totalTables: number;
  totalPartsIndexed: number;
  status: 'idle' | 'building' | 'complete' | 'error';
  message: string;
}

const INVENTORY_TABLES = [
  { name: 'BinsInventoryTable', display: 'Bins Inventory' },
  { name: 'StockRoomInventoryTable', display: 'Stock Room' },
  { name: 'MD82PartsTable', display: 'MD82 Parts' },
  { name: 'Inventory_727PartsTable', display: '727 Parts' },
  { name: 'TERRAInventoryTable', display: 'TERRA' },
  { name: 'BER_RAI_Table', display: 'BER/RAI' },
  { name: 'ASIS_AR_PARTS_Table', display: 'ASIS AR Parts' },
  { name: 'PARTS_AR_ASIA_SANFORD_Table', display: 'AR Asia Sanford' },
  { name: 'BOLIVIA_PART_TABLE', display: 'Bolivia Parts' },
  { name: 'DELTA_APA_TABLE', display: 'Delta APA' },
  { name: 'APA_SANFORD_757_TABLE', display: 'APA Sanford 757' },
];

const INDEX_TABLE = 'InventoryIndexTable';

export function InventoryIndexBuilder() {
  const logger = useLogger('InventoryIndexBuilder', {});
  const { instance, accounts } = useMsal();
  const [progress, setProgress] = useState<BuildProgress>({
    currentTable: '',
    currentTableProgress: 0,
    currentTableTotal: 0,
    tablesCompleted: 0,
    totalTables: INVENTORY_TABLES.length,
    totalPartsIndexed: 0,
    status: 'idle',
    message: '',
  });
  const [buildTime, setBuildTime] = useState<number>(0);

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

  const callGraphAPI = async (endpoint: string, token: string, method: string = 'GET', body?: any) => {
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Graph API error: ${response.status} - ${error}`);
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

  const normalizePartNumber = (pn: any): string => {
    if (!pn) return '';
    return String(pn)
      .toUpperCase()
      .replace(/\s+/g, '') // Remove whitespace only, NOT dashes
      .trim();
  };

  const detectColumnIndices = (headers: string[]) => {
    const findColumn = (patterns: string[]) => {
      return headers.findIndex(header => {
        if (!header) return false;
        const h = String(header).toUpperCase();
        return patterns.some(pattern => h.includes(pattern));
      });
    };

    return {
      partNumber: findColumn(['PART', 'PN', 'P/N', 'PART NO', 'PARTNUMBER']),
      serial: findColumn(['SERIAL', 'SER', 'S/N', 'SN']),
      qty: findColumn(['QTY', 'QUANTITY', 'QTY.']),
      condition: findColumn(['COND', 'CONDITION']),
      location: findColumn(['LOCATION', 'LOC', 'BIN', 'STOCK ROOM']),
      description: findColumn(['DESC', 'DESCRIPTION']),
    };
  };

  const clearIndex = async (token: string, driveId: string, sessionId: string) => {
    const fileId = import.meta.env.VITE_INVENTORY_WORKBOOK_ID;

    try {
      const response = await callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/tables/${INDEX_TABLE}/rows`,
        token
      );

      const rows = response.value || [];
      const rowCount = rows.length;

      if (rowCount === 0) {
        return 0;
      }

      // Delete rows from bottom to top to avoid index shifting issues
      for (let i = rows.length - 1; i >= 0; i--) {
        try {
          await fetch(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/tables/${INDEX_TABLE}/rows/itemAt(index=${i})`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
                'workbook-session-id': sessionId,
              },
            }
          );
        } catch (err) {
          // Continue on error
        }
      }

      return rowCount;
    } catch (error) {
      return 0;
    }
  };

  const processTable = async (
    token: string,
    driveId: string,
    _sessionId: string,
    tableName: string,
    tableDisplay: string
  ): Promise<number> => {
    const fileId = import.meta.env.VITE_INVENTORY_WORKBOOK_ID;

    setProgress(prev => ({
      ...prev,
      currentTable: tableDisplay,
      currentTableProgress: 0,
      currentTableTotal: 0,
      message: `Reading ${tableDisplay}...`,
    }));

    // Get table rows
    const rowsResponse = await callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/tables/${tableName}/rows`,
      token
    );

    const rows = rowsResponse.value || [];

    if (rows.length === 0) {
      setProgress(prev => ({
        ...prev,
        message: `${tableDisplay} is empty, skipping`,
      }));
      return 0;
    }

    // Get column headers
    const columnsResponse = await callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/tables/${tableName}/columns`,
      token
    );

    const headers = columnsResponse.value.map((col: any) => col.name);
    const indices = detectColumnIndices(headers);

    if (indices.partNumber === -1) {
      setProgress(prev => ({
        ...prev,
        message: `Could not detect Part Number column in ${tableDisplay}, skipping`,
      }));
      return 0;
    }

    setProgress(prev => ({
      ...prev,
      currentTableTotal: rows.length,
      message: `Processing ${tableDisplay} (${rows.length} rows)...`,
    }));

    let processedCount = 0;

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const values = row.values[0];
      const partNumber = values[indices.partNumber];

      if (!partNumber || String(partNumber).trim() === '') {
        continue;
      }

      const normalized = normalizePartNumber(partNumber);
      const serial = indices.serial !== -1 ? values[indices.serial] || '' : '';
      const qty = indices.qty !== -1 ? Number(values[indices.qty]) || 0 : 0;
      const condition = indices.condition !== -1 ? values[indices.condition] || '' : '';
      const location = indices.location !== -1 ? values[indices.location] || '' : '';
      const description = indices.description !== -1 ? values[indices.description] || '' : '';

      // Create index entry
      // Force part number as text by prepending apostrophe to prevent scientific notation
      const indexEntry = [
        uuidv4(),                     // IndexId
        `'${normalized}`,             // PartNumber (force text format with apostrophe)
        tableName,                    // TableName
        String(row.index),           // RowId
        String(serial),              // SerialNumber
        qty,                         // Qty
        String(condition),           // Condition
        String(location),            // Location
        String(description),         // Description
        new Date().toISOString(),    // LastSeen
        '',                          // ETag
        ''                           // ExtraMeta
      ];

      try {
        await callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/tables/${INDEX_TABLE}/rows/add`,
          token,
          'POST',
          { values: [indexEntry] }
        );

        processedCount++;

        // Update progress every 10 rows
        if (i % 10 === 0 || i === rows.length - 1) {
          setProgress(prev => ({
            ...prev,
            currentTableProgress: i + 1,
            message: `Processing ${tableDisplay}: ${i + 1}/${rows.length}`,
          }));
        }
      } catch (error) {
        logger.error('Failed to add row to index', error as Error, {
          tableName: tableDisplay,
          partNumber: normalized,
          rowIndex: i
        });
      }
    }

    return processedCount;
  };

  const buildIndex = async () => {
    const startTime = Date.now();

    setProgress({
      currentTable: '',
      currentTableProgress: 0,
      currentTableTotal: 0,
      tablesCompleted: 0,
      totalTables: INVENTORY_TABLES.length,
      totalPartsIndexed: 0,
      status: 'building',
      message: 'Starting index build...',
    });

    try {
      const token = await getAccessToken();
      const fileId = import.meta.env.VITE_INVENTORY_WORKBOOK_ID;

      if (!fileId) {
        throw new Error('VITE_INVENTORY_WORKBOOK_ID not found in .env.local');
      }

      // Get SharePoint drive ID
      setProgress(prev => ({ ...prev, message: 'Getting SharePoint drive ID...' }));
      const driveId = await getDriveId(token);

      // Create workbook session
      setProgress(prev => ({ ...prev, message: 'Creating workbook session...' }));
      const sessionResponse = await callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/createSession`,
        token,
        'POST',
        { persistChanges: true }
      );

      const sessionId = sessionResponse.id;

      try {
        // Clear existing index
        setProgress(prev => ({ ...prev, message: 'Clearing existing index...' }));
        const clearedRows = await clearIndex(token, driveId, sessionId);
        setProgress(prev => ({
          ...prev,
          message: `Cleared ${clearedRows} existing rows`,
        }));

        let totalIndexed = 0;

        // Process each table
        for (let i = 0; i < INVENTORY_TABLES.length; i++) {
          const table = INVENTORY_TABLES[i];
          const count = await processTable(token, driveId, sessionId, table.name, table.display);

          totalIndexed += count;

          setProgress(prev => ({
            ...prev,
            tablesCompleted: i + 1,
            totalPartsIndexed: totalIndexed,
            message: `Completed ${table.display}: ${count} parts added`,
          }));
        }

        // Close session
        setProgress(prev => ({ ...prev, message: 'Closing workbook session...' }));
        await callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/closeSession`,
          token,
          'POST',
          {}
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        setBuildTime(parseFloat(duration));

        setProgress(prev => ({
          ...prev,
          status: 'complete',
          message: `Index build complete! Indexed ${totalIndexed} parts in ${duration}s`,
        }));

      } catch (error: any) {
        // Try to close session on error
        try {
          await callGraphAPI(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/closeSession`,
            token,
            'POST',
            {}
          );
        } catch (closeError) {
          // Ignore
        }
        throw error;
      }

    } catch (error: any) {
      setProgress(prev => ({
        ...prev,
        status: 'error',
        message: `Build failed: ${error.message}`,
      }));
    }
  };

  const progressPercentage = progress.totalTables > 0
    ? (progress.tablesCompleted / progress.totalTables) * 100
    : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Build Search Index
        </CardTitle>
        <CardDescription>
          Populate the search index from all inventory tables
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {progress.status === 'idle' && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              This will scan all {INVENTORY_TABLES.length} inventory tables and create a searchable index
            </p>
            <Button onClick={buildIndex}>
              Build Index
            </Button>
          </div>
        )}

        {progress.status === 'building' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">{progress.message}</span>
            </div>

            <Progress value={progressPercentage} className="h-2" />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tables:</span>{' '}
                <span className="font-medium">
                  {progress.tablesCompleted} / {progress.totalTables}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Parts indexed:</span>{' '}
                <span className="font-medium">{progress.totalPartsIndexed}</span>
              </div>
            </div>

            {progress.currentTable && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{progress.currentTable}</span>
                  {progress.currentTableTotal > 0 && (
                    <Badge variant="secondary">
                      {progress.currentTableProgress} / {progress.currentTableTotal}
                    </Badge>
                  )}
                </div>
                {progress.currentTableTotal > 0 && (
                  <Progress
                    value={(progress.currentTableProgress / progress.currentTableTotal) * 100}
                    className="h-1"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {progress.status === 'complete' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-700 dark:text-green-400">
                    ✅ Index Build Complete!
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                    {progress.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 rounded-lg border">
                <div className="text-2xl font-bold text-primary">{progress.totalPartsIndexed}</div>
                <div className="text-muted-foreground">Parts Indexed</div>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <div className="text-2xl font-bold text-primary">{progress.tablesCompleted}</div>
                <div className="text-muted-foreground">Tables Processed</div>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <div className="text-2xl font-bold text-primary">{buildTime}s</div>
                <div className="text-muted-foreground">Build Time</div>
              </div>
            </div>

            <Button variant="outline" onClick={buildIndex} className="w-full">
              Rebuild Index
            </Button>
          </div>
        )}

        {progress.status === 'error' && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Build Failed</p>
                <p className="text-sm text-destructive/80 mt-1">{progress.message}</p>
              </div>
            </div>
            <Button variant="outline" onClick={buildIndex} className="mt-4">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
