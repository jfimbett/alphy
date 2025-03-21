'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import AlphyAnimation from '@/components/AlphyAnimation';

export default function Navbar() {
  const [sessionId, setSessionId] = useState<string | null>(null); // Initialize as null
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const router = useRouter();

    // Authentication check function
    const checkAuthState = () => {
      if (typeof window === 'undefined') return;
  
      const storedSessionId = localStorage.getItem('currentSessionId');
      const isLogged = localStorage.getItem('loggedIn') === 'true';
      const email = localStorage.getItem('userEmail') || '';
  
      setSessionId(storedSessionId);
      setLoggedIn(isLogged);
      setUserEmail(email);
  
      if (!isLogged) {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
      }
    };
    

  useEffect(() => {
    // Client-side only code
    if (typeof window !== 'undefined') {
      const storedSessionId = localStorage.getItem('currentSessionId');
      setSessionId(storedSessionId);

      const isLogged = localStorage.getItem('loggedIn') === 'true';
      setLoggedIn(isLogged);
      if (isLogged) {
        setUserEmail(localStorage.getItem('userEmail') || '');
      } else {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
      }
    }
  }, []); // Empty dependency array ensures this runs once on mount

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      localStorage.removeItem('currentSessionId'); // Clear session ID on logout
    }
    setLoggedIn(false);
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/">
          <span className="text-gray-900 hover:text-blue-800 transition-colors font-bold text-xl">Alphy</span>
        </Link>
        <div className="flex items-center space-x-4">
          {loggedIn ? (
            <>
              <Link href="/dashboard">
                <span className="text-gray-700 hover:text-blue-600 transition-colors">Dashboard</span>
              </Link>
              <Link href="/history">
                <span className="text-gray-700 hover:text-blue-600 transition-colors">History</span>
              </Link>
              <Link 
                href={sessionId ? `/companies?sessionId=${sessionId}` : '/companies'}
                className="text-gray-700 hover:text-gray-900"
              >
                Companies
              </Link>
              <Link href="/settings" title="Settings">
                <Cog6ToothIcon className="w-8 h-8 text-blue-600 cursor-pointer" />
              </Link>
              <div className="flex items-center space-x-2">
                <UserCircleIcon className="w-8 h-8 text-blue-600" />
                <span className="text-gray-700">{userEmail}</span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
              >
                Log Out
              </button>
            </>
          ) : (
            <Link href="/login">
              <button className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors">
                Log In
              </button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}