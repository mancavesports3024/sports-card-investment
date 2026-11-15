import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { isAdminUser } from '../config/adminEmails';
import tokenService from '../services/tokenService';
import './AdminCardDatabase.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

const EMPTY_FORM = {
  title: '',
  brand: '',
  sport: '',
  releaseDate: '',
  year: '',
  description: '',
  retailPrice: '',
  hobbyPrice: '',
  source: '',
};

const FORM_FIELDS = Object.keys(EMPTY_FORM);

const fieldStyle = {
  width: '100%',
  minWidth: 0,
  padding: '8px 12px',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: 14,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const thStyle = { textAlign: 'center' };

const toForm = (release) =>
  FORM_FIELDS.reduce((form, field) => ({ ...form, [field]: release[field] ?? '' }), {});

const normalizeTitle = (title) => (title || '').trim().toLowerCase();

const AdminReleases = () => {
  const isAdmin = isAdminUser();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, release = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/releases`);
      const json = await res.json();
      if (json.success) {
        setReleases(json.releases || []);
      } else {
        setError(json.error || 'Failed to load releases');
      }
    } catch (e) {
      setError(e.message || 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchReleases();
  }, [isAdmin, fetchReleases]);

  const visibleReleases = useMemo(() => {
    const query = normalizeTitle(search);
    return releases
      .filter((r) => !query || normalizeTitle(r.title).includes(query))
      .sort((a, b) =>
        (b.releaseDate || '').localeCompare(a.releaseDate || '') || (a.title || '').localeCompare(b.title || '')
      );
  }, [releases, search]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setMessage('');
    setEditing({});
  };

  const openEdit = (release) => {
    setForm(toForm(release));
    setFormError('');
    setMessage('');
    setEditing(release);
  };

  const closeForm = () => {
    setEditing(null);
    setFormError('');
  };

  const updateField = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'releaseDate' && !prev.year && /^\d{4}-/.test(value)) {
        next.year = value.slice(0, 4);
      }
      return next;
    });
  };

  const authedRequest = async (url, options) => {
    try {
      const res = await tokenService.authenticatedFetch(url, options);
      const json = await res.json();
      if (res.status === 401) {
        return { ok: false, error: 'Admin session not accepted. Sign out and sign in again.' };
      }
      return { ok: res.ok && json.success, error: json.error || json.message, json };
    } catch (e) {
      return { ok: false, error: e.message || 'Request failed' };
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.releaseDate)) {
      setFormError('Release date is required');
      return;
    }

    const isNew = !editing.id;
    const duplicate = releases.find(
      (r) => r.id !== editing.id && normalizeTitle(r.title) === normalizeTitle(form.title)
    );
    if (
      duplicate &&
      !window.confirm(`A release titled "${duplicate.title}" already exists (${duplicate.releaseDate}). Save anyway?`)
    ) {
      return;
    }

    setSaving(true);
    const result = await authedRequest(
      isNew ? `${API_BASE_URL}/api/releases` : `${API_BASE_URL}/api/releases/${editing.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }
    );
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error || 'Failed to save release');
      return;
    }
    setMessage(`${isNew ? 'Added' : 'Saved'} "${result.json.release?.title || form.title}".`);
    setEditing(null);
    fetchReleases();
  };

  const handleDelete = async (release) => {
    setMessage('');
    setError('');
    if (!window.confirm(`Delete "${release.title}" (${release.releaseDate})? It will be removed from the public calendar.`)) {
      return;
    }
    const result = await authedRequest(`${API_BASE_URL}/api/releases/${release.id}`, { method: 'DELETE' });
    if (!result.ok) {
      setError(result.error || 'Failed to delete release');
      return;
    }
    setMessage(`Deleted "${release.title}".`);
    fetchReleases();
  };

  if (!isAdmin) {
    return (
      <div className="admin-only-message">
        <h2>🔒 Admin Access Required</h2>
        <p>You must be logged in as an admin to access this page.</p>
      </div>
    );
  }

  return (
    <div className="admin-card-database">
      <div className="page-header">
        <h1>📅 Release Calendar (Admin)</h1>
        <p>Add, edit, or delete releases shown on the public release calendar.</p>
      </div>

      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group" style={{ flex: 1 }}>
            <label htmlFor="release-search">Search by title</label>
            <input
              id="release-search"
              type="text"
              className="filter-input"
              placeholder="e.g. Topps Chrome"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className="search-btn" onClick={openNew}>
            + Add Release
          </button>
        </div>
      </div>

      {message && <div className="results-info" style={{ color: '#8f8', textAlign: 'left' }}>{message}</div>}
      {error && <div className="error">{error}</div>}

      <div className="results-info">
        {visibleReleases.length} of {releases.length} releases
      </div>

      {loading && releases.length === 0 ? (
        <div className="loading">Loading releases…</div>
      ) : (
        <div className="cards-table-container">
          <table className="cards-table">
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Brand</th>
                <th style={thStyle}>Sport</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Retail</th>
                <th style={thStyle}>Hobby</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleReleases.map((r) => (
                <tr key={r.id}>
                  <td className="card-date" style={{ whiteSpace: 'nowrap' }}>{r.releaseDate}</td>
                  <td style={{ color: '#ffd700', fontWeight: 'bold', minWidth: 200 }}>{r.title}</td>
                  <td>{r.brand}</td>
                  <td>{r.sport}</td>
                  <td>{r.status}</td>
                  <td style={{ color: '#ccc' }}>{r.retailPrice || '—'}</td>
                  <td style={{ color: '#ccc' }}>{r.hobbyPrice || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="edit-btn" onClick={() => openEdit(r)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="edit-btn"
                      style={{ background: '#dc3545', color: '#fff' }}
                      onClick={() => handleDelete(r)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {visibleReleases.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#aaa' }}>
                    No releases match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing.id ? 'Edit Release' : 'Add Release'}</h2>
              <button type="button" className="close-btn" onClick={closeForm} aria-label="Close">
                ×
              </button>
            </div>
            {formError && <div className="error-message">{formError}</div>}
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="release-title">Title</label>
                <input id="release-title" type="text" style={fieldStyle} value={form.title} onChange={updateField('title')} required />
              </div>
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ minWidth: 160 }}>
                  <label htmlFor="release-date">Release date</label>
                  <input
                    id="release-date"
                    type="date"
                    style={fieldStyle}
                    value={form.releaseDate}
                    onChange={updateField('releaseDate')}
                    required
                  />
                </div>
                <div className="form-group" style={{ minWidth: 100 }}>
                  <label htmlFor="release-year">Year</label>
                  <input id="release-year" type="text" style={fieldStyle} maxLength={4} value={form.year} onChange={updateField('year')} />
                </div>
              </div>
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ minWidth: 160 }}>
                  <label htmlFor="release-brand">Brand</label>
                  <input id="release-brand" type="text" style={fieldStyle} value={form.brand} onChange={updateField('brand')} />
                </div>
                <div className="form-group" style={{ minWidth: 160 }}>
                  <label htmlFor="release-sport">Sport</label>
                  <input id="release-sport" type="text" style={fieldStyle} value={form.sport} onChange={updateField('sport')} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="release-description">Description</label>
                <textarea
                  id="release-description"
                  rows={3}
                  style={fieldStyle}
                  value={form.description}
                  onChange={updateField('description')}
                />
              </div>
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ minWidth: 160 }}>
                  <label htmlFor="release-retail">Retail price (optional)</label>
                  <input
                    id="release-retail"
                    type="text"
                    style={fieldStyle}
                    maxLength={50}
                    placeholder="e.g. Mega $29.99, Tin $44.99"
                    value={form.retailPrice}
                    onChange={updateField('retailPrice')}
                  />
                </div>
                <div className="form-group" style={{ minWidth: 160 }}>
                  <label htmlFor="release-hobby">Hobby price (optional)</label>
                  <input
                    id="release-hobby"
                    type="text"
                    style={fieldStyle}
                    maxLength={50}
                    placeholder="e.g. $119.99"
                    value={form.hobbyPrice}
                    onChange={updateField('hobbyPrice')}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="release-source">Source</label>
                <input
                  id="release-source"
                  type="text"
                  style={fieldStyle}
                  placeholder="e.g. Topps (defaults to Manual)"
                  value={form.source}
                  onChange={updateField('source')}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="save-btn" disabled={saving}>
                  {saving ? 'Saving…' : editing.id ? 'Save Changes' : 'Add Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReleases;
