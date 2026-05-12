import { useState, useEffect, type FormEvent } from 'react';
import { signIn, signUp, confirmSignUp, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { getRequests, createRequest, updateRequestStatus } from './api';
import type { MaintenanceRequest } from './types';

import './App.css';

// SVGs for icons
const BuildingIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16" /><path d="M16 2v20" /><path d="M8 2v20" /><path d="M4 14h16" /><path d="M4 10h16" /><path d="M4 6h16" /></svg>);
const ClockIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
const HashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>);
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp' | 'confirmSignUp'>('signIn');

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // App state
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  // New Request state
  const [newReq, setNewReq] = useState({
    title: '', description: '', category: 'PLUMBING', priority: 'MEDIUM', unitNumber: '', building: ''
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

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

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'signIn') {
        await signIn({ username: email, password });
        await checkUser();
      } else if (authMode === 'signUp') {
        await signUp({ username: email, password, options: { userAttributes: { email } } });
        setAuthMode('confirmSignUp');
      } else if (authMode === 'confirmSignUp') {
        await confirmSignUp({ username: email, confirmationCode: code });
        await signIn({ username: email, password });
        await checkUser();
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    setIsAdmin(false);
  }

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

  async function handleCreateRequest(e: FormEvent) {
    e.preventDefault();
    try {
      await createRequest(newReq);

      setShowNewModal(false);
      setNewReq({ title: '', description: '', category: 'PLUMBING', priority: 'MEDIUM', unitNumber: '', building: '' });
      loadRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to create request');
    }
  }

  async function handleStatusChange(requestId: string, newStatus: string) {
    try {
      await updateRequestStatus(requestId, newStatus);
      loadRequests(); // refresh the list
    } catch (err) {
      alert('Failed to update status');
    }
  }

  if (initialLoading) return <div className="app-container"><div className="loading-state"><div className="spinner" /></div></div>;

  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <h2>{authMode === 'signIn' ? 'Welcome Back' : authMode === 'signUp' ? 'Create Account' : 'Verify Email'}</h2>
          <p className="subtitle">Maintenance Portal Access</p>

          {authError && <div className="error-message">{authError}</div>}

          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" required className="form-input" value={email} onChange={e => setEmail(e.target.value)} disabled={authMode === 'confirmSignUp'} />
            </div>

            {authMode !== 'confirmSignUp' && (
              <div className="form-group">
                <label>Password</label>
                <input type="password" required className="form-input" value={password} onChange={e => setPassword(e.target.value)} minLength={8} />
              </div>
            )}

            {authMode === 'confirmSignUp' && (
              <div className="form-group">
                <label>Verification Code</label>
                <input type="text" required className="form-input" value={code} onChange={e => setCode(e.target.value)} />
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={authLoading}>
              {authLoading ? 'Please wait...' : authMode === 'signIn' ? 'Sign In' : authMode === 'signUp' ? 'Sign Up' : 'Verify & Sign In'}
            </button>
          </form>

          <div className="auth-switch">
            {authMode === 'signIn' ? (
              <>Need an account? <button onClick={() => setAuthMode('signUp')}>Sign up</button></>
            ) : authMode === 'signUp' ? (
              <>Already have an account? <button onClick={() => setAuthMode('signIn')}>Sign in</button></>
            ) : (
              <><button onClick={() => setAuthMode('signIn')}>Back to sign in</button></>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-brand">
          <span className="logo-icon"><BuildingIcon /></span>
          APRT MGR
        </div>
        <div className="user-controls">
          <span className="user-email">
            {user.username} {isAdmin && <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>(Admin)</span>}
          </span>
          <button onClick={handleSignOut} className="btn-logout">Sign Out</button>
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
              <div key={req.requestId} className="request-card">
                <div className="card-header">
                  <div>
                    <div className="card-title">{req.title}</div>
                    <div className="card-id">#{req.requestId.substring(0, 8)} {isAdmin && `| Resident: ${req.residentId}`}</div>
                  </div>
                  {!isAdmin && <span className={`badge status-${req.status}`}>{req.status.replace('_', ' ')}</span>}
                </div>

                <div className="card-body">{req.description}</div>

                {isAdmin && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Update Status:</label>
                    <select
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '13px' }}
                      value={req.status}
                      onChange={(e) => handleStatusChange(req.requestId, e.target.value)}
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                )}

                <div className="card-footer">
                  <div className="card-meta">
                    <span className={`badge priority-${req.priority}`}>{req.priority}</span>
                    <span className="meta-item" title="Unit"><HashIcon /> {req.unitNumber}</span>
                  </div>
                  <div className="meta-item" title="Created At">
                    <ClockIcon /> {new Date(req.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showNewModal && !isAdmin && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>New Maintenance Request</h2>
              <button onClick={() => setShowNewModal(false)} className="btn-close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreateRequest}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Title</label>
                  <input required className="form-input" value={newReq.title} onChange={e => setNewReq({ ...newReq, title: e.target.value })} placeholder="E.g., Leaking faucet" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea required className="form-input" rows={4} value={newReq.description} onChange={e => setNewReq({ ...newReq, description: e.target.value })} placeholder="Please describe the issue in detail..." />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select className="form-input" value={newReq.category} onChange={e => setNewReq({ ...newReq, category: e.target.value })}>
                      <option value="PLUMBING">Plumbing</option>
                      <option value="ELECTRICAL">Electrical</option>
                      <option value="HVAC">HVAC / AC</option>
                      <option value="APPLIANCE">Appliance</option>
                      <option value="STRUCTURAL">Structural</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select className="form-input" value={newReq.priority} onChange={e => setNewReq({ ...newReq, priority: e.target.value })}>
                      <option value="LOW">Low - No immediate impact</option>
                      <option value="MEDIUM">Medium - Needs attention</option>
                      <option value="HIGH">High - Significant impact</option>
                      <option value="EMERGENCY">Emergency - Safety/Damage risk</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Building (Optional)</label>
                    <input className="form-input" value={newReq.building} onChange={e => setNewReq({ ...newReq, building: e.target.value })} placeholder="E.g., North Tower" />
                  </div>
                  <div className="form-group">
                    <label>Unit Number</label>
                    <input required className="form-input" value={newReq.unitNumber} onChange={e => setNewReq({ ...newReq, unitNumber: e.target.value })} placeholder="E.g., 402B" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowNewModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-submit">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
