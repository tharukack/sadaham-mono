import Link from 'next/link';

const links = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/campaign', label: 'Campaign' },
  { href: '/admin/locations', label: 'Locations' },
  { href: '/admin/sms', label: 'SMS' },
  { href: '/admin/audit', label: 'Audit' },
  { href: '/customers/search', label: 'Customer Search' },
  { href: '/orders', label: 'Orders' },
];

export default function Dashboard() {
  return (
    <main className="min-h-screen p-8 bg-gray-100">
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="bg-white shadow p-4 rounded">
            <div className="font-medium text-blue-600">{link.label}</div>
            <div className="text-sm text-gray-600">Navigate to {link.label} module</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
