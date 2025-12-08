import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function LocationsPage() {
  const { data } = useQuery({ queryKey: ['locations'], queryFn: async () => (await api.get('/locations')).data });

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-semibold">Pickup Locations</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data || []).map((loc: any) => (
          <div key={loc.id} className="bg-white shadow rounded p-4">
            <div className="font-medium">{loc.name}</div>
            <div className="text-sm text-gray-600">{loc.address}</div>
            <div className="text-sm text-gray-600">Distributor: {loc.distributorName} ({loc.distributorMobile})</div>
          </div>
        ))}
      </div>
    </main>
  );
}
