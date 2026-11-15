import React from 'react';
import { Link } from 'react-router-dom';
import FeaturedEbayRotator from './FeaturedEbayRotator';
import { formatArticleDate, getAllArticles } from '../services/newsArticleService';
const store = 'https://www.ebay.com/str/mancavesportsllc';
const tools = [
  { number: '01', label: 'Recent Auction Sales', text: 'Compare reported sales by player, year, set, or card number.', to: '/search', action: 'Research a card', tag: 'CARD RESEARCH' },
  { number: '02', label: 'Card Set Analysis', text: 'Explore card sets and make more informed collecting decisions.', to: '/card-set-analysis', action: 'Explore sets', tag: 'SET BUILDING' },
  { number: '03', label: 'Release Calendar', text: 'Find upcoming sports card releases and browse past release dates.', to: '/release-calendar', action: 'Open the calendar', tag: 'RELEASE DATES' },
  { number: '04', label: 'Collecting Guides', text: 'Read practical advice for building, buying, and organizing your collection.', to: '/news', action: 'Browse guides', tag: 'THE COLLECTOR’S DESK' },
];
export default function HomePage() {
  const articles = getAllArticles().slice(0, 3);
  return <div className="sc-home">
    <main>
      <section className="sc-hero">
        <div className="sc-hero-copy"><p className="sc-eyebrow">FOR COLLECTORS. FOR SET BUILDERS.</p><h1>Less searching.<br />More collecting.</h1><p className="sc-intro">Find your next card, check recent sales, and build a set you love. Your collecting tools, all in one place.</p><div className="sc-hero-actions"><Link className="sc-primary" to="/search">Check recent sales <span aria-hidden="true">↗</span></Link><a className="sc-secondary" href={store} target="_blank" rel="noopener noreferrer">Shop our cards ↗</a></div><div className="sc-sport-labels"><span>BASEBALL</span><span>FOOTBALL</span><span>BASKETBALL</span></div></div>
        <aside className="sc-hero-guide" aria-label="Quick start"><p className="sc-eyebrow">START HERE</p><h2>What brings you in?</h2><Link to="/search"><span><strong>“What’s my card selling for?”</strong><small>Compare recent auction sales</small></span><span aria-hidden="true">↗</span></Link><a href={store} target="_blank" rel="noopener noreferrer"><span><strong>“I need cards for my set.”</strong><small>Shop pick-your-card listings on eBay</small></span><span aria-hidden="true">↗</span></a><Link to="/release-calendar"><span><strong>“What’s coming out next?”</strong><small>Open the release calendar</small></span><span aria-hidden="true">↗</span></Link></aside>
      </section>
      <section className="sc-tools" aria-labelledby="sc-tools-title"><div className="sc-section-heading"><div><p className="sc-eyebrow">YOUR TOOLKIT</p><h2 id="sc-tools-title">Find exactly what you need.</h2></div><p>A clear path to every collecting tool.</p></div><div className="sc-tool-grid">{tools.map(tool => <Link className="sc-tool-card" to={tool.to} key={tool.to}><div className="sc-tool-top"><span>{tool.tag}</span><span>{tool.number}</span></div><h3>{tool.label}</h3><p>{tool.text}</p><span className="sc-tool-action">{tool.action} <span aria-hidden="true">↗</span></span></Link>)}</div></section>
      <section className="sc-editorial" aria-labelledby="sc-guides-title"><div className="sc-section-heading"><div><p className="sc-eyebrow">THE COLLECTOR’S DESK</p><h2 id="sc-guides-title">Fresh from the hobby.</h2></div><Link to="/news">All guides ↗</Link></div><div className="sc-article-grid">{articles.map(article => <article key={article.slug}><p className="sc-article-meta">{article.category} · {formatArticleDate(article.publishedAt)}</p><h3><Link to={`/news/${article.slug}`}>{article.title}</Link></h3><p>{article.excerpt}</p><Link className="sc-read" to={`/news/${article.slug}`}>Read guide ↗</Link></article>)}</div></section>
      <section className="sc-store-section" aria-labelledby="sc-store-title"><div><p className="sc-eyebrow">BUILD YOUR NEXT SET</p><h2 id="sc-store-title">Let’s go find<br />some cards.</h2><p>Affordable raw singles for baseball, football, and basketball collectors. Browse our latest listings and pick the cards you need.</p><a className="sc-primary" href={store} target="_blank" rel="noopener noreferrer">Visit our eBay store ↗</a><p className="sc-disclosure">Some eBay links are affiliate links. Man Cave Sports Cards LLC may earn a commission from qualifying purchases.</p></div><div className="sc-featured"><p className="sc-eyebrow">FEATURED IN OUR STORE</p><FeaturedEbayRotator /></div></section>
    </main>

  </div>;
}
