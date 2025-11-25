import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import Link from 'next/link';

export default function LoginPage() {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await api.post('/auth/login', { mobile, password });
    setMessage(`OTP sent. Expires at ${res.data.expiresAt}`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-white shadow rounded p-8 space-y-4 w-full max-w-md">
        <h1 className="text-xl font-semibold">Login</h1>
        <label className="block">
          <span className="text-sm text-gray-700">Mobile</span>
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="border rounded w-full p-2"
            placeholder="+61400000000"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded w-full p-2"
          />
        </label>
        <button className="bg-blue-600 text-white px-4 py-2 rounded w-full" type="submit">
          Send OTP
        </button>
        {message && <p className="text-green-600 text-sm">{message}</p>}
        <p className="text-sm text-gray-600">
          After receiving your OTP, continue to the <Link href="/otp" className="underline">verification page</Link>.
        </p>
      </form>
    </main>
  );
}
