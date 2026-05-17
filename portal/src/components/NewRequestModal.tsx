import { useState, type FormEvent } from 'react';
import type { MaintenanceRequest } from '../types';
import { createRequest } from '../api';

interface NewRequestModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function NewRequestModal({ onClose, onSuccess }: NewRequestModalProps) {
  const [newReq, setNewReq] = useState<Partial<MaintenanceRequest>>({
    title: '', description: '', category: 'PLUMBING', priority: 'MEDIUM', unitNumber: '', building: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateRequest(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return; // Prevent multiple requests
    
    setIsSubmitting(true);
    try {
      await createRequest(newReq);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>New Maintenance Request</h2>
          <button onClick={onClose} className="btn-close" disabled={isSubmitting}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={handleCreateRequest}>
          <div className="modal-body">
            <div className="form-group">
              <label>Title</label>
              <input required className="form-input" value={newReq.title} onChange={e => setNewReq({ ...newReq, title: e.target.value })} placeholder="E.g., Leaking faucet" disabled={isSubmitting} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea required className="form-input" rows={4} value={newReq.description} onChange={e => setNewReq({ ...newReq, description: e.target.value })} placeholder="Please describe the issue in detail..." disabled={isSubmitting} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select className="form-input" value={newReq.category} onChange={e => setNewReq({ ...newReq, category: e.target.value })} disabled={isSubmitting}>
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
                <select className="form-input" value={newReq.priority} onChange={e => setNewReq({ ...newReq, priority: e.target.value as MaintenanceRequest['priority'] })} disabled={isSubmitting}>
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
                <input className="form-input" value={newReq.building} onChange={e => setNewReq({ ...newReq, building: e.target.value })} placeholder="E.g., North Tower" disabled={isSubmitting} />
              </div>
              <div className="form-group">
                <label>Unit Number</label>
                <input required className="form-input" value={newReq.unitNumber} onChange={e => setNewReq({ ...newReq, unitNumber: e.target.value })} placeholder="E.g., 402B" disabled={isSubmitting} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
