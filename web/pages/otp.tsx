import { FormEvent, useState } from 'react';
import { api } from '../lib/api';

export default function OtpPage() {
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await api.post('/auth/verify', { mobile, code });
    setToken(res.data.token);
  };

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-white shadow rounded p-8 space-y-4 w-full max-w-md">
        <h1 className="text-xl font-semibold">OTP Verification</h1>
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
          <span className="text-sm text-gray-700">OTP Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border rounded w-full p-2"
            placeholder="123456"
          />
        </label>
        <button className="bg-green-600 text-white px-4 py-2 rounded w-full" type="submit">
          Verify
        </button>
        {token && (
          <p className="text-sm text-green-700 break-words">JWT: {token}</p>
        )}
      </form>
    </main>
  );
}
