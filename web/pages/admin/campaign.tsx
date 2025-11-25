import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function CampaignPage() {
  const { data } = useQuery({ queryKey: ['campaign'], queryFn: async () => (await api.get('/campaigns/current')).data });

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-semibold">Current Campaign</h1>
      {data ? (
        <div className="bg-white shadow rounded p-4">
          <div className="font-medium">{data.name}</div>
          <div className="text-sm text-gray-600">State: {data.state}</div>
        </div>
      ) : (
        <p>No active campaign.</p>
      )}
    </main>
  );
}
