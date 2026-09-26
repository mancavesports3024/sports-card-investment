import React from 'react';
import { HeaderAd, InContentAd } from './AdSense';
import FeaturedEbayRotator from './FeaturedEbayRotator';
import PageLayout from './PageLayout';
import { formatArticleDate, getAllArticles } from '../services/newsArticleService';

const EBAY_STORE_URL = 'https://www.ebay.com/str/mancavesportsllc';

const HomePage = () => {
  const latestArticles = getAllArticles().slice(0, 3);

  return (
    <div className="home-page">
      <main className="App-main">
        <PageLayout
          title="Affordable sports cards and practical tools for set builders"
          subtitle="Find recent sales, research card sets, read budget-friendly collecting guides, and shop raw baseball, football, and basketball cards from Man Cave Sports Cards LLC."
          icon="🃏"
        >
          <section className="welcome-section" style={{
            background: 'linear-gradient(135deg, #000 0%, #333 100%)',
            color: '#ffd700',
            padding: '1.25rem',
            borderRadius: 12,
            margin: '0 auto 2rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '2px solid #ffd700',
            maxWidth: 900,
            textAlign: 'center'
          }}>
            <p style={{ color: '#fff', fontSize: '1rem', lineHeight: 1.6, margin: '0 auto 1.25rem', maxWidth: 720 }}>
              Scorecard is the research side of Man Cave Sports Cards LLC. Use it to check recent card sales and explore collecting guides, then visit our eBay store to shop singles for your sets.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.75rem' }}>
              <a href="/search" className="cta-button">Search Recent Card Sales</a>
              <a href={EBAY_STORE_URL} className="ebay-store-btn" target="_blank" rel="noopener noreferrer">Shop Our eBay Store</a>
              <a href="/news" className="header-nav-link">Read Collecting Guides</a>
            </div>
            <p style={{ color: '#d1d5db', fontSize: '0.9rem', margin: '-1rem auto 1.5rem', maxWidth: 700 }}>
              Some eBay links are affiliate links. Man Cave Sports Cards LLC may earn a commission from qualifying purchases.
            </p>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.2rem', color: '#ffd700' }}>Featured items from our eBay store</h2>
            <FeaturedEbayRotator />
          </section>

          <HeaderAd />

          <section className="features-section" aria-labelledby="home-ways-to-collect">
            <h2 className="section-title" id="home-ways-to-collect">Collect, research, and learn</h2>
            <div className="features-grid">
              <article className="feature-card">
                <div className="feature-icon" aria-hidden="true">🧩</div>
                <h3>Complete Your Set</h3>
                <p>Browse our pick-your-card listings for affordable baseball, football, and basketball singles.</p>
                <a href={EBAY_STORE_URL} target="_blank" rel="noopener noreferrer">Shop singles on eBay</a>
              </article>
              <article className="feature-card">
                <div className="feature-icon" aria-hidden="true">📊</div>
                <h3>Check Recent Sales</h3>
                <p>Search by player, year, set, or card number to compare recently reported sales. Sale dates and item details may vary by result.</p>
                <a href="/search">Open Recent Sales Search</a>
              </article>
              <article className="feature-card">
                <div className="feature-icon" aria-hidden="true">📚</div>
                <h3>Latest Collecting Guides</h3>
                <p>Read practical articles about new releases, set building, and buying or selling low-end sports cards.</p>
                <a href="/news">Browse Blog &amp; Guides</a>
              </article>
            </div>
          </section>

          <section aria-labelledby="latest-guides-title" style={{ margin: '2rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 className="section-title" id="latest-guides-title">Latest Guides</h2>
              <a href="/news" className="header-nav-link">All releases &amp; guides</a>
            </div>
            {latestArticles.length === 0 ? (
              <p style={{ color: '#d1d5db' }}>New collecting guides will appear here.</p>
            ) : (
              <div className="features-grid">
                {latestArticles.map((article) => (
                  <article className="feature-card" key={article.slug}>
                    <p style={{ color: '#ffd700', fontSize: '0.9rem', margin: '0 0 0.5rem' }}>
                      {article.category} · {formatArticleDate(article.publishedAt)}
                    </p>
                    <h3>{article.title}</h3>
                    <p>{article.excerpt}</p>
                    <a href={`/news/${article.slug}`}>Read guide</a>
                  </article>
                ))}
              </div>
            )}
          </section>

          <InContentAd />

          <section className="cta-section" aria-labelledby="about-scorecard-title">
            <h2 id="about-scorecard-title">Scorecard by Man Cave Sports Cards LLC</h2>
            <p>We sell affordable raw sports cards for collectors and set builders, and publish practical guides to help you research the hobby.</p>
            <a href="/search" className="cta-button">Search Recent Card Sales</a>
          </section>
        </PageLayout>
      </main>

      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Man Cave Sports Cards LLC</h4>
            <p>Scorecard is our sports-card research and collecting-guides site.</p>
            <div className="social-links">
              <a href="https://x.com/Mancavesportsc1" className="social-link" target="_blank" rel="noopener noreferrer"><span>𝕏</span> Follow on X</a>
              <a href="https://www.instagram.com/mancavesportscardllc" className="social-link" target="_blank" rel="noopener noreferrer"><span>📷</span> Instagram</a>
              <a href="https://www.facebook.com/profile.php?id=100062665574017" className="social-link" target="_blank" rel="noopener noreferrer"><span>📘</span> Facebook</a>
            </div>
          </div>
          <div className="footer-section">
            <h4>Shop on eBay</h4>
            <div className="ebay-promo">
              <p>Browse affordable sports cards from Man Cave Sports Cards LLC.</p>
              <a href={EBAY_STORE_URL} className="ebay-store-btn" target="_blank" rel="noopener noreferrer">Visit Man Cave eBay Store</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
