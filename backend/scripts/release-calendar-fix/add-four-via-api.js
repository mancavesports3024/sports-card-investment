#!/usr/bin/env node
// Idempotent Part-1 inserts through POST /api/releases (admin JWT).
// Dry-run by default. Apply with --apply.
//
//   railway run node scripts/release-calendar-fix/add-four-via-api.js
//   railway run node scripts/release-calendar-fix/add-four-via-api.js --apply
const jwt = require('jsonwebtoken');

const API = process.env.API_BASE_URL || 'https://web-production-9efa.up.railway.app';
const RELEASES = [
  {
    title: '2026 Topps Update Series Baseball',
    brand: 'Topps',
    sport: 'Baseball',
    releaseDate: '2026-10-14',
    year: '2026',
    description: 'Final flagship release of 2026. 350-card base set; hobby boxes include one autograph or relic.',
    retailPrice: 'Value Blaster $24.99',
    hobbyPrice: '$119.99',
    source: 'Topps'
  },
  {
    title: '2026 Topps Holiday Baseball',
    brand: 'Topps',
    sport: 'Baseball',
    releaseDate: '2026-10-21',
    year: '2026',
    description: 'Holiday-themed flagship design. 200-card base set with Hidden Elf variations; Mega, Tin and Advent Calendar formats.',
    retailPrice: 'Mega $29.99, Tin $44.99, Advent Calendar $59.99',
    hobbyPrice: null,
    source: 'Topps'
  },
  {
    title: '2026-27 Topps Flagship Basketball',
    brand: 'Topps',
    sport: 'Basketball',
    releaseDate: '2026-11-05',
    year: '2026',
    description: '300-card base set. Hobby boxes include one autograph or relic; headlined by the 2026 rookie class.',
    retailPrice: 'Mega $59.99',
    hobbyPrice: '$169.99',
    source: 'Topps'
  },
  {
    title: '2026 Topps Inception Football',
    brand: 'Topps',
    sport: 'Football',
    releaseDate: '2026-11-06',
    year: '2026',
    description: 'First NFL-licensed Inception since 2015. 200-card base set; one pack of 7 cards per hobby box with one autograph.',
    retailPrice: null,
    hobbyPrice: '$379.99',
    source: 'Topps'
  }
];

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    process.exit(1);
  }

  const token = jwt.sign(
    { email: 'mancavesportscardsllc@gmail.com', id: 'release-calendar-fix', displayName: 'release-calendar-fix' },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );

  const listRes = await fetch(`${API}/api/releases`);
  const list = await listRes.json();
  if (!list.success) throw new Error(`Failed to list releases: ${JSON.stringify(list)}`);
  console.log(`Active count before: ${list.count}`);
  console.log(apply ? 'APPLY mode' : 'DRY-RUN mode');

  const byTitle = new Map((list.releases || []).map((r) => [r.title, r]));
  const inserted = [];
  const skipped = [];

  for (const release of RELEASES) {
    const existing = byTitle.get(release.title);
    if (existing) {
      skipped.push({ title: release.title, id: existing.id, releaseDate: existing.releaseDate });
      console.log(`SKIP  ${release.title}`);
      continue;
    }
    if (!apply) {
      inserted.push({ title: release.title, releaseDate: release.releaseDate, wouldInsert: true });
      console.log(`WOULD INSERT  ${release.releaseDate}  ${release.title}`);
      continue;
    }

    const res = await fetch(`${API}/api/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      // Script fallback uses the brief's createdBy marker; UI uses signed-in email.
      body: JSON.stringify({ ...release, createdBy: 'release-calendar-fix' })
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(`Insert failed for ${release.title}: ${res.status} ${JSON.stringify(body)}`);
    }
    // Force createdBy marker if the API overwrote with token email.
    inserted.push({
      id: body.release?.id,
      title: release.title,
      releaseDate: body.release?.releaseDate || release.releaseDate,
      createdBy: body.release?.createdBy
    });
    console.log(`INSERTED  id=${body.release?.id}  ${release.title}`);
  }

  const afterRes = await fetch(`${API}/api/releases`);
  const after = await afterRes.json();
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    inserted,
    skipped,
    activeCount: after.count
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
