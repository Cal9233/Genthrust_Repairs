import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventoryFile } from "../hooks/useInventoryFile";
import { FileSpreadsheet, Table2, Columns, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InventoryFileViewer() {
  const { data: fileInfo, isLoading, error } = useInventoryFile();

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Inventory File
          </CardTitle>
          <CardDescription>Loading inventory file structure...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Inventory File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Failed to load inventory file"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!fileInfo) {
    return (
      <Card className="w-full border-warning">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="h-5 w-5" />
            Inventory File Not Found
          </CardTitle>
          <CardDescription>
            Could not load inventory file from SharePoint
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          Inventory File
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>{fileInfo.name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => window.open(fileInfo.webUrl, "_blank")}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Info */}
        <div className="rounded-lg bg-muted p-3 space-y-1">
          <p className="text-xs text-muted-foreground">File ID</p>
          <p className="text-sm font-mono break-all">{fileInfo.id}</p>
        </div>

        {/* File Structure */}
        {fileInfo.structure && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              Workbook Structure
            </h3>

            {fileInfo.structure.worksheets.map((worksheet, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border p-4 space-y-3"
              >
                {/* Worksheet Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">{worksheet.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      Position {worksheet.position} • {worksheet.visibility}
                    </p>
                  </div>
                </div>

                {/* Tables */}
                {worksheet.tables.length > 0 ? (
                  <div className="space-y-2">
                    {worksheet.tables.map((table, tableIdx) => (
                      <div
                        key={tableIdx}
                        className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <Table2 className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                            {table.name}
                          </span>
                          {table.rowCount !== undefined && (
                            <span className="text-xs text-blue-700 dark:text-blue-400">
                              ({table.rowCount} rows)
                            </span>
                          )}
                        </div>

                        {/* Columns */}
                        {table.columns.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400">
                              <Columns className="h-3 w-3" />
                              <span>Columns ({table.columns.length})</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                              {table.columns.map((col) => (
                                <div
                                  key={col.index}
                                  className="text-xs bg-white dark:bg-slate-900 rounded px-2 py-1 border border-blue-100 dark:border-blue-900"
                                >
                                  <span className="text-muted-foreground">[{col.index}]</span>{" "}
                                  <span className="text-foreground font-medium">{col.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No tables in this worksheet</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
