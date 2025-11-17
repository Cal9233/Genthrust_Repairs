import { useQuery } from "@tanstack/react-query";
import { excelService } from "../lib/excelService";
import { createLogger, measureAsync } from "../utils/logger";
import type {
  GraphAPIResponse,
  GraphWorksheetResponse,
  GraphTableResponse,
  GraphTableColumnResponse,
  WorksheetData,
  TableData,
  ColumnData
} from "../types/graphApi";

// Create logger instance for this hook
const logger = createLogger('useInventoryFile');

export interface InventoryFileInfo {
  id: string;
  name: string;
  webUrl: string;
  structure?: {
    worksheets: WorksheetData[];
  };
}

/**
 * Type-safe wrapper for accessing excelService private methods
 *
 * @description
 * ExcelService methods callGraphAPI and driveId are marked private but need to be
 * accessed for inventory file structure operations. This interface provides type-safe
 * access without using "as any".
 */
interface ExcelServicePrivateAPI {
  callGraphAPI<T = unknown>(
    endpoint: string,
    method?: string,
    body?: unknown,
    sessionId?: string
  ): Promise<T>;
  driveId: string | null;
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

        // Type-safe access to private excelService methods
        const privateAPI = excelService as unknown as ExcelServicePrivateAPI;

        // Get the file structure
        try {
          const worksheetsResponse = await privateAPI.callGraphAPI<GraphAPIResponse<GraphWorksheetResponse>>(
            `https://graph.microsoft.com/v1.0/drives/${privateAPI.driveId}/items/${fileInfo.id}/workbook/worksheets`
          );

          const worksheets: WorksheetData[] = [];

          for (const worksheet of worksheetsResponse.value) {
            // Create child logger for this worksheet
            const worksheetLogger = logger.child(`worksheet:${worksheet.name}`);

            const worksheetData: WorksheetData = {
              name: worksheet.name,
              position: worksheet.position,
              visibility: worksheet.visibility,
              tables: [],
            };

            // Get tables in this worksheet
            try {
              const tablesResponse = await privateAPI.callGraphAPI<GraphAPIResponse<GraphTableResponse>>(
                `https://graph.microsoft.com/v1.0/drives/${privateAPI.driveId}/items/${fileInfo.id}/workbook/worksheets/${worksheet.name}/tables`
              );

              worksheetLogger.debug('Tables fetched', {
                tableCount: tablesResponse.value.length
              });

              for (const table of tablesResponse.value) {
                const tableData: TableData = {
                  name: table.name,
                  rowCount: table.rowCount,
                  columns: [],
                };

                // Get columns for this table
                try {
                  const columnsResponse = await privateAPI.callGraphAPI<GraphAPIResponse<GraphTableColumnResponse>>(
                    `https://graph.microsoft.com/v1.0/drives/${privateAPI.driveId}/items/${fileInfo.id}/workbook/tables/${table.name}/columns`
                  );

                  tableData.columns = columnsResponse.value.map((col, idx): ColumnData => ({
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
