import React, { useState, useEffect } from 'react';
import { isAdminUser } from '../config/adminEmails';
import './AdminCardDatabase.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

const AdminCollections = () => {
  if (!isAdminUser()) {
    return (
      <div className="admin-only-message">
        <h2>🔒 Admin Access Required</h2>
        <p>You must be logged in as an admin to access this page.</p>
      </div>
    );
  }

  const [collectors, setCollectors] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collectionCards, setCollectionCards] = useState([]);

  const [newCollectorName, setNewCollectorName] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [newCardPayload, setNewCardPayload] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const clearStatus = () => {
    setError('');
    setMessage('');
  };

  const fetchCollectors = async () => {
    clearStatus();
    try {
      const res = await fetch(`${API_BASE_URL}/api/cardsight/collectors`);
      const json = await res.json();
      if (json.success) {
        setCollectors(json.data?.collectors || json.data || []);
      } else {
        setError(json.error || 'Failed to load collectors');
      }
    } catch (e) {
      setError(e.message || 'Failed to load collectors');
    }
  };

  const fetchCollections = async (collectorId) => {
    clearStatus();
    if (!collectorId) {
      setCollections([]);
      setCollectionCards([]);
      setSelectedCollectionId('');
      return;
    }
    try {
      const params = new URLSearchParams({ collectorId });
      const res = await fetch(`${API_BASE_URL}/api/cardsight/collections?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setCollections(json.data?.collections || json.data || []);
      } else {
        setError(json.error || 'Failed to load collections');
      }
    } catch (e) {
      setError(e.message || 'Failed to load collections');
    }
  };

  const fetchCollectionCards = async (collectionId) => {
    clearStatus();
    if (!collectionId) {
      setCollectionCards([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/cardsight/collections/${collectionId}/cards`);
      const json = await res.json();
      if (json.success) {
        setCollectionCards(json.data?.cards || json.data || []);
      } else {
        setError(json.error || 'Failed to load collection cards');
      }
    } catch (e) {
      setError(e.message || 'Failed to load collection cards');
    }
  };

  useEffect(() => {
    fetchCollectors();
  }, []);

  const handleCreateCollector = async (e) => {
    e.preventDefault();
    clearStatus();
    if (!newCollectorName.trim()) {
      setError('Enter a collector name');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cardsight/collectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectorName.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage('Collector created.');
        setNewCollectorName('');
        fetchCollectors();
      } else {
        setError(json.error || 'Failed to create collector');
      }
    } catch (e) {
      setError(e.message || 'Failed to create collector');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    clearStatus();
    if (!selectedCollectorId) {
      setError('Select a collector first');
      return;
    }
    if (!newCollectionName.trim()) {
      setError('Enter a collection name');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cardsight/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectorId: selectedCollectorId,
          name: newCollectionName.trim(),
          description: newCollectionDescription.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage('Collection created.');
        setNewCollectionName('');
        setNewCollectionDescription('');
        fetchCollections(selectedCollectorId);
      } else {
        setError(json.error || 'Failed to create collection');
      }
    } catch (e) {
      setError(e.message || 'Failed to create collection');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    clearStatus();
    if (!selectedCollectionId) {
      setError('Select a collection first');
      return;
    }
    if (!newCardPayload.trim()) {
      setError('Enter a card payload (JSON or simple cardId)');
      return;
    }
    let body;
    try {
      // Allow either raw cardId string or full JSON body
      if (newCardPayload.trim().startsWith('{') || newCardPayload.trim().startsWith('[')) {
        body = JSON.parse(newCardPayload);
      } else {
        body = { cardId: newCardPayload.trim() };
      }
    } catch (e2) {
      setError('Invalid JSON for card payload');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cardsight/collections/${selectedCollectionId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setMessage('Card(s) added to collection.');
        setNewCardPayload('');
        fetchCollectionCards(selectedCollectionId);
      } else {
        setError(json.error || 'Failed to add card(s)');
      }
    } catch (e) {
      setError(e.message || 'Failed to add card(s)');
    } finally {
      setLoading(false);
    }
  };

  const selectedCollector = collectors.find(c => c.id === selectedCollectorId);
  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  return (
    <div className="tcdb-browser">
      <div className="tcdb-header">
        <h1>📂 CardSight Collections (Admin)</h1>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {message && (
        <div className="success-message" style={{ marginBottom: 12, color: '#8f8' }}>
          {message}
        </div>
      )}

      <div className="player-search-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Collectors */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 8 }}>
          <h2>Collectors</h2>
          <form onSubmit={handleCreateCollector} style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Collector name (e.g. Mike)"
              value={newCollectorName}
              onChange={(e) => setNewCollectorName(e.target.value)}
              className="player-search-input"
            />
            <button
              type="submit"
              className="upload-btn"
              disabled={loading || !newCollectorName.trim()}
              style={{ marginTop: 8 }}
            >
              Create Collector
            </button>
          </form>

          <div style={{ maxHeight: 220, overflow: 'auto', borderTop: '1px solid #333', paddingTop: 8 }}>
            {collectors.length === 0 && <p style={{ color: '#aaa' }}>No collectors yet.</p>}
            {collectors.map(c => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div>
                  <div style={{ fontWeight: selectedCollectorId === c.id ? 'bold' : 'normal' }}>{c.name || c.id}</div>
                  <div style={{ fontSize: '0.8em', color: '#888' }}>{c.id}</div>
                </div>
                <button
                  type="button"
                  className="clear-db-btn"
                  onClick={() => {
                    setSelectedCollectorId(c.id);
                    setSelectedCollectionId('');
                    setCollectionCards([]);
                    fetchCollections(c.id);
                  }}
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Collections for selected collector */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 8 }}>
          <h2>Collections {selectedCollector ? `for ${selectedCollector.name || selectedCollector.id}` : ''}</h2>
          <form onSubmit={handleCreateCollection} style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Collection name (e.g. PC, Prospects)"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              className="player-search-input"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newCollectionDescription}
              onChange={(e) => setNewCollectionDescription(e.target.value)}
              className="player-search-input"
              style={{ marginTop: 6 }}
            />
            <button
              type="submit"
              className="upload-btn"
              disabled={loading || !selectedCollectorId || !newCollectionName.trim()}
              style={{ marginTop: 8 }}
            >
              Create Collection
            </button>
          </form>

          <div style={{ maxHeight: 220, overflow: 'auto', borderTop: '1px solid #333', paddingTop: 8 }}>
            {collections.length === 0 && <p style={{ color: '#aaa' }}>No collections yet for this collector.</p>}
            {collections.map(col => (
              <div
                key={col.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div>
                  <div style={{ fontWeight: selectedCollectionId === col.id ? 'bold' : 'normal' }}>{col.name || col.id}</div>
                  <div style={{ fontSize: '0.8em', color: '#888' }}>{col.id}</div>
                </div>
                <button
                  type="button"
                  className="clear-db-btn"
                  onClick={() => {
                    setSelectedCollectionId(col.id);
                    fetchCollectionCards(col.id);
                  }}
                >
                  View Cards
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cards in selected collection */}
      <div style={{ marginTop: 24, background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 8 }}>
        <h2>
          Cards in Collection{' '}
          {selectedCollection ? (selectedCollection.name || selectedCollection.id) : ''}
        </h2>

        <form onSubmit={handleAddCard} style={{ marginBottom: 12 }}>
          <textarea
            placeholder='Card payload (e.g. { "cardId": "uuid" } or JSON array)'
            value={newCardPayload}
            onChange={(e) => setNewCardPayload(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #444', background: 'rgba(0,0,0,0.4)', color: '#fff' }}
          />
          <button
            type="submit"
            className="upload-btn"
            disabled={loading || !selectedCollectionId}
            style={{ marginTop: 8 }}
          >
            Add Card(s) to Collection
          </button>
        </form>

        <div style={{ maxHeight: 260, overflow: 'auto', borderTop: '1px solid #333', paddingTop: 8 }}>
          {collectionCards.length === 0 && <p style={{ color: '#aaa' }}>No cards in this collection yet.</p>}
          {collectionCards.map(card => (
            <div
              key={card.id || card.cardId}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{card.cardName || card.name || card.id || card.cardId}</div>
              <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.8em', color: '#ccc' }}>
                {JSON.stringify(card, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminCollections;

