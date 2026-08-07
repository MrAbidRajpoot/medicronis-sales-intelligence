import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title?: string;
  description?: string;
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  title,
  description,
  columns,
  data,
  emptyMessage = "No data available",
  className,
}: DataTableProps<T>) {
  return (
    <Card className={cn(className)}>
      {(title || description) && (
        <CardHeader className="pb-3">
          {title && <CardTitle className="text-base">{title}</CardTitle>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
      )}
      <CardContent className={title || description ? "pt-0" : "p-0"}>
        {data.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
