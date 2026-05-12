import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type UserOrderPercentageRow = {
  userId: string;
  name: string;
  orders: number;
  orderPercent: number;
  mealPackets: number;
  mealPercent: number;
};

type UserOrderPercentagesTableProps = {
  rows: UserOrderPercentageRow[];
};

export function UserOrderPercentagesTable({ rows }: UserOrderPercentagesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders By User</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No user order data yet.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">% of Orders</TableHead>
                  <TableHead className="text-right">Meal Packets</TableHead>
                  <TableHead className="text-right">% of Meals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.orders}</TableCell>
                    <TableCell className="text-right">{row.orderPercent}%</TableCell>
                    <TableCell className="text-right">{row.mealPackets}</TableCell>
                    <TableCell className="text-right">{row.mealPercent}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
