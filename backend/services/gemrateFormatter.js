// GemRate formatter: normalize scraped GemRate data into a consistent shape
// so it is easier to store in a database and consume across the app.
//
// IMPORTANT: These helpers are designed to be non-destructive – they add
// normalized fields without changing the raw ones used by the UI today.

/**
 * Parse a concatenated card name string into structured fields
 * Example: "Basketball1989Hoops21Michael JordanAll-Star"
 * Returns: { sport: "Basketball", year: 1989, set_name: "Hoops", card_number: "21", player_name: "Michael Jordan", parallel: "All-Star" }
 */
function parseConcatenatedCardName(nameStr) {
  if (!nameStr || typeof nameStr !== 'string') {
    return { sport: null, year: null, set_name: null, card_number: null, player_name: null, parallel: null };
  }

  const sports = ['Basketball', 'Baseball', 'Football', 'Hockey', 'Soccer', 'Racing', 'Golf', 'Tennis', 'Wrestling', 'Boxing'];
  
  // Find sport at the start
  let sport = null;
  let remaining = nameStr;
  for (const s of sports) {
    if (nameStr.startsWith(s)) {
      sport = s;
      remaining = nameStr.substring(s.length);
      break;
    }
  }

  // Find 4-digit year
  const yearMatch = remaining.match(/^(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  if (yearMatch) {
    remaining = remaining.substring(4);
  }

  // Find card number (digits, possibly with letters like "1A")
  // This is tricky - we need to find where the set name ends and card number begins
  // Common pattern: SetName123PlayerName or SetName123Parallel
  // Try to find a sequence of digits that's followed by a capital letter (player name start)
  const cardNumberMatch = remaining.match(/^([A-Za-z\s]+?)(\d+[A-Za-z]?)([A-Z][a-z])/);
  let set_name = null;
  let card_number = null;
  let player_start = remaining;

  if (cardNumberMatch) {
    set_name = cardNumberMatch[1].trim();
    card_number = cardNumberMatch[2];
    player_start = cardNumberMatch[3] + remaining.substring(cardNumberMatch[0].length);
  } else {
    // Fallback: try to find any digits followed by capital letter
    const fallbackMatch = remaining.match(/^([A-Za-z\s]+?)(\d+)([A-Z])/);
    if (fallbackMatch) {
      set_name = fallbackMatch[1].trim();
      card_number = fallbackMatch[2];
      player_start = fallbackMatch[3] + remaining.substring(fallbackMatch[0].length);
    } else {
      // No clear card number - everything before first capital might be set name
      const firstCapMatch = remaining.match(/^([A-Za-z\s]+?)([A-Z][a-z])/);
      if (firstCapMatch) {
        set_name = firstCapMatch[1].trim();
        player_start = remaining.substring(firstCapMatch[1].length);
      } else {
        set_name = remaining;
        player_start = '';
      }
    }
  }

  // Extract player name and parallel
  // Parallels are often at the end: "Base", "All-Star", "Rookie", "Refractor", etc.
  const parallelKeywords = ['Base', 'All-Star', 'Rookie', 'Refractor', 'Chrome', 'Gold', 'Silver', 'Platinum', 'Prizm', 'Select', 'Optic', 'Auto', 'Autograph', 'Patch', 'Relic', 'Serial', 'Numbered', 'RC', 'SP', 'SSP', 'Variation', 'Insert', 'Parallel'];
  
  let player_name = player_start;
  let parallel = null;

  // Try to find parallel at the end
  for (const keyword of parallelKeywords) {
    if (player_start.endsWith(keyword)) {
      parallel = keyword;
      player_name = player_start.substring(0, player_start.length - keyword.length).trim();
      break;
    }
  }

  // If no parallel found, check if there's a pattern like "PlayerNameParallel" (capital letter transition)
  if (!parallel && player_name.length > 0) {
    // Look for common parallel patterns: word starting with capital after lowercase
    const parallelMatch = player_name.match(/^(.+?)([A-Z][a-z]+)$/);
    if (parallelMatch && parallelKeywords.some(k => parallelMatch[2].includes(k))) {
      player_name = parallelMatch[1];
      parallel = parallelMatch[2];
    }
  }

  // Clean up set_name (remove extra spaces, normalize)
  if (set_name) {
    set_name = set_name.replace(/\s+/g, ' ').trim();
  }

  // Clean up player_name
  if (player_name) {
    player_name = player_name.trim();
    // Insert spaces before capital letters for readability (e.g., "MichaelJordan" -> "Michael Jordan")
    player_name = player_name.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  return {
    sport,
    year,
    set_name: set_name || null,
    card_number: card_number || null,
    player_name: player_name || null,
    parallel: parallel || null
  };
}

function normalizeCardIdentity(raw = {}) {
  // If we have a concatenated name string and no separate fields, try to parse it
  const nameStr = raw.name || raw.card_name || raw.card || null;
  const hasSeparateFields = raw.sport || raw.year || raw.set_name || raw.card_number || raw.player_name;
  
  let parsed = { sport: null, year: null, set_name: null, card_number: null, player_name: null, parallel: null };
  
  // Only parse if we don't have separate fields and we have a name string that looks concatenated
  // Check if it starts with a sport name (indicates concatenated format)
  if (!hasSeparateFields && nameStr && nameStr.length > 10) {
    const sports = ['Basketball', 'Baseball', 'Football', 'Hockey', 'Soccer', 'Racing', 'Golf', 'Tennis'];
    const hasSportPrefix = sports.some(s => nameStr.startsWith(s));
    if (hasSportPrefix) {
      parsed = parseConcatenatedCardName(nameStr);
    }
  }

  // Sport / category (prefer parsed, then raw fields)
  const sport =
    parsed.sport ||
    raw.sport ||
    raw.category ||
    null;

  // Year (prefer parsed, then raw fields)
  let year = parsed.year || raw.year || raw.Year;
  if (typeof year === 'string') {
    const m = year.match(/\d{4}/);
    year = m ? parseInt(m[0], 10) : null;
  } else if (typeof year === 'number') {
    year = Number.isFinite(year) ? year : null;
  } else {
    year = null;
  }

  // Set name (prefer parsed, then raw fields)
  const setName =
    parsed.set_name ||
    raw.set_name ||
    raw.set ||
    raw.cardSet ||
    raw['Set Name'] ||
    null;

  // Card number (prefer parsed, then raw fields)
  const cardNumber =
    parsed.card_number ||
    raw.card_number ||
    raw.cardNumber ||
    raw.number ||
    raw['Card #'] ||
    raw['Card Number'] ||
    null;

  // Player / subject (prefer parsed, then raw fields)
  const playerName =
    parsed.player_name ||
    raw.player ||
    raw.player_name ||
    raw.playerName ||
    raw.name || // last resort – many GemRate objects just use "name"
    null;

  // Parallel / variation (prefer parsed, then raw fields)
  const parallel =
    parsed.parallel ||
    raw.parallel ||
    raw.parallel_type ||
    raw.parallelName ||
    raw.variant ||
    raw['Parallel'] ||
    null;

  // Build a stable, lowercased key – safe to use as a dedupe key across sources
  const parts = [
    sport || '',
    year || '',
    setName || '',
    cardNumber || '',
    playerName || '',
    parallel || ''
  ]
    .map((p) => String(p || '').trim().toLowerCase())
    .filter((p) => p.length > 0);

  const card_key = parts.join('|') || null;

  return {
    sport,
    year,
    set_name: setName,
    card_number: cardNumber,
    player_name: playerName,
    parallel,
    card_key
  };
}

function formatTrendingPlayer(raw = {}) {
  const id = normalizeCardIdentity(raw);
  const submissionsLastWeek =
    raw.submissions ??
    raw.count ??
    raw.last_week ??
    raw.lastWeek ??
    null;

  return {
    ...id,
    type: 'player',
    // Preserve GemRate naming while adding normalized fields
    player: raw.player || raw.name || id.player_name || null,
    name: raw.name || raw.player || id.player_name || null,
    submissions_last_week: submissionsLastWeek,
    submissions_prior_week: raw.prior_week ?? raw.priorWeek ?? null,
    submissions_all_time: raw.all_time ?? raw.allTime ?? null,
    weekly_change_pct: raw.change ?? null,
    source: 'gemrate'
  };
}

function formatTrendingSet(raw = {}) {
  const id = normalizeCardIdentity(raw);
  const submissionsLastWeek =
    raw.submissions ??
    raw.count ??
    raw.last_week ??
    raw.lastWeek ??
    null;

  return {
    ...id,
    type: 'set',
    set_name: raw.set_name || raw.set || id.set_name || null,
    name: raw.name || raw.set_name || raw.set || id.set_name || null,
    submissions_last_week: submissionsLastWeek,
    submissions_prior_week: raw.prior_week ?? raw.priorWeek ?? null,
    submissions_all_time: raw.all_time ?? raw.allTime ?? null,
    weekly_change_pct: raw.change ?? null,
    source: 'gemrate'
  };
}

function formatTrendingCard(raw = {}) {
  const id = normalizeCardIdentity(raw);
  const submissionsLastWeek =
    raw.submissions ??
    raw.count ??
    raw.last_week ??
    raw.lastWeek ??
    raw.graded_last_week ??
    null;

  const submissionsPriorWeek =
    raw.prior_week ??
    raw.priorWeek ??
    raw.graded_prior_week ??
    null;

  const submissionsAllTime =
    raw.all_time ??
    raw.allTime ??
    raw.graded_all_time ??
    null;

  return {
    ...id,
    type: 'card',
    card_name: raw.card_name || raw.name || raw.card || null,
    name: raw.name || raw.card_name || raw.card || null,
    submissions_last_week: submissionsLastWeek,
    submissions_prior_week: submissionsPriorWeek,
    submissions_all_time: submissionsAllTime,
    weekly_change_pct: raw.change ?? raw.weekly_change ?? null,
    source: 'gemrate'
  };
}

module.exports = {
  normalizeCardIdentity,
  formatTrendingPlayer,
  formatTrendingSet,
  formatTrendingCard
};

