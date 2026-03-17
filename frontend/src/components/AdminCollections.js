import React, { useState, useEffect, useCallback } from 'react';
import { isAdminUser } from '../config/adminEmails';
import './AdminCardDatabase.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

const AdminCollections = () => {
  const [collectors, setCollectors] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collectionCards, setCollectionCards] = useState([]);

  const [newCollectorName, setNewCollectorName] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [newCardPayload, setNewCardPayload] = useState('');

  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [cardSearchYear, setCardSearchYear] = useState('');
  const [cardSearchRelease, setCardSearchRelease] = useState('');
  const [cardSearchName, setCardSearchName] = useState('');
  const [cardSearchResults, setCardSearchResults] = useState([]);
  const [cardSearchLoading, setCardSearchLoading] = useState(false);
  const [cardSearchError, setCardSearchError] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const clearStatus = () => {
    setError('');
    setMessage('');
    setCardSearchError('');
  };

  const fetchCollectors = useCallback(async () => {
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
  }, []);

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
        const rawCards = json.data?.cards || json.data || [];
        setCollectionCards(Array.isArray(rawCards) ? rawCards : []);
      } else {
        setError(json.error || 'Failed to load collection cards');
      }
    } catch (e) {
      setError(e.message || 'Failed to load collection cards');
    }
  };

  useEffect(() => {
    fetchCollectors();
  }, [fetchCollectors]);

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

  const handleCardSearch = async (e) => {
    e.preventDefault();
    setCardSearchError('');
    setCardSearchResults([]);
    if (
      !cardSearchName.trim() &&
      !cardSearchQuery.trim()
    ) {
      setCardSearchError('Enter at least a player / card name.');
      return;
    }
    setCardSearchLoading(true);
    try {
      const attempts = [];

      // 1) Preferred: name + cardNumber
      if (cardSearchName.trim() && cardSearchQuery.trim()) {
        attempts.push({
          name: cardSearchName.trim(),
          cardNumber: cardSearchQuery.trim(),
          take: '25',
        });
      }

      // 2) Fallback: name only
      if (cardSearchName.trim()) {
        attempts.push({
          name: cardSearchName.trim(),
          take: '25',
        });
      }

      // 3) Last resort: raw extra text as name
      if (cardSearchQuery.trim() && !cardSearchName.trim()) {
        attempts.push({
          name: cardSearchQuery.trim(),
          take: '25',
        });
      }

      let found = null;
      for (const paramsObj of attempts) {
        const params = new URLSearchParams(paramsObj);
        const res = await fetch(`${API_BASE_URL}/api/cardsight/cards?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          const results = json.data?.cards || json.data?.results || json.data || [];
          if (Array.isArray(results) && results.length > 0) {
            found = results;
            break;
          }
        }
      }

      if (found && found.length > 0) {
        setCardSearchResults(found);
      } else {
        setCardSearchError('No matches found. Try adjusting name or card number.');
      }
    } catch (err) {
      setCardSearchError(err.message || 'Search failed');
    } finally {
      setCardSearchLoading(false);
    }
  };

  const selectedCollector = collectors.find(c => c.id === selectedCollectorId);
  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  if (!isAdminUser()) {
    return (
      <div className="admin-only-message">
        <h2>🔒 Admin Access Required</h2>
        <p>You must be logged in as an admin to access this page.</p>
      </div>
    );
  }

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

        {/* CardSight catalog search to help pick cardId */}
        <div style={{ marginBottom: 16, background: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 8 }}>
          <h3>Search CardSight Catalog (Cards)</h3>
          <form onSubmit={handleCardSearch} style={{ marginBottom: 8, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            <input
              type="text"
              placeholder="Year (optional)"
              value={cardSearchYear}
              onChange={(e) => setCardSearchYear(e.target.value)}
              className="player-search-input"
            />
            <input
              type="text"
              placeholder="Release (optional)"
              value={cardSearchRelease}
              onChange={(e) => setCardSearchRelease(e.target.value)}
              className="player-search-input"
            />
            <input
              type="text"
              placeholder="Player / card name (e.g. Cooper Flagg)"
              value={cardSearchName}
              onChange={(e) => setCardSearchName(e.target.value)}
              className="player-search-input"
            />
            <input
              type="text"
              placeholder="Card # (e.g. 401)"
              value={cardSearchQuery}
              onChange={(e) => setCardSearchQuery(e.target.value)}
              className="player-search-input"
            />
            <button
              type="submit"
              className="upload-btn"
              disabled={cardSearchLoading || (!cardSearchName.trim() && !cardSearchQuery.trim())}
              style={{ gridColumn: 'span 4', marginTop: 2 }}
            >
              {cardSearchLoading ? 'Searching…' : 'Search Cards'}
            </button>
          </form>
          {cardSearchError && (
            <div className="error-message" style={{ marginBottom: 8 }}>
              {cardSearchError}
            </div>
          )}
          <div style={{ maxHeight: 240, overflow: 'auto', borderTop: '1px solid #333', paddingTop: 6 }}>
            {cardSearchResults.length === 0 && !cardSearchLoading && (
              <p style={{ color: '#aaa', fontSize: '0.85em' }}>No search results yet. Try a name and card number.</p>
            )}
            {cardSearchResults.map((card) => {
              const details = card.cardSnapshot || card.cardDetails || card;
              const name = details.cardName || details.name || card.id;
              const setLine = [
                details.releaseYear,
                details.releaseName,
                details.setName,
              ].filter(Boolean).join(' • ');
              const cardNumber =
                details.cardNumber ||
                details.card_number ||
                details.number ||
                '';
              const parallel = details.parallelName || details.parallel || 'Base';
              const detailsLine = [
                cardNumber && `#${cardNumber}`,
                parallel,
              ].filter(Boolean).join(' • ');
              return (
                <div
                  key={card.id}
                  style={{
                    padding: '6px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                  const payload = { cardId: card.id };
                    setNewCardPayload(JSON.stringify(payload, null, 2));
                    setMessage(`Prepared payload for card ${name}. Click "Add Card(s) to Collection".`);
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{name}</div>
                  {setLine && (
                    <div style={{ fontSize: '0.8em', color: '#aaa' }}>{setLine}</div>
                  )}
                  {detailsLine && (
                    <div style={{ fontSize: '0.8em', color: '#bbb' }}>{detailsLine}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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
          {collectionCards.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                  <th style={{ padding: '4px 6px' }}>Name</th>
                  <th style={{ padding: '4px 6px' }}>Set / Release</th>
                  <th style={{ padding: '4px 6px' }}>Card #</th>
                  <th style={{ padding: '4px 6px' }}>Parallel</th>
                  <th style={{ padding: '4px 6px' }}>Qty</th>
                  <th style={{ padding: '4px 6px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {collectionCards.map((card) => {
                  const details = card.cardSnapshot || card.cardDetails || card;
                  const name = details.cardName || details.name || card.id || card.cardId;
                  const setLine = [
                    details.releaseYear,
                    details.releaseName,
                    details.setName,
                  ].filter(Boolean).join(' • ');
                  const rawParallel = details.parallelName || details.parallel || '';
                  const parallel = rawParallel || 'Base';
                  const cardNumber = details.cardNumber || '';
                  const qty = card.quantity ?? card.count ?? 1;
                  return (
                    <tr
                      key={card.id || card.cardId}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <td style={{ padding: '4px 6px', textAlign: 'left' }}>{name}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{setLine}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{cardNumber}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{parallel}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{qty}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="clear-db-btn"
                          style={{ marginRight: 6, padding: '2px 6px', fontSize: '0.8em' }}
                          onClick={async () => {
                            if (!selectedCollectionId) return;
                            const confirmed = window.confirm(`Remove "${name}" from this collection?`);
                            if (!confirmed) return;
                            try {
                              const res = await fetch(
                                `${API_BASE_URL}/api/cardsight/collections/${selectedCollectionId}/cards/${card.cardId || card.card_id || card.cardSnapshot?.cardsightCardId || details.id}`,
                                { method: 'DELETE' }
                              );
                              const json = await res.json();
                              if (json.success) {
                                setMessage('Card removed from collection.');
                                fetchCollectionCards(selectedCollectionId);
                              } else {
                                setError(json.error || 'Failed to remove card from collection');
                              }
                            } catch (e) {
                              setError(e.message || 'Failed to remove card from collection');
                            }
                          }}
                        >
                          Delete
                        </button>
                        <details style={{ display: 'inline-block' }}>
                          <summary style={{ cursor: 'pointer', color: '#ffd700', fontSize: '0.85em', display: 'inline' }}>
                            View
                          </summary>
                          <pre style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75em', color: '#ccc' }}>
                            {JSON.stringify(card, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCollections;

