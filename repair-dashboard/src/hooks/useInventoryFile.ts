import { useQuery } from "@tanstack/react-query";
import { excelService } from "../lib/excelService";

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
 * Hook to search for and access the Genthrust_Inventory file
 */
export function useInventoryFile() {
  return useQuery({
    queryKey: ["inventoryFile"],
    queryFn: async (): Promise<InventoryFileInfo | null> => {
      console.log("[useInventoryFile] Searching for Genthrust_Inventory file...");

      // Search for the file
      const fileInfo = await excelService.searchForFile("Genthrust_Inventory");

      if (!fileInfo) {
        console.log("[useInventoryFile] Genthrust_Inventory file not found");
        return null;
      }

      console.log("[useInventoryFile] File found, fetching structure...");

      // Get the file structure
      try {
        const worksheetsResponse = await (excelService as any).callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${(excelService as any).driveId}/items/${fileInfo.id}/workbook/worksheets`
        );

        const worksheets = [];

        for (const worksheet of worksheetsResponse.value) {
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
              } catch (error) {
                console.error(`[useInventoryFile] Error fetching columns for table ${table.name}:`, error);
              }

              worksheetData.tables.push(tableData);
            }
          } catch (error) {
            console.error(`[useInventoryFile] Error fetching tables for worksheet ${worksheet.name}:`, error);
          }

          worksheets.push(worksheetData);
        }

        return {
          ...fileInfo,
          structure: { worksheets },
        };
      } catch (error) {
        console.error("[useInventoryFile] Error fetching file structure:", error);
        return fileInfo; // Return just the basic file info if structure fetch fails
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
}
