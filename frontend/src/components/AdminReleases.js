import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isAdminUser } from '../config/adminEmails';
import { deriveStatus, todayInCalendarZone } from '../services/releaseCalendar';
import './adminSharedStyles';

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
  source: 'Manual',
};

const authHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('authToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const signedInEmail = () => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1])).email || null;
  } catch {
    return null;
  }
};

const priceForApi = (value) => {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
};

const AdminReleases = () => {
  const [releases, setReleases] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const clearStatus = () => {
    setError('');
    setMessage('');
  };

  const fetchReleases = useCallback(async () => {
    clearStatus();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/releases`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Failed to load releases');
        return;
      }
      setReleases(Array.isArray(json.releases) ? json.releases : []);
    } catch (e) {
      setError(e.message || 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminUser()) fetchReleases();
  }, [fetchReleases]);

  const sortedFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? releases.filter((r) => (r.title || '').toLowerCase().includes(q))
      : releases.slice();
    return list.sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')));
  }, [releases, search]);

  const previewStatus = form.releaseDate
    ? deriveStatus(form.releaseDate, todayInCalendarZone())
    : '—';

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (release) => {
    clearStatus();
    setEditingId(release.id);
    setForm({
      title: release.title || '',
      brand: release.brand || '',
      sport: release.sport || '',
      releaseDate: release.releaseDate || '',
      year: release.year || '',
      description: release.description || '',
      retailPrice: release.retailPrice || '',
      hobbyPrice: release.hobbyPrice || '',
      source: release.source || 'Manual',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearStatus();
    if (!form.title.trim() || !form.releaseDate) {
      setError('Title and release date are required.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      brand: form.brand.trim() || null,
      sport: form.sport.trim() || null,
      releaseDate: form.releaseDate,
      year: form.year.trim() || null,
      description: form.description.trim() || null,
      retailPrice: priceForApi(form.retailPrice),
      hobbyPrice: priceForApi(form.hobbyPrice),
      source: form.source.trim() || 'Manual',
    };

    setSaving(true);
    try {
      const url = editingId
        ? `${API_BASE_URL}/api/releases/${editingId}`
        : `${API_BASE_URL}/api/releases`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(
          editingId
            ? payload
            : { ...payload, createdBy: signedInEmail() || undefined }
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || json.message || 'Save failed');
        return;
      }
      setMessage(editingId ? 'Release updated.' : 'Release added.');
      resetForm();
      await fetchReleases();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (release) => {
    clearStatus();
    const ok = window.confirm(
      `Delete "${release.title}" (${release.releaseDate})?\n\nThis removes it from the public calendar.`
    );
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/releases/${release.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || json.message || 'Delete failed');
        return;
      }
      setMessage('Release deleted.');
      if (editingId === release.id) resetForm();
      await fetchReleases();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdminUser()) {
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
        <p>Add, edit, or delete releases. Status follows the release date automatically.</p>
      </div>

      {error && <div className="error-message" style={{ marginBottom: 12 }}>{error}</div>}
      {message && (
        <div className="success-message" style={{ marginBottom: 12, color: '#8f8' }}>
          {message}
        </div>
      )}

      <div className="filters-section">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit release' : 'Add release'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="filter-row">
            <div className="filter-group" style={{ flex: 2, minWidth: 220 }}>
              <label htmlFor="release-title">Title</label>
              <input
                id="release-title"
                className="filter-input"
                value={form.title}
                onChange={handleChange('title')}
                required
              />
            </div>
            <div className="filter-group">
              <label htmlFor="release-brand">Brand</label>
              <input
                id="release-brand"
                className="filter-input"
                value={form.brand}
                onChange={handleChange('brand')}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="release-sport">Sport</label>
              <input
                id="release-sport"
                className="filter-input"
                value={form.sport}
                onChange={handleChange('sport')}
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="release-date">Release date</label>
              <input
                id="release-date"
                type="date"
                className="filter-input"
                value={form.releaseDate}
                onChange={handleChange('releaseDate')}
                required
              />
            </div>
            <div className="filter-group">
              <label htmlFor="release-year">Year</label>
              <input
                id="release-year"
                className="filter-input"
                value={form.year}
                onChange={handleChange('year')}
                placeholder="2026"
              />
            </div>
            <div className="filter-group">
              <label htmlFor="release-source">Source</label>
              <input
                id="release-source"
                className="filter-input"
                value={form.source}
                onChange={handleChange('source')}
              />
            </div>
            <div className="filter-group">
              <label>Status</label>
              <input className="filter-input" value={previewStatus} readOnly />
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="release-retail">Retail price (optional)</label>
              <input
                id="release-retail"
                className="filter-input"
                value={form.retailPrice}
                onChange={handleChange('retailPrice')}
                placeholder='e.g. Mega $29.99, Tin $44.99'
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="release-hobby">Hobby price (optional)</label>
              <input
                id="release-hobby"
                className="filter-input"
                value={form.hobbyPrice}
                onChange={handleChange('hobbyPrice')}
                placeholder="e.g. $119.99"
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group" style={{ flex: 1, minWidth: '100%' }}>
              <label htmlFor="release-description">Description</label>
              <textarea
                id="release-description"
                className="filter-input"
                rows={3}
                value={form.description}
                onChange={handleChange('description')}
                style={{ resize: 'vertical', width: '100%' }}
              />
            </div>
          </div>

          <div className="filter-row">
            <button type="submit" className="search-btn" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update release' : 'Add release'}
            </button>
            {editingId && (
              <button type="button" className="clear-db-btn" onClick={resetForm} disabled={saving}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="filters-section">
        <div className="filter-row" style={{ alignItems: 'center' }}>
          <div className="filter-group" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="release-search">Search by title</label>
            <input
              id="release-search"
              className="filter-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter releases…"
            />
          </div>
          <div className="results-info" style={{ margin: 0 }}>
            {loading ? 'Loading…' : `${sortedFiltered.length} of ${releases.length} releases`}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="cards-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Brand</th>
                <th>Sport</th>
                <th>Status</th>
                <th>Retail</th>
                <th>Hobby</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((release) => (
                <tr key={release.id}>
                  <td>{release.releaseDate}</td>
                  <td>{release.title}</td>
                  <td>{release.brand || '—'}</td>
                  <td>{release.sport || '—'}</td>
                  <td>{release.status}</td>
                  <td>{release.retailPrice || '—'}</td>
                  <td>{release.hobbyPrice || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="clear-db-btn"
                      onClick={() => startEdit(release)}
                      disabled={saving}
                      style={{ marginRight: 6 }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="clear-db-btn"
                      onClick={() => handleDelete(release)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && sortedFiltered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#aaa' }}>
                    No releases match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReleases;
