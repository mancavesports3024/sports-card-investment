import React, { useCallback, useEffect, useState } from 'react';
import config from '../config';
import tokenService from '../services/tokenService';
import './EbayPurchasesShipments.css';

// Staff-only purchases & shipments board. Calls /api/staff/ebay only — no eBay/CRON secrets in the browser.
const API = `${config.API_BASE_URL}/api/staff/ebay`;

async function api(path) {
  const res = await tokenService.authenticatedFetch(`${API}${path}`);
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

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const money = (p) => (p && p.value !== undefined && p.value !== null ? `$${p.value}` : '—');

function statusClass(state) {
  if (state === 'Delivered') return 'eps-chip eps-chip-done';
  if (state === 'Out for delivery' || state === 'In transit') return 'eps-chip eps-chip-move';
  if (state === 'At USPS (accepted)') return 'eps-chip eps-chip-usps';
  if (state === 'Awaiting shipment') return 'eps-chip eps-chip-wait';
  return 'eps-chip';
}

function BoardTable({ rows, partyLabel, dateLabel }) {
  if (!rows.length) return <p className="eps-muted">No rows in this window.</p>;
  return (
    <table className="eps-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>{partyLabel}</th>
          <th>{dateLabel}</th>
          <th>Status</th>
          <th>Tracking</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.orderId}|${row.itemId}|${row.trackingNumber || ''}|${row.shipDate || row.orderDate || ''}`}>
            <td data-label="Item">
              <div>{row.item || '—'}</div>
              {row.price ? <div className="eps-muted">{money(row.price)}</div> : null}
            </td>
            <td data-label={partyLabel}>{row.seller || row.buyer || '—'}</td>
            <td data-label={dateLabel}>{when(row.shipDate || row.orderDate)}</td>
            <td data-label="Status">
              <span className={statusClass(row.deliveryState)}>{row.deliveryState || 'Unknown'}</span>
            </td>
            <td data-label="Tracking">
              {row.trackingNumber && row.trackingUrl ? (
                <a href={row.trackingUrl} target="_blank" rel="noopener noreferrer">
                  {(row.carrier ? `${row.carrier} ` : '') + row.trackingNumber}
                </a>
              ) : (
                <span className="eps-muted">{row.shipped ? 'No tracking' : '—'}</span>
              )}
              {row.lastRefreshedAt ? <div className="eps-muted">Checked {when(row.lastRefreshedAt)}</div> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function EbayPurchasesShipments() {
  const [access, setAccess] = useState('checking');
  const [tab, setTab] = useState('bought');
  const [purchases, setPurchases] = useState(null);
  const [shipments, setShipments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenService.getAccessToken()) {
        if (!cancelled) setAccess('signed-out');
        return;
      }
      try {
        await api('/me');
        if (!cancelled) setAccess('ok');
      } catch (err) {
        if (!cancelled) setAccess(err.status === 403 ? 'forbidden' : err.status === 401 ? 'signed-out' : 'error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setNotice(null);
    const q = `days=30${refresh ? '&refresh=1' : ''}`;
    try {
      if (tab === 'bought') {
        setPurchases(await api(`/ebay-purchases?${q}`));
      } else {
        setShipments(await api(`/ebay-shipments?${q}`));
      }
    } catch (err) {
      setNotice({ error: true, text: err.message });
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (access !== 'ok') return undefined;
    load(false);
    return undefined;
  }, [access, load]);

  if (access === 'checking') return <div className="eps"><p>Checking access…</p></div>;
  if (access === 'signed-out') {
    return (
      <div className="eps">
        <h1>Purchases &amp; Shipments</h1>
        <p>Staff sign-in required.</p>
        <button type="button" onClick={() => { window.location.href = `${config.API_BASE_URL}/api/auth/google`; }}>Sign in with Google</button>
      </div>
    );
  }
  if (access === 'forbidden') return <div className="eps"><h1>Purchases &amp; Shipments</h1><p>This account is not on the staff list.</p></div>;
  if (access === 'error') return <div className="eps"><h1>Purchases &amp; Shipments</h1><p className="eps-error">Could not reach the board service. Try again shortly.</p></div>;

  const data = tab === 'bought' ? purchases : shipments;
  const rows = tab === 'bought' ? (purchases && purchases.purchases) || [] : (shipments && shipments.shipments) || [];
  const generatedAt = data && data.generatedAt;
  const signupNote = data && data.carrierSignupNeeded ? data.carrierSignupNote : null;

  return (
    <div className="eps">
      <h1>Purchases &amp; Shipments</h1>
      <div className="eps-status">
        <span>
          Last refreshed: <strong>{generatedAt ? when(generatedAt) : '—'}</strong>
          {data ? ` · ${tab === 'bought' ? data.purchaseCount : data.shipmentCount} rows` : ''}
        </span>
        <button type="button" onClick={() => load(true)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <div className="eps-tabs" role="tablist" aria-label="Board view">
        <button type="button" role="tab" aria-selected={tab === 'bought'} className={tab === 'bought' ? 'is-active' : ''} onClick={() => setTab('bought')}>Bought</button>
        <button type="button" role="tab" aria-selected={tab === 'sold'} className={tab === 'sold' ? 'is-active' : ''} onClick={() => setTab('sold')}>Sold</button>
      </div>

      {signupNote ? <p className="eps-note">{signupNote}</p> : null}
      {notice ? <div className={notice.error ? 'eps-error' : 'eps-ok'}>{notice.text}</div> : null}
      {loading && !data ? <p>Loading…</p> : (
        <BoardTable
          rows={rows}
          partyLabel={tab === 'bought' ? 'Seller' : 'Buyer'}
          dateLabel={tab === 'bought' ? 'Order date' : 'Ship date'}
        />
      )}
    </div>
  );
}
