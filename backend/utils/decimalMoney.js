// Exact decimal money helpers. Amounts are held as BigInt in units of 10^-SCALE.
const SCALE = 6;
const FACTOR = 10n ** BigInt(SCALE);

function currencyDigits(currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

// Returns BigInt units, or null when the value is absent or not a plain decimal string/number.
function parseUnits(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  const m = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return null;
  const frac = (m[3] || '').padEnd(SCALE, '0');
  if (frac.length > SCALE) return null;
  const units = BigInt(m[2]) * FACTOR + BigInt(frac);
  return m[1] === '-' ? -units : units;
}

function formatUnits(units, currency) {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / FACTOR;
  let frac = (abs % FACTOR).toString().padStart(SCALE, '0');
  const minDigits = currencyDigits(currency);
  while (frac.length > minDigits && frac.endsWith('0')) frac = frac.slice(0, -1);
  return `${negative ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

// eBay Amount ({ value, currency }) -> { value, currency } with normalized string, or null if unavailable.
function amountOrNull(amount) {
  if (!amount || !amount.currency) return null;
  const units = parseUnits(amount.value);
  if (units === null) return null;
  return { value: formatUnits(units, amount.currency), currency: amount.currency };
}

// Accumulates signed sums per currency without floating point.
class CurrencyTotals {
  constructor() { this.map = new Map(); }

  add(currency, units) {
    this.map.set(currency, (this.map.get(currency) || 0n) + units);
  }

  get(currency) { return this.map.get(currency); }

  currencies() { return [...this.map.keys()].sort(); }

  toJSON() {
    const out = {};
    for (const c of this.currencies()) out[c] = formatUnits(this.map.get(c), c);
    return out;
  }
}

module.exports = { parseUnits, formatUnits, amountOrNull, CurrencyTotals, currencyDigits };
