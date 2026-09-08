import React from 'react';

// Renders the structured `body` blocks of an article.
//
// Everything is built from React elements rather than raw HTML, so authored
// content can never inject markup. Links are plain anchors, which keeps them
// keyboard accessible for free.

const LINK_STYLE = {
  color: '#93c5fd',
  textDecoration: 'underline',
};

const isExternal = (href) => /^https?:\/\//i.test(href);

function InlineSpans({ spans }) {
  return (
    <>
      {spans.map((span, index) => {
        const text = span.bold ? <strong>{span.text}</strong> : span.text;

        if (!span.href) {
          return <React.Fragment key={index}>{text}</React.Fragment>;
        }

        const externalProps = isExternal(span.href)
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {};

        return (
          <a key={index} href={span.href} style={LINK_STYLE} {...externalProps}>
            {text}
          </a>
        );
      })}
    </>
  );
}

function ListItems({ items }) {
  return items.map((spans, index) => (
    <li key={index} style={{ marginBottom: '0.5rem' }}>
      <InlineSpans spans={spans} />
    </li>
  ));
}

function BodyBlock({ block }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p
          style={
            block.lead
              ? { marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 500 }
              : { marginBottom: '1.5rem' }
          }
        >
          <InlineSpans spans={block.content} />
        </p>
      );

    case 'heading': {
      const Tag = block.level === 3 ? 'h3' : 'h2';
      return (
        <Tag
          style={{
            color: '#ffd700',
            fontSize: block.level === 3 ? '1.1rem' : '1.3rem',
            margin: '1.5rem 0 1rem 0',
          }}
        >
          {block.text}
        </Tag>
      );
    }

    case 'unorderedList':
      return (
        <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
          <ListItems items={block.items} />
        </ul>
      );

    case 'orderedList':
      return (
        <ol style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
          <ListItems items={block.items} />
        </ol>
      );

    case 'callout':
      return (
        <div
          style={{
            background: 'linear-gradient(135deg, #374151, #4b5563)',
            padding: '1rem',
            borderRadius: 8,
            margin: '2rem 0',
            border: '1px solid #6b7280',
          }}
        >
          {block.title && (
            <div style={{ color: '#ffd700', fontWeight: 600, marginBottom: '0.5rem' }}>
              {block.title}
            </div>
          )}
          {block.content && (
            <p style={{ margin: 0, color: '#d1d5db' }}>
              <InlineSpans spans={block.content} />
            </p>
          )}
          {block.items && (
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#d1d5db' }}>
              {block.items.map((spans, index) => (
                <li key={index}>
                  <InlineSpans spans={spans} />
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    default:
      return null;
  }
}

const NewsArticleBody = ({ body }) => (
  <div style={{ color: '#d1d5db', lineHeight: '1.7', fontSize: '1rem' }}>
    {body.map((block, index) => (
      <BodyBlock key={index} block={block} />
    ))}
  </div>
);

export default NewsArticleBody;
