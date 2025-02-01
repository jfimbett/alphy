'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
      setLoggedIn(isLoggedIn);
      if (isLoggedIn) {
        const email = localStorage.getItem('userEmail') || 'User';
        setUserEmail(email);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('userEmail');
    setLoggedIn(false);
    router.push('/login');
  };

  return (
    <nav className="bg-blue-400 text-white p-4 flex items-center justify-between">
      <div className="text-lg font-bold">
        <Link href="/">Home</Link>
      </div>
      <div className="flex items-center space-x-4">
        {loggedIn ? (
          <>
           <div className="flex items-center space-x-2">
              <span className="text-sm">{userEmail}</span>
            </div> 
               
            {/* Link to history and Dashboard page but only if logged in */}
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/history">History</Link>
            
            <button
              onClick={handleLogout}
              className="bg-blue-800 px-3 py-1 rounded hover:bg-blue-700 transition-colors text-sm"
            >
              Log Out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="bg-blue-800 px-3 py-1 rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Log In
          </Link>
        )}
      </div>
    </nav>
  );
}
