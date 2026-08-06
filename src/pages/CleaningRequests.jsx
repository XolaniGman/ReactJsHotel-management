import { useEffect, useState } from 'react';
import {
  listAmenityRequests,
  updateAmenityRequestStatus,
} from '../services/amenityService';
import { formatDateTime, formatPrice } from '../lib/utils';
import './housekeeping.css';

export default function CleaningRequests() {
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState('');

  const load = async () => setRequests(await listAmenityRequests());
  useEffect(() => { load(); }, []);

  const advance = async (id, status) => {
    await updateAmenityRequestStatus(id, status);
    setNotice(`Request ${status}.`);
    load();
  };

  const counts = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'Pending').length,
    inProgress: requests.filter((r) => r.status === 'InProgress').length,
    completed: requests.filter((r) => r.status === 'Completed').length,
  };

  return (
    <div className="inventory-page">
      <div className="inventory-hero d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <h1 className="inventory-title h2">Guest Requested Items</h1>
          <p className="inventory-subtitle">
            Items requested by guests that housekeeping needs to prepare and deliver.
          </p>
        </div>
        <div className="inventory-stat-row">
          <span className="inventory-stat-pill info"><i className="bi bi-person-check" />Guest Requests: {counts.total}</span>
          <span className="inventory-stat-pill success"><i className="bi bi-broom" />Completed: {counts.completed}</span>
        </div>
      </div>

      {notice && <div className="lux-alert lux-alert-success mb-4">{notice}</div>}

      <div className="request-summary-bar">
        <div><strong>{counts.total}</strong><span>Total Requests</span></div>
        <div><strong>{counts.pending}</strong><span>Pending</span></div>
        <div><strong>{counts.inProgress}</strong><span>In Progress</span></div>
        <div><strong>{counts.completed}</strong><span>Completed</span></div>
      </div>

      {requests.length === 0 ? (
        <div className="empty-request-state"><i className="bi bi-bell" />No guest requests right now.</div>
      ) : (
        <div className="request-card-grid">
          {requests.map((request) => (
            <article className="guest-request-card" key={request.id}>
              <div className="request-card-top">
                <span className="room-badge">Room {request.roomNumber || '—'}</span>
                <div className="request-status-actions">
                  <span className={`request-status ${request.status === 'Completed' ? 'completed' : request.status === 'InProgress' ? 'progressing' : 'pending'}`}>{request.status}</span>
                </div>
              </div>
              <div className="request-card-main">
                <h3>{request.guestName}</h3>
                <p className="request-item-name">{request.amenityName} × {request.quantity}</p>
                <p className="request-description">
                  {request.unitPrice > 0 ? `Chargeable: ${formatPrice(request.totalPrice)}` : 'Complimentary'}
                </p>
              </div>
              <div className="request-meta-row">
                <span><i className="bi bi-clock me-1" />{formatDateTime(request.createdAt)}</span>
                <span><i className="bi bi-gift me-1" />{request.unitPrice > 0 ? formatPrice(request.totalPrice) : 'Free'}</span>
              </div>
              <div className="request-actions">
                {request.status === 'Pending' && (
                  <button type="button" className="btn-request-start btn-request-done" onClick={() => advance(request.id, 'InProgress')}>Start</button>
                )}
                {request.status === 'InProgress' && (
                  <button type="button" className="btn-request-complete btn-request-done" onClick={() => advance(request.id, 'Completed')}>Complete</button>
                )}
                {request.status === 'Completed' && <span className="text-success small">Delivered{request.unitPrice > 0 ? ' · billed' : ''}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
