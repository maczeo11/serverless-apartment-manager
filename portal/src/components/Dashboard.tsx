import { useState, useEffect } from 'react';
import type { MaintenanceRequest } from '../types';
import { getRequests } from '../api';
import { BuildingIcon, PlusIcon } from './Icons';
import { RequestCard } from './RequestCard';
import { NewRequestModal } from './NewRequestModal';

interface DashboardProps {
  user: any;
  isAdmin: boolean;
  onSignOut: () => Promise<void>;
}

export function Dashboard({ user, isAdmin, onSignOut }: DashboardProps) {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await getRequests();
      setRequests(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav className="navbar">
        <div className="nav-brand">
          <span className="logo-icon"><BuildingIcon /></span>
          APRT MGR
        </div>
        <div className="user-controls">
          <span className="user-email">
            {user.username} {isAdmin && <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>(Admin)</span>}
          </span>
          <button onClick={onSignOut} className="btn-logout">Sign Out</button>
        </div>
      </nav>

      <main className="dashboard-content">
        <div className="header-actions">
          <h1>{isAdmin ? 'All Maintenance Requests' : 'My Requests'}</h1>
          {!isAdmin && (
            <button onClick={() => setShowNewModal(true)} className="btn-new">
              <PlusIcon /> New Request
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <BuildingIcon />
            <h3>No requests yet</h3>
            <p>{isAdmin ? 'There are no active maintenance requests.' : 'You haven\'t submitted any maintenance requests.'}</p>
            {!isAdmin && <button onClick={() => setShowNewModal(true)} className="btn-secondary">Create your first request</button>}
          </div>
        ) : (
          <div className="requests-grid">
            {requests.map(req => (
              <RequestCard 
                key={req.requestId} 
                req={req} 
                isAdmin={isAdmin} 
                onStatusUpdated={loadRequests} 
              />
            ))}
          </div>
        )}
      </main>

      {showNewModal && !isAdmin && (
        <NewRequestModal 
          onClose={() => setShowNewModal(false)} 
          onSuccess={() => {
            setShowNewModal(false);
            loadRequests();
          }} 
        />
      )}
    </>
  );
}
