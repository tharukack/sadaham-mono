import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

export default function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/orders')).data,
  });
  const [searchTerm, setSearchTerm] = useState('');

  const orders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data || [];
    return (data || []).filter((order: any) => {
      const customerName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim();
      const pickup = order.pickupLocation?.name || '';
      return customerName.toLowerCase().includes(term) || pickup.toLowerCase().includes(term);
    });
  }, [data, searchTerm]);

  return (
    <AppShell title="Orders">
      <PageHeader title="Orders" description="Track customer orders and meal counts." />
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Order List</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <Input
              placeholder="Search orders by customer or pickup location"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No orders found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Pickup Location</TableHead>
                  <TableHead>Meals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.customer?.firstName} {order.customer?.lastName}
                    </TableCell>
                    <TableCell>{order.pickupLocation?.name || 'Unassigned'}</TableCell>
                    <TableCell>
                      Chicken {order.chickenQty}, Veg {order.vegQty}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
