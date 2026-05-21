import type { StockNews, FmpArticle } from './types';
import { CACHE_TTL } from './constants';

/**
 * Lightweight RSS fetcher untuk berita keuangan publik.
 * Dipakai sebagai pengganti FMP news endpoints (yang sekarang paid-only).
 *
 * Strategy: fetch beberapa feed RSS publik, parse minimal field (title, link,
 * pubDate, description, image dari enclosure/media:content), merge & sort
 * descending by date.
 */

export interface RssFeedSource {
  name: string;
  url: string;
}

export const STOCK_NEWS_FEEDS: RssFeedSource[] = [
  { name: 'Yahoo Finance', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US' },
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  // MarketWatch & Investing.com menyertakan media:content image di setiap item
  { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines' },
  { name: 'Investing.com', url: 'https://www.investing.com/rss/news_301.rss' },
];

export const VC_PE_SME_FEEDS: RssFeedSource[] = [
  { name: 'FT Markets', url: 'https://www.ft.com/markets?format=rss' },
  { name: 'CNBC Investing', url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html' },
];

interface ParsedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  image: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim();
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).trim();
}

function extractTag(item: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = item.match(re);
  if (!m) return null;
  return stripCdata(m[1]);
}

function extractImage(item: string): string | null {
  // <media:content url="..."> or <media:thumbnail url="...">
  const media = item.match(/<media:(?:content|thumbnail)[^>]*\burl=["']([^"']+)["']/i);
  if (media?.[1]) return media[1];

  // <enclosure url="..." type="image/..."> — beberapa feed taruh gambar di enclosure
  const encImg = item.match(/<enclosure[^>]*\btype=["']image\/[^"']*["'][^>]*\burl=["']([^"']+)["']/i);
  if (encImg?.[1]) return encImg[1];
  const encUrl = item.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\//i);
  if (encUrl?.[1]) return encUrl[1];

  // <image><url>...</url></image> — format RSS standar
  const imgUrl = item.match(/<image>[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i);
  if (imgUrl?.[1]) return stripCdata(imgUrl[1]).trim();

  // <thumbnail> tag (beberapa feed pakai ini)
  const thumb = item.match(/<thumbnail>([^<]+)<\/thumbnail>/i);
  if (thumb?.[1]) return stripCdata(thumb[1]).trim();

  // og:image atau twitter:image di CDATA description
  const ogImg = item.match(/(?:og:image|twitter:image)[^"']*content=["']([^"']+)["']/i);
  if (ogImg?.[1]) return ogImg[1];

  // First <img src="..."> dalam description/content (sering ada di CDATA)
  const inlineImg = item.match(/<img[^>]+\bsrc=["']([^"']+)["']/i);
  if (inlineImg?.[1]) return inlineImg[1];

  return null;
}

function parseFeed(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[0];
    const title = extractTag(block, 'title') ?? '';
    const link = extractTag(block, 'link') ?? '';
    const pubDate = extractTag(block, 'pubDate') ?? extractTag(block, 'dc:date') ?? '';
    const description = extractTag(block, 'description') ?? '';
    const image = extractImage(block);
    if (!title || !link) continue;
    items.push({
      title: stripHtml(title),
      link: link.trim(),
      pubDate: pubDate.trim(),
      description: stripHtml(description).slice(0, 400),
      image,
    });
  }
  return items;
}

async function fetchFeed(source: RssFeedSource, revalidateSeconds: number): Promise<ParsedItem[]> {
  const res = await fetch(source.url, {
    next: { revalidate: revalidateSeconds },
    headers: { 'User-Agent': 'Mozilla/5.0 (AXION Market Tracker)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`${source.name} ${res.status}`);
  }
  const xml = await res.text();
  return parseFeed(xml);
}

function toIsoDate(s: string): string {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Fetch news dari semua feed di list, gabung & sort. Bila satu feed gagal,
 * feed lainnya tetap dipakai (Promise.allSettled).
 */
async function fetchFromFeeds(
  feeds: RssFeedSource[],
  limit: number,
  revalidateSeconds: number
): Promise<Array<ParsedItem & { siteName: string }>> {
  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      const items = await fetchFeed(f, revalidateSeconds);
      return items.map((i) => ({ ...i, siteName: f.name }));
    })
  );

  const merged: Array<ParsedItem & { siteName: string }> = [];
  for (const r of results) {
    if (r.status === 'fulfilled') merged.push(...r.value);
    else console.warn('[rss] feed failed:', r.reason);
  }

  if (merged.length === 0) {
    throw new Error('All RSS feeds failed');
  }

  // Sort: item dengan image diprioritaskan, lalu by date descending
  merged.sort((a, b) => {
    if (a.image && !b.image) return -1;
    if (!a.image && b.image) return 1;
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });
  return merged.slice(0, limit);
}

export async function fetchStockNewsRss(limit = 12): Promise<StockNews[]> {
  const items = await fetchFromFeeds(STOCK_NEWS_FEEDS, limit, CACHE_TTL.RSS_STOCK_NEWS);
  return items.map((i) => ({
    symbol: null,
    publishedDate: toIsoDate(i.pubDate),
    title: i.title,
    image: i.image,
    site: i.siteName,
    text: i.description,
    url: i.link,
  }));
}

export async function fetchVcPeSmeArticlesRss(limit = 20): Promise<FmpArticle[]> {
  const items = await fetchFromFeeds(VC_PE_SME_FEEDS, limit, CACHE_TTL.RSS_GENERAL_ARTICLES);
  return items.map((i) => ({
    title: i.title,
    date: toIsoDate(i.pubDate),
    content: i.description,
    tickers: null,
    image: i.image,
    link: i.link,
    author: null,
    site: i.siteName,
  }));
}
