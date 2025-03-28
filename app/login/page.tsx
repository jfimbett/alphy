// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      // Save login details from the response
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('userEmail', data.user.email);
      localStorage.setItem('userId', String(data.user.user_id));
      router.push('/dashboard');
    } catch (err) {
      console.error('Login Error:', err);
      setError('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
<Navbar />
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center text-blue-600 mb-6">Welcome Back</h1>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">Email</label>
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
              <label className="block text-gray-700 text-sm font-medium mb-1">Password</label>
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
