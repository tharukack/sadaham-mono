import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white shadow rounded p-8 w-full max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Order Management System</h1>
        <p className="text-gray-700">
          Full-stack monolith with NestJS, Prisma, PostgreSQL, Twilio SMS OTP, and Next.js UI.
        </p>
        <div className="space-x-4">
          <Link href="/login" className="text-blue-600 hover:underline">
            Login
          </Link>
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
