import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type PickupLocationRow = {
  locationId: string;
  locationName: string;
  orders: number;
};

type PickupLocationsTableProps = {
  rows: PickupLocationRow[];
  totalOrders: number;
};

export function PickupLocationsTable({ rows, totalOrders }: PickupLocationsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pickup Locations</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No pickup locations yet.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[420px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>% of total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const percent =
                    totalOrders > 0 ? Math.round((row.orders / totalOrders) * 100) : 0;
                  return (
                    <TableRow key={row.locationId}>
                      <TableCell className="font-medium">{row.locationName}</TableCell>
                      <TableCell>{row.orders}</TableCell>
                      <TableCell>{percent}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
