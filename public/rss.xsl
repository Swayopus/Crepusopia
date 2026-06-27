<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="zh-Hans">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title><xsl:value-of select="/rss/channel/title"/> | RSS</title>
        <style>
          :root {
            --bg: #fafaf8;
            --text: #1e1e1e;
            --muted: #888;
            --primary: #4169e1;
            --border: #e5e5e5;
            --card-bg: #fff;
            --tag-bg: #f0f0ee;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #111827;
              --text: #e5e5e5;
              --muted: #9ca3af;
              --primary: #818cf8;
              --border: #1f2937;
              --card-bg: #1a1f2e;
              --tag-bg: #1f2937;
            }
          }
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:system-ui,-apple-system,sans-serif;max-width:48rem;margin:0 auto;padding:2rem 1.5rem;background:var(--bg);color:var(--text);line-height:1.6}
          header{margin-bottom:2rem}
          header h1{font-size:1.5rem;font-weight:600;margin-bottom:0.25rem}
          header h1 a{color:var(--text);text-decoration:none}
          header .desc{font-size:0.95rem;color:var(--muted);margin-top:0.25rem}
          header .meta{font-size:0.9rem;color:var(--muted);margin-top:0.25rem}
          header .count{font-size:0.9rem;color:var(--muted);margin-top:0.25rem}
          header .feed-link{display:inline-block;margin-top:0.25rem;font-size:0.85rem;color:var(--primary);text-decoration:none}

          .item{display:block;padding:1.25rem 1rem;margin:0 -1rem;border-radius:0.5rem;text-decoration:none;transition:background 0.2s}
          .item:hover{background:var(--tag-bg)}
          .item h2{font-size:1.25rem;font-weight:600;color:var(--text);margin-bottom:0.35rem;line-height:1.3}
          .item:hover h2{color:var(--primary)}
          .item .meta{font-size:0.95rem;color:var(--muted);margin-bottom:0.35rem}
          .item .desc{font-size:0.95rem;color:var(--muted);line-height:1.5}
          .item .tags{display:flex;flex-wrap:wrap;gap:0.375rem;margin-top:0.5rem}
          .item .tags span{padding:0.125rem 0.5rem;font-size:0.75rem;line-height:1.4;border-radius:0.375rem;background:var(--tag-bg);color:var(--muted)}

          footer{margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border);color:var(--muted);font-size:0.85rem}
          footer a{color:var(--primary);text-decoration:none}
        </style>
      </head>
      <body>
        <header>
          <h1><a href="{/rss/channel/link}"><xsl:value-of select="/rss/channel/title"/></a></h1>
          <p class="desc"><xsl:value-of select="/rss/channel/description"/></p>
          <p class="meta">Last build: <xsl:value-of select="/rss/channel/lastBuildDate"/></p>
          <p class="count"><xsl:value-of select="count(/rss/channel/item)"/> posts · Subscribe via <a href="{/rss/channel/atom:link/@href}" class="feed-link">/rss.xml</a></p>
        </header>

        <xsl:for-each select="/rss/channel/item">
          <a class="item" href="{link}">
            <h2><xsl:value-of select="title"/></h2>
            <div class="meta">
              <div>Published: <xsl:value-of select="pubDate"/></div>
              <xsl:if test="dcterms:modified">
                <div>Updated: <xsl:value-of select="dcterms:modified"/></div>
              </xsl:if>
            </div>
            <div class="desc"><xsl:value-of select="description"/></div>
            <xsl:if test="count(category) &gt; 1">
              <div class="tags">
                <xsl:for-each select="category[position() &gt; 1]">
                  <span><xsl:value-of select="."/></span>
                </xsl:for-each>
              </div>
            </xsl:if>
          </a>
        </xsl:for-each>

        <footer>
          <p>Powered by <a href="https://astro.build">Astro</a> · RSS 2.0</p>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
