import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <Helmet>
        <title>Privacy Policy | Scorecard</title>
        <meta name="description" content="Privacy policy for Scorecard by Man Cave Sports Cards LLC. Learn about data collection, usage, and your rights." />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <article
        style={{
          background: '#1f2937',
          borderRadius: 12,
          padding: '2rem',
          border: '2px solid #374151',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <h1 style={{ color: '#ffd700', fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
          Privacy Policy
        </h1>
        
        <p style={{ color: '#d1d5db', marginBottom: '1rem' }}>
          <strong>Last Updated:</strong> September 26, 2026
        </p>

        <p style={{ color: '#d1d5db', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Scorecard is operated by Man Cave Sports Cards LLC. This privacy policy explains how we collect, use, and protect your information when you use our website at mancavesportscardsllc.com.
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            Information We Collect
          </h2>
          <p style={{ color: '#d1d5db', marginBottom: '1rem', lineHeight: 1.6 }}>
            When you sign in with Google to save searches, we collect:
          </p>
          <ul style={{ color: '#d1d5db', paddingLeft: '1.5rem', lineHeight: 1.8, marginBottom: '1rem' }}>
            <li>Your Google account ID</li>
            <li>Your display name</li>
            <li>Your email address</li>
            <li>Your authentication provider (Google)</li>
          </ul>
          <p style={{ color: '#d1d5db', marginBottom: '1rem', lineHeight: 1.6 }}>
            When you use the search features while signed in, we store on our servers:
          </p>
          <ul style={{ color: '#d1d5db', paddingLeft: '1.5rem', lineHeight: 1.8 }}>
            <li>Your search queries</li>
            <li>Search results and price analysis data</li>
            <li>Card population and grading data (when available)</li>
            <li>Timestamps of your searches</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            How We Use Your Information
          </h2>
          <ul style={{ color: '#d1d5db', paddingLeft: '1.5rem', lineHeight: 1.8 }}>
            <li>To authenticate your account and provide access to saved searches</li>
            <li>To store your search history so you can reference it later</li>
            <li>To improve our search features and user experience</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            Data Storage and Security
          </h2>
          <p style={{ color: '#d1d5db', marginBottom: '1rem', lineHeight: 1.6 }}>
            <strong>Authentication tokens:</strong> When you sign in, we issue encrypted JWT tokens that are stored in your browser's localStorage. Access tokens expire after 7 days and refresh tokens expire after 30 days.
          </p>
          <p style={{ color: '#d1d5db', marginBottom: '1rem', lineHeight: 1.6 }}>
            <strong>Search history:</strong> Your saved searches are stored on our servers (not in your browser). We retain up to your 50 most recent searches. All saved searches are automatically deleted after 30 days.
          </p>
          <p style={{ color: '#d1d5db', lineHeight: 1.6 }}>
            We use industry-standard security practices to protect your data, but cannot guarantee absolute security of data transmitted over the internet.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            Third-Party Services
          </h2>
          <p style={{ color: '#d1d5db', marginBottom: '1rem', lineHeight: 1.6 }}>
            We use the following third-party services:
          </p>
          <ul style={{ color: '#d1d5db', paddingLeft: '1.5rem', lineHeight: 1.8 }}>
            <li><strong>Google OAuth:</strong> For user authentication. Your use of Google authentication is governed by Google's privacy policy.</li>
            <li><strong>eBay:</strong> To retrieve card sales data and active listings. Some links to eBay are affiliate links, and Man Cave Sports Cards LLC may earn a commission from qualifying purchases.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            Cookies and Tracking
          </h2>
          <p style={{ color: '#d1d5db', lineHeight: 1.6 }}>
            We use localStorage in your browser to store authentication tokens so you can remain signed in. We do not use tracking cookies for advertising purposes.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            Your Rights
          </h2>
          <p style={{ color: '#d1d5db', marginBottom: '1rem', lineHeight: 1.6 }}>
            <strong>Delete saved searches:</strong> You can delete individual searches or clear all search history using the "Clear All" button in the Saved Searches section on the search page. This immediately removes your search history from our servers.
          </p>
          <p style={{ color: '#d1d5db', marginBottom: '1rem', lineHeight: 1.6 }}>
            <strong>Sign out:</strong> Logging out removes authentication tokens from your browser's localStorage, but does not delete your server-side search history. Your saved searches will remain accessible when you sign in again (unless they have been manually deleted or automatically expired after 30 days).
          </p>
          <p style={{ color: '#d1d5db', lineHeight: 1.6 }}>
            You control your Google account data through your Google account settings.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            Data Retention
          </h2>
          <p style={{ color: '#d1d5db', marginBottom: '1rem', lineHeight: 1.6 }}>
            <strong>Search history:</strong> We automatically retain up to your 50 most recent searches. All saved searches are automatically deleted 30 days after they are created. You can manually delete searches at any time.
          </p>
          <p style={{ color: '#d1d5db', lineHeight: 1.6 }}>
            <strong>Authentication tokens:</strong> Access tokens expire after 7 days and refresh tokens expire after 30 days. Expired tokens are no longer valid for authentication.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            Children's Privacy
          </h2>
          <p style={{ color: '#d1d5db', lineHeight: 1.6 }}>
            Our service is not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            Changes to This Policy
          </h2>
          <p style={{ color: '#d1d5db', lineHeight: 1.6 }}>
            We may update this privacy policy from time to time. The "Last Updated" date at the top of this page indicates when the policy was last revised.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffd700', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            Contact Information
          </h2>
          <p style={{ color: '#d1d5db', lineHeight: 1.6 }}>
            If you have questions about this privacy policy, please contact Man Cave Sports Cards LLC through our eBay store at{' '}
            <a
              href="https://www.ebay.com/str/mancavesportsllc"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#93c5fd' }}
            >
              ebay.com/str/mancavesportsllc
            </a>
            .
          </p>
        </section>
      </article>

      <nav style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link
          to="/"
          style={{
            color: '#ffd700',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Back to Home
        </Link>
      </nav>
    </div>
  );
};

export default PrivacyPolicy;
