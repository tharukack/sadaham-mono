import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function SmsPage() {
  const { data } = useQuery({ queryKey: ['sms-templates'], queryFn: async () => (await api.get('/sms/templates')).data });

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-semibold">SMS Templates</h1>
      <div className="space-y-2">
        {(data || []).map((tpl: any) => (
          <div key={tpl.id} className="bg-white shadow rounded p-4">
            <div className="font-medium">{tpl.name}</div>
            <div className="text-sm text-gray-700">{tpl.body}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
