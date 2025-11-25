import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function OrdersPage() {
  const { data } = useQuery({ queryKey: ['orders'], queryFn: async () => (await api.get('/orders')).data });

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-semibold">Orders</h1>
      <div className="bg-white shadow rounded divide-y">
        {(data || []).map((order: any) => (
          <div key={order.id} className="p-3">
            <div className="font-medium">{order.customer?.firstName} {order.customer?.lastName}</div>
            <div className="text-sm text-gray-600">Pickup: {order.pickupLocation?.name}</div>
            <div className="text-sm text-gray-600">Meals: Chicken {order.chickenQty}, Veg {order.vegQty}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
