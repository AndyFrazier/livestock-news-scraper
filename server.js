// server.js - Simplified News Scraper Backend
// Install dependencies: npm install express axios cheerio cors

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

function isWithinSevenDays(dateString) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const articleDate = new Date(dateString);
  return articleDate >= sevenDaysAgo;
}

function parseDate(dateText) {
  if (!dateText) return new Date().toISOString().split('T')[0];
  
  const daysAgoMatch = dateText.match(/(\d+)\s+days?\s+ago/i);
  if (daysAgoMatch) {
    const date = new Date();
    date.setDate(date.getDate() - parseInt(daysAgoMatch[1]));
    return date.toISOString().split('T')[0];
  }
  
  if (dateText.toLowerCase().includes('today') || dateText.match(/\d+\s+hours?\s+ago/i)) {
    return new Date().toISOString().split('T')[0];
  }
  
  if (dateText.toLowerCase().includes('yesterday')) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }
  
  const date = new Date(dateText);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

// Scrape Toplines and Tales Press Releases from WordPress RSS
async function scrapeOwnPressReleases(keywords) {
  const articles = [];
  
  try {
    console.log('Fetching Toplines and Tales press releases from WordPress');
    
    // Your WordPress RSS feed - change this to your actual WordPress site
    const rssFeedUrl = 'https://andyfrazier.wordpress.com/2025/10/01/new-weekly-newsletter-launches-for-pedigree-livestock-enthusiasts/';
    
    const response = await axios.get(rssFeedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data, { xmlMode: true });
    
    $('item').each((i, elem) => {
      const $item = $(elem);
      const title = $item.find('title').text().trim();
      const url = $item.find('link').text().trim();
      const description = $item.find('description').text().trim().replace(/<[^>]*>/g, '');
      const pubDate = $item.find('pubDate').text().trim();
      
      if (title && url) {
        articles.push({
          id: `ttpr-${i}`,
          title,
          url,
          source: 'Toplines and Tales',
          date: parseDate(pubDate) || new Date().toISOString().split('T')[0],
          summary: description.substring(0, 400) || 'Read the full press release for details.',
          keywords: keywords // Always show up regardless of keywords
        });
      }
    });
    
    console.log(`Found ${articles.length} Toplines and Tales press releases`);
    
  } catch (error) {
    console.error('Error fetching Toplines and Tales press releases:', error.message);
  }
  
  return articles;
}

// Scrape using Google News RSS (most reliable)
async function scrapeGoogleNews(keywords) {
  const articles = [];
  
  for (const keyword of keywords) {
    try {
      console.log(`Trying Google News RSS for keyword: ${keyword}`);
      // Add "when:7d" to limit to last 7 days in Google News
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword + ' farming livestock UK')}+when:7d&hl=en-GB&gl=GB&ceid=GB:en`;
      
      const rssResponse = await axios.get(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      
      const $ = cheerio.load(rssResponse.data, { xmlMode: true });
      
      $('item').each((i, elem) => {
        const $item = $(elem);
        const title = $item.find('title').text().trim();
        const url = $item.find('link').text().trim();
        const description = $item.find('description').text().trim().replace(/<[^>]*>/g, '');
        const pubDate = $item.find('pubDate').text().trim();
        const source = $item.find('source').text().trim() || 'Google News';
        
        if (title && url && !articles.find(a => a.url === url)) {
          articles.push({
            title,
            url,
            summary: description || 'Read the full article for more details.',
            source: source,
            date: parseDate(pubDate),
            keywords: [keyword]
          });
        }
      });
      
      console.log(`Google News found ${articles.length} total articles so far`);
      
    } catch (error) {
      console.error(`Google News error for ${keyword}:`, error.message);
    }
  }
  
  return articles.map((a, i) => ({
    id: `gn-${i}`,
    ...a,
    date: a.date || new Date().toISOString().split('T')[0]
  }));
}

// Scrape Farmers Weekly - try actual article pages
async function scrapeFWI(keywords) {
  const articles = [];
  
  try {
    // Try the "latest articles" page which showed up in debug
    console.log('Trying FWI latest articles page');
    const response = await axios.get('https://www.fwi.co.uk/latest/articles-published-last-7-days', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Find all links
    $('a').each((i, elem) => {
      if (articles.length >= 30) return false;
      
      const href = $(elem).attr('href');
      if (!href || !href.includes('/livestock')) return;
      
      const url = href.startsWith('http') ? href : `https://www.fwi.co.uk${href}`;
      const title = $(elem).text().trim();
      
      // Also try to find title in parent elements
      let betterTitle = $(elem).closest('article, div[class*="article"]').find('h2, h3, h4').first().text().trim();
      if (!betterTitle) betterTitle = title;
      
      if (betterTitle.length > 20 && !articles.find(a => a.url === url)) {
        articles.push({
          title: betterTitle,
          url,
          source: 'Farmers Weekly',
          needsSummary: true
        });
      }
    });
    
    console.log(`FWI found ${articles.length} potential articles`);
    
  } catch (error) {
    console.error('FWI error:', error.message);
  }
  
  const filtered = articles.filter(article => {
    const titleLower = article.title.toLowerCase();
    return keywords.some(kw => titleLower.includes(kw.toLowerCase()));
  });
  
  console.log(`FWI filtered to ${filtered.length} articles matching keywords`);
  
  return filtered.map((a, i) => ({
    id: `fwi-${i}`,
    title: a.title,
    url: a.url,
    source: a.source,
    date: new Date().toISOString().split('T')[0],
    summary: 'Click the link to read the full article from Farmers Weekly.',
    keywords: keywords.filter(kw => a.title.toLowerCase().includes(kw.toLowerCase()))
  }));
}

// Scrape Scottish Farmer using RSS
async function scrapeScottishFarmer(keywords) {
  const articles = [];
  
  try {
    console.log('Trying Scottish Farmer RSS feed');
    const rssResponse = await axios.get('https://www.thescottishfarmer.co.uk/news/rss/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const $ = cheerio.load(rssResponse.data, { xmlMode: true });
    
    $('item').each((i, elem) => {
      const $item = $(elem);
      const title = $item.find('title').text().trim();
      const url = $item.find('link').text().trim();
      const description = $item.find('description').text().trim().replace(/<[^>]*>/g, '');
      const pubDate = $item.find('pubDate').text().trim();
      
      if (title && url) {
        articles.push({
          title,
          url,
          summary: description || 'Read the full article for more details.',
          source: 'The Scottish Farmer',
          date: parseDate(pubDate)
        });
      }
    });
    
    console.log(`Scottish Farmer RSS found ${articles.length} articles`);
    
  } catch (error) {
    console.error('Scottish Farmer RSS error:', error.message);
  }
  
  const filtered = articles.filter(article => {
    const text = (article.title + ' ' + article.summary).toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  });
  
  console.log(`Scottish Farmer filtered to ${filtered.length} articles`);
  
  return filtered.map((a, i) => ({
    id: `sf-${i}`,
    title: a.title,
    url: a.url,
    source: a.source,
    date: a.date || new Date().toISOString().split('T')[0],
    summary: a.summary,
    keywords: keywords.filter(kw => (a.title + ' ' + a.summary).toLowerCase().includes(kw.toLowerCase()))
  }));
}

// Scrape Farmers Guardian using RSS
async function scrapeFarmersGuardian(keywords) {
  const articles = [];
  
  try {
    console.log('Trying Farmers Guardian RSS feed');
    const rssResponse = await axios.get('https://www.fginsight.com/news/feed', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const $ = cheerio.load(rssResponse.data, { xmlMode: true });
    
    $('item').each((i, elem) => {
      const $item = $(elem);
      const title = $item.find('title').text().trim();
      const url = $item.find('link').text().trim();
      const description = $item.find('description').text().trim().replace(/<[^>]*>/g, '');
      const pubDate = $item.find('pubDate').text().trim();
      
      if (title && url) {
        articles.push({
          title,
          url,
          summary: description || 'Read the full article for more details.',
          source: 'Farmers Guardian',
          date: parseDate(pubDate)
        });
      }
    });
    
    console.log(`Farmers Guardian RSS found ${articles.length} articles`);
    
  } catch (error) {
    console.error('Farmers Guardian RSS error:', error.message);
  }
  
  const filtered = articles.filter(article => {
    const text = (article.title + ' ' + article.summary).toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  });
  
  console.log(`Farmers Guardian filtered to ${filtered.length} articles`);
  
  return filtered.map((a, i) => ({
    id: `fg-${i}`,
    title: a.title,
    url: a.url,
    source: a.source,
    date: a.date || new Date().toISOString().split('T')[0],
    summary: a.summary,
    keywords: keywords.filter(kw => (a.title + ' ' + a.summary).toLowerCase().includes(kw.toLowerCase()))
  }));
}

app.post('/api/search', async (req, res) => {
  try {
    const { keywords } = req.body;
    
    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords array is required' });
    }
    
    console.log('Searching for keywords:', keywords);
    
    const [googleArticles, ownPressReleases, fwiArticles, sfArticles, fgArticles] = await Promise.all([
      scrapeGoogleNews(keywords),
      scrapeOwnPressReleases(keywords),
      scrapeFWI(keywords),
      scrapeScottishFarmer(keywords),
      scrapeFarmersGuardian(keywords)
    ]);
    
    const allArticles = [...googleArticles, ...ownPressReleases, ...fwiArticles, ...sfArticles, ...fgArticles];
    
    // Remove duplicates by URL
    const uniqueArticles = allArticles.filter((article, index, self) =>
      index === self.findIndex((a) => a.url === article.url)
    );
    
    // Filter to only articles from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentArticles = uniqueArticles.filter(article => {
      const articleDate = new Date(article.date);
      return articleDate >= sevenDaysAgo;
    });
    
    recentArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`Found ${uniqueArticles.length} unique articles, ${recentArticles.length} from last 7 days`);
    
    res.json({
      success: true,
      count: recentArticles.length,
      articles: recentArticles
    });
    
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch articles',
      message: error.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug endpoint to see raw scraped data
app.get('/api/debug/fwi', async (req, res) => {
  try {
    const response = await axios.get('https://www.fwi.co.uk/livestock', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    
    const $ = cheerio.load(response.data);
    const foundLinks = [];
    
    $('a').each((i, elem) => {
      if (i >= 50) return false;
      const href = $(elem).attr('href');
      const text = $(elem).text().trim();
      if (href && text.length > 10) {
        foundLinks.push({ href, text: text.substring(0, 100) });
      }
    });
    
    res.json({
      totalLinks: foundLinks.length,
      links: foundLinks,
      containsBluetongue: foundLinks.filter(l => 
        l.text.toLowerCase().includes('bluetongue') || 
        l.href.includes('bluetongue')
      )
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/zapier-proxy', async (req, res) => {
  try {
    const { webhookUrl, data } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'Webhook URL is required' });
    }
    
    const response = await axios.post(webhookUrl, data, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.json({ 
      success: true, 
      status: response.status,
      data: response.data 
    });
    
  } catch (error) {
    console.error('Zapier proxy error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data 
    });
  }
});

app.listen(PORT, () => {
  console.log(`News scraper backend running on port ${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/health`);
});

module.exports = app;
