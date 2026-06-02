import { useState } from 'react';
import type { MaintenanceRequest } from '../types';
import { updateRequestStatus, addComment } from '../api';
import { HashIcon, ClockIcon } from './Icons';

interface RequestCardProps {
  req: MaintenanceRequest;
  isAdmin: boolean;
  onStatusUpdated: () => void;
}

export function RequestCard({ req, isAdmin, onStatusUpdated }: RequestCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  async function handleStatusChange(requestId: string, newStatus: string) {
    setIsUpdating(true);
    try {
      await updateRequestStatus(requestId, newStatus);
      onStatusUpdated();
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    setIsCommenting(true);
    try {
      await addComment(req.requestId, newComment);
      setNewComment('');
      onStatusUpdated();
    } catch (err) {
      alert('Failed to add comment');
    } finally {
      setIsCommenting(false);
    }
  }

  return (
    <div className="request-card">
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              className="form-input"
              style={{ padding: '6px 10px', fontSize: '13px' }}
              value={req.status}
              onChange={(e) => handleStatusChange(req.requestId, e.target.value)}
              disabled={isUpdating}
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            {isUpdating && <div className="spinner" style={{ width: '20px', height: '20px', marginBottom: 0 }}></div>}
          </div>
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

      <div className="comments-section" style={{ marginTop: '16px' }}>
        <button 
          className="btn-secondary" 
          style={{ width: '100%', padding: '8px', fontSize: '13px' }}
          onClick={() => setShowComments(!showComments)}
        >
          {showComments ? 'Hide Comments' : `View Comments (${req.comments?.length || 0})`}
        </button>

        {showComments && (
          <div className="comments-list" style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
            {req.comments?.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', margin: '8px 0' }}>No comments yet.</div>
            ) : (
              req.comments?.map(c => (
                <div key={c.id} style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: c.role === 'admin' ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {c.role === 'admin' ? 'Admin' : 'Resident'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{c.text}</div>
                </div>
              ))
            )}
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <input 
                className="form-input" 
                style={{ padding: '8px', fontSize: '13px' }}
                placeholder="Add a comment..." 
                value={newComment} 
                onChange={(e) => setNewComment(e.target.value)} 
                disabled={isCommenting}
              />
              <button 
                className="btn-primary" 
                style={{ padding: '8px 16px', fontSize: '13px', width: 'auto' }}
                onClick={handleAddComment}
                disabled={isCommenting || !newComment.trim()}
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
