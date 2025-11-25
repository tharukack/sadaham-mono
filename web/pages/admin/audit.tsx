import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function AuditPage() {
  const { data } = useQuery({ queryKey: ['audit'], queryFn: async () => (await api.get('/audit')).data });

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <div className="bg-white shadow rounded divide-y">
        {(data || []).map((log: any) => (
          <div key={log.id} className="p-3">
            <div className="text-sm text-gray-600">{log.createdAt}</div>
            <div className="font-medium">{log.action} on {log.entityType}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
