import { useState, useEffect } from 'react';
import { signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';

import './App.css';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload?.['cognito:groups'] as string[];
      setIsAdmin(groups?.includes('admins') || false);
    } catch (e) {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setInitialLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    setIsAdmin(false);
  }

  if (initialLoading) {
    return (
      <div className="app-container">
        <div className="loading-state">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {!user ? (
        <Auth onAuthSuccess={checkUser} />
      ) : (
        <Dashboard user={user} isAdmin={isAdmin} onSignOut={handleSignOut} />
      )}
    </div>
  );
}
