import { useQuery } from "@tanstack/react-query";
import { excelService } from "../lib/excelService";
import { createLogger, measureAsync } from "../utils/logger";

// Create logger instance for this hook
const logger = createLogger('useInventoryFile');

export interface InventoryFileInfo {
  id: string;
  name: string;
  webUrl: string;
  structure?: {
    worksheets: Array<{
      name: string;
      position: number;
      visibility: string;
      tables: Array<{
        name: string;
        rowCount?: number;
        columns: Array<{
          name: string;
          index: number;
        }>;
      }>;
    }>;
  };
}

/**
 * Hook to access the inventory file using VITE_INVENTORY_WORKBOOK_ID
 * No searching needed - uses the file ID directly from environment
 */
export function useInventoryFile() {
  return useQuery({
    queryKey: ["inventoryFile"],
    queryFn: async (): Promise<InventoryFileInfo | null> => {
      return await measureAsync(logger, 'fetchInventoryFile', async () => {
        logger.info('Fetching inventory file info');

        // Get file info directly using VITE_INVENTORY_WORKBOOK_ID
        const fileInfo = await excelService.getInventoryFileInfo();

        if (!fileInfo) {
          logger.warn('Inventory file not found');
          return null;
        }

        logger.info('File found, fetching structure', {
          fileId: fileInfo.id,
          fileName: fileInfo.name
        });

        // Get the file structure
        try {
          const worksheetsResponse = await (excelService as any).callGraphAPI(
            `https://graph.microsoft.com/v1.0/drives/${(excelService as any).driveId}/items/${fileInfo.id}/workbook/worksheets`
          );

          const worksheets = [];

          for (const worksheet of worksheetsResponse.value) {
            // Create child logger for this worksheet
            const worksheetLogger = logger.child(`worksheet:${worksheet.name}`);

            const worksheetData: any = {
              name: worksheet.name,
              position: worksheet.position,
              visibility: worksheet.visibility,
              tables: [],
            };

            // Get tables in this worksheet
            try {
              const tablesResponse = await (excelService as any).callGraphAPI(
                `https://graph.microsoft.com/v1.0/drives/${(excelService as any).driveId}/items/${fileInfo.id}/workbook/worksheets/${worksheet.name}/tables`
              );

              worksheetLogger.debug('Tables fetched', {
                tableCount: tablesResponse.value.length
              });

              for (const table of tablesResponse.value) {
                const tableData: any = {
                  name: table.name,
                  rowCount: table.rowCount,
                  columns: [],
                };

                // Get columns for this table
                try {
                  const columnsResponse = await (excelService as any).callGraphAPI(
                    `https://graph.microsoft.com/v1.0/drives/${(excelService as any).driveId}/items/${fileInfo.id}/workbook/tables/${table.name}/columns`
                  );

                  tableData.columns = columnsResponse.value.map((col: any, idx: number) => ({
                    name: col.name,
                    index: idx,
                  }));

                  worksheetLogger.debug('Columns fetched for table', {
                    tableName: table.name,
                    columnCount: tableData.columns.length
                  });
                } catch (error) {
                  worksheetLogger.error('Failed to fetch columns', error, {
                    tableName: table.name
                  });
                }

                worksheetData.tables.push(tableData);
              }
            } catch (error) {
              worksheetLogger.error('Failed to fetch tables', error, {
                worksheetName: worksheet.name
              });
            }

            worksheets.push(worksheetData);
          }

          logger.info('File structure fetched successfully', {
            worksheetCount: worksheets.length,
            totalTables: worksheets.reduce((sum, ws) => sum + ws.tables.length, 0)
          });

          return {
            ...fileInfo,
            structure: { worksheets },
          };
        } catch (error) {
          logger.error('Failed to fetch file structure', error, {
            fileId: fileInfo.id
          });
          return fileInfo; // Return just the basic file info if structure fetch fails
        }
      });
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
}
