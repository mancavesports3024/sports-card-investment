import React, { useCallback, useEffect, useState } from 'react';
import config from '../config';
import tokenService from '../services/tokenService';
import './EbayInventory.css';

// Staff-only eBay inventory tool. Every call goes to /api/staff/ebay, which checks the Google sign-in token
// and the staff list on the server; no eBay or internal secrets are used in the browser.
const API = `${config.API_BASE_URL}/api/staff/ebay`;

async function api(path, options = {}) {
  const res = await tokenService.authenticatedFetch(`${API}${path}`, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error((body && body.message) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body && body.error;
    err.body = body;
    throw err;
  }
  return body;
}

const postJson = (path, data) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
const money = (p) => (p && p.value !== undefined && p.value !== null ? `$${p.value}` : '—');
const when = (iso) => (iso ? new Date(iso).toLocaleString() : 'never');
const label = (row) => `#${row.cardNumber} ${row.cardName || ''}`.trim();
const canEdit = (row) => Boolean(row.cardNumber) && row.soldOut === false && row.pickStatus !== 'NOT_A_VARIATION';

function PriceEditor({ row, title, onApplied }) {
  const [draft, setDraft] = useState(row.price ? row.price.value : '');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  if (!canEdit(row)) {
    return <span className="ebi-muted">{money(row.price)}{row.soldOut ? ' (sold out — can\u2019t reprice)' : ''}</span>;
  }

  const request = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const out = await postJson('/ebay-set-price', { itemId: row.itemId, cardNumber: row.cardNumber, newPrice: draft, ...(row.card ? { card: row.card } : {}) });
      setPreview(out);
    } catch (err) {
      setMessage({ error: true, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const out = await postJson('/ebay-set-price', preview.confirmWith);
      setPreview(null);
      setDraft(out.newPrice.value);
      setMessage({ error: false, text: `Updated. eBay now shows ${money(out.newPrice)}.${out.warnings && out.warnings.length ? ` Note: ${out.warnings.join(', ')}` : ''}` });
      onApplied(out.newPrice);
    } catch (err) {
      setPreview(null);
      setMessage({ error: true, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ebi-price">
      <div className="ebi-price-row">
        <input
          aria-label={`New price for ${label(row)}`}
          inputMode="decimal"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setPreview(null); }}
          disabled={busy}
        />
        <button type="button" onClick={request} disabled={busy || !draft || preview !== null}>Update</button>
      </div>
      <div className="ebi-muted">Now {money(row.price)}</div>
      {preview && (
        <div className="ebi-confirm" role="alertdialog" aria-label="Confirm price change">
          <p>
            Change <strong>{label(row)}</strong> in &ldquo;{preview.change.title || title}&rdquo; from{' '}
            <strong>{money(preview.change.oldPrice)}</strong> to <strong>{money(preview.change.newPrice)}</strong>?
          </p>
          <button type="button" className="ebi-danger" onClick={confirm} disabled={busy}>Confirm change on eBay</button>
          <button type="button" onClick={() => setPreview(null)} disabled={busy}>Cancel</button>
        </div>
      )}
      {message && <div className={message.error ? 'ebi-error' : 'ebi-ok'}>{message.text}</div>}
    </div>
  );
}

function PickTable({ rows, showListing, onOpenListing, onPriceApplied }) {
  return (
    <table className="ebi-table">
      <thead>
        <tr>
          {showListing && <th>Listing</th>}
          <th>Card #</th>
          <th>Card</th>
          <th>Left</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.itemId}|${row.card || row.cardName}`} className={row.soldOut ? 'ebi-soldout' : ''}>
            {showListing && (
              <td data-label="Listing">
                <button type="button" className="ebi-link" onClick={() => onOpenListing(row.itemId)}>{row.title}</button>
              </td>
            )}
            <td data-label="Card #">{row.cardNumber || '—'}</td>
            <td data-label="Card">{row.cardName || row.card || '—'}</td>
            <td data-label="Left">{row.quantityAvailable === null ? '?' : row.quantityAvailable}{row.soldOut ? <span className="ebi-badge">SOLD OUT</span> : null}</td>
            <td data-label="Price"><PriceEditor row={row} title={row.title} onApplied={(price) => onPriceApplied(row, price)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChangeLog() {
  const [changes, setChanges] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api('/ebay-price-changes?limit=50').then((b) => setChanges(b.changes)).catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="ebi-error">{error}</div>;
  if (!changes) return <div className="ebi-muted">Loading change log…</div>;
  if (!changes.length) return <div className="ebi-muted">No price changes yet.</div>;
  return (
    <table className="ebi-table">
      <thead><tr><th>When</th><th>Card</th><th>Change</th><th>Status</th><th>By</th></tr></thead>
      <tbody>
        {changes.map((c) => (
          <tr key={c.id}>
            <td data-label="When">{when(c.requestedAt)}</td>
            <td data-label="Card">{c.card || `#${c.cardNumber}`}<div className="ebi-muted">{c.title}</div></td>
            <td data-label="Change">${c.oldPrice} → ${c.newPrice}{c.readBackPrice && c.readBackPrice !== c.newPrice ? ` (eBay shows $${c.readBackPrice})` : ''}</td>
            <td data-label="Status">{c.status}{c.note ? <div className="ebi-muted">{c.note}</div> : null}</td>
            <td data-label="By">{c.requestedBy}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function EbayInventory() {
  const [access, setAccess] = useState('checking');
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [listing, setListing] = useState(null);
  const [listingFilter, setListingFilter] = useState('');
  const [showLog, setShowLog] = useState(false);

  const loadStatus = useCallback(() => api('/ebay-stock-refresh').then(setStatus).catch((e) => setNotice({ error: true, text: e.message })), []);

  useEffect(() => {
    if (!tokenService.getAccessToken()) { setAccess('signed-out'); return; }
    api('/me')
      .then(() => { setAccess('ok'); loadStatus(); })
      .catch((err) => setAccess(err.status === 403 ? 'forbidden' : err.status === 401 || /Authentication|token/i.test(err.message) ? 'signed-out' : 'error'));
  }, [loadStatus]);

  const refresh = async () => {
    setRefreshing(true);
    setNotice(null);
    try {
      const out = await postJson('/ebay-stock-refresh');
      setNotice({ error: false, text: `Refreshed ${out.itemCount} listings (${out.pickCount} cards) in ${(out.durationMs / 1000).toFixed(1)}s.` });
      await loadStatus();
    } catch (err) {
      setNotice({ error: true, text: `Refresh failed: ${err.message} The previous index was kept.` });
      await loadStatus();
    } finally {
      setRefreshing(false);
    }
  };

  const search = async (e) => {
    e.preventDefault();
    setListing(null);
    setSearching(true);
    setNotice(null);
    try {
      setResults(await api(`/ebay-find-player?name=${encodeURIComponent(query.trim())}`));
    } catch (err) {
      setResults(null);
      setNotice({ error: true, text: err.message });
    } finally {
      setSearching(false);
    }
  };

  const openListing = async (itemId) => {
    setNotice(null);
    setListingFilter('');
    setListing({ loading: true, itemId });
    try {
      setListing(await api(`/ebay-stock?itemId=${encodeURIComponent(itemId)}`));
    } catch (err) {
      setListing(null);
      setNotice({ error: true, text: err.message });
    }
  };

  const applyPrice = (row, price) => {
    const update = (picks) => picks.map((p) => (p.card === row.card ? { ...p, price } : p));
    if (results) setResults({ ...results, listings: results.listings.map((l) => (l.itemId === row.itemId ? { ...l, picks: update(l.picks) } : l)) });
    if (listing && listing.itemId === row.itemId && listing.picks) setListing({ ...listing, picks: update(listing.picks) });
  };

  if (access === 'checking') return <div className="ebi"><p>Checking access…</p></div>;
  if (access === 'signed-out') {
    return (
      <div className="ebi">
        <h1>eBay Inventory</h1>
        <p>Staff sign-in required.</p>
        <button type="button" onClick={() => { window.location.href = `${config.API_BASE_URL}/api/auth/google`; }}>Sign in with Google</button>
      </div>
    );
  }
  if (access === 'forbidden') return <div className="ebi"><h1>eBay Inventory</h1><p>This account is not on the staff list.</p></div>;
  if (access === 'error') return <div className="ebi"><h1>eBay Inventory</h1><p className="ebi-error">Could not reach the inventory service. Try again shortly.</p></div>;

  const resultRows = results ? results.listings.flatMap((l) => l.picks.map((p) => ({ ...p, itemId: l.itemId, title: l.title }))) : [];
  const listingRows = listing && listing.picks
    ? listing.picks
      .map((p) => ({ ...p, itemId: listing.itemId, title: listing.title }))
      .filter((p) => !listingFilter.trim() || `${p.cardNumber} ${p.cardName || p.card}`.toLowerCase().includes(listingFilter.trim().toLowerCase()))
    : [];

  return (
    <div className="ebi">
      <h1>eBay Inventory</h1>
      <div className="ebi-status">
        <span>
          Last refreshed: <strong>{status && status.built ? when(status.refreshedAt) : 'not built yet'}</strong>
          {status && status.built ? ` · ${status.itemCount} listings · ${status.pickCount} cards` : ''}
          {status && status.lastRunStatus === 'FAILED' ? <span className="ebi-error"> · last refresh failed ({status.lastRunError})</span> : null}
        </span>
        <button type="button" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing… (about 30s)' : 'Refresh'}</button>
      </div>

      <form className="ebi-search" onSubmit={search}>
        <input type="search" placeholder="Player name, e.g. Pete Crow-Armstrong" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Player name" />
        <button type="submit" disabled={searching || query.trim().length < 2}>{searching ? 'Searching…' : 'Search'}</button>
      </form>

      {notice && <div className={notice.error ? 'ebi-error' : 'ebi-ok'}>{notice.text}</div>}

      {listing ? (
        <section>
          <button type="button" className="ebi-link" onClick={() => setListing(null)}>← Back to results</button>
          {listing.loading ? <p>Loading listing…</p> : (
            <>
              <h2>{listing.title}</h2>
              <p className="ebi-muted">
                Live from eBay · {listing.pickCount} cards · {listing.availableCount} available · {listing.soldOutCount} sold out
                {listing.url ? <> · <a href={listing.url} target="_blank" rel="noopener noreferrer">Open on eBay</a></> : null}
              </p>
              <input type="search" className="ebi-filter" placeholder="Filter by number or name" value={listingFilter} onChange={(e) => setListingFilter(e.target.value)} aria-label="Filter cards" />
              <PickTable rows={listingRows} showListing={false} onOpenListing={openListing} onPriceApplied={applyPrice} />
            </>
          )}
        </section>
      ) : results && (
        <section>
          <p className="ebi-muted">
            {results.matchCount} cards in {results.listingCount} listings for &ldquo;{results.name}&rdquo; · {results.availableCount} available · {results.soldOutCount} sold out
            {results.truncated ? ' · showing the first results only' : ''} · as of {when(results.index.refreshedAt)}
          </p>
          {resultRows.length ? <PickTable rows={resultRows} showListing onOpenListing={openListing} onPriceApplied={applyPrice} /> : <p>No cards found for that name.</p>}
        </section>
      )}

      <section className="ebi-log">
        <button type="button" className="ebi-link" onClick={() => setShowLog(!showLog)}>{showLog ? 'Hide' : 'Show'} price change log</button>
        {showLog && <ChangeLog />}
      </section>
    </div>
  );
}
