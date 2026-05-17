import type { MaintenanceRequest } from '../types';
import { updateRequestStatus } from '../api';
import { HashIcon, ClockIcon } from './Icons';

interface RequestCardProps {
  req: MaintenanceRequest;
  isAdmin: boolean;
  onStatusUpdated: () => void;
}

export function RequestCard({ req, isAdmin, onStatusUpdated }: RequestCardProps) {
  async function handleStatusChange(requestId: string, newStatus: string) {
    try {
      await updateRequestStatus(requestId, newStatus);
      onStatusUpdated();
    } catch (err) {
      alert('Failed to update status');
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
  );
}
