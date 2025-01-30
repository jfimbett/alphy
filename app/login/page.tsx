'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // in Next.js 13, "useRouter" is from 'next/navigation'
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Hard-coded test user for now
  const TEST_USER_EMAIL = 'test@example.com';
  const TEST_USER_PASS = 'test123';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic check
    if (email === TEST_USER_EMAIL && password === TEST_USER_PASS) {
      // "Log in" success. In a real app, you'd set a JWT cookie or session.
      alert('Login successful!');
      router.push('/dashboard'); // go to the dashboard
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center text-blue-600 mb-6">Welcome Back</h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <p className="text-red-600 text-sm">{error}</p>}
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-md p-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-md p-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Log In
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline">
              Sign Up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
