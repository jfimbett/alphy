'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  // Hard-coded for now
  const REQUIRED_PROMO_CODE = 'SUPERPE';

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (promoCode !== REQUIRED_PROMO_CODE) {
      setError('Invalid promo code');
      return;
    }

    // If we got here, everything is "valid"
    // For now, just show a success message or redirect
    // In production, you'd create a user row in your DB
    setSuccess(true);

    // Optional: after 2 seconds, we can redirect to login or dashboard
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center text-blue-600 mb-6">Create Your Account</h1>

          {success ? (
            <div className="text-center">
              <p className="text-green-600 text-lg font-semibold">Account created successfully!</p>
              <p className="text-sm text-gray-600 mt-2">Redirecting to Login...</p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {error && <p className="text-red-600 text-sm">{error}</p>}

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                />
              </div>

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
                  Promo Code
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-2"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  required
                  placeholder="Enter the promo code"
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

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded-md p-2"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter your password"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Sign Up
              </button>
            </form>
          )}

          <div className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Log In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
