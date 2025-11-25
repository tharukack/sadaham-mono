import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function UsersPage() {
  const { data } = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data });

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <div className="bg-white shadow rounded divide-y">
        {(data || []).map((user: any) => (
          <div key={user.id} className="p-3">
            <div className="font-medium">{user.firstName} {user.lastName}</div>
            <div className="text-sm text-gray-600">{user.mobile} — {user.role}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
