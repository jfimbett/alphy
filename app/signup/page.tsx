'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');
    if (!email || !password || !company || !reason) {
      setError('Please fill out all fields');
      return;
    }
    try {
      // In a real app, you'd call your API to create the user.
      console.log('Signing up with:', { email, password, company, reason });
      setSuccessMessage('Sign-up successful! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      console.error('Signup Error:', err);
      setError('Error creating account. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center text-blue-600 mb-6">
            Create Your Account
          </h1>
          {successMessage && (
            <div className="mb-4 bg-green-100 border border-green-200 text-green-800 p-3 rounded-md">
              {successMessage}
            </div>
          )}
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-md p-2 text-gray-700"
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
                className="w-full border border-gray-300 rounded-md p-2 text-gray-700"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Create a password"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Company
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md p-2 text-gray-700"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                placeholder="Where do you work?"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Reason for using the tool
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 text-gray-700"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="Briefly tell us why you want to use the tool"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Sign Up
            </button>
          </form>
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
