import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';

export default function CustomerSearchPage() {
  const [term, setTerm] = useState('');
  const { data, refetch } = useQuery({
    queryKey: ['customer-search', term],
    queryFn: async () => (await api.get('/customers/search', { params: { q: term } })).data,
  });

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-semibold">Customer Search</h1>
      <div className="flex space-x-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="border rounded p-2 flex-1"
          placeholder="Search by name or mobile"
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={() => refetch()}>
          Search
        </button>
      </div>
      <div className="bg-white shadow rounded divide-y">
        {(data || []).map((c: any) => (
          <div key={c.id} className="p-3">
            <div className="font-medium">{c.firstName} {c.lastName}</div>
            <div className="text-sm text-gray-600">{c.mobile}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
