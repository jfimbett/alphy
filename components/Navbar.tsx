import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-blue-600 font-bold text-xl">Alphy for PE</Link>
          <div className="space-x-4">
            <Link href="/login" className="text-gray-600 hover:text-blue-600">Login</Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-blue-600">Dashboard</Link>
            <Link href="/history" className="text-gray-600 hover:text-gray-600">
            History
          </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}