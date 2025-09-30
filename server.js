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

// Scrape Farmers Weekly using RSS feed (more reliable)
async function scrapeFWI(keywords) {
  const articles = [];
  
  // Try multiple RSS feeds
  const rssFeeds = [
    'https://www.fwi.co.uk/livestock/feed',
    'https://www.fwi.co.uk/feed'
  ];
  
  for (const feedUrl of rssFeeds) {
    try {
      console.log(`Trying FWI feed: ${feedUrl}`);
      const rssResponse = await axios.get(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      
      const $ = cheerio.load(rssResponse.data, { xmlMode: true });
      
      $('item').each((i, elem) => {
        const $item = $(elem);
        const title = $item.find('title').text().trim();
        const url = $item.find('link').text().trim();
        const description = $item.find('description').text().trim().replace(/<[^>]*>/g, ''); // Strip HTML
        const pubDate = $item.find('pubDate').text().trim();
        
        if (title && url && !articles.find(a => a.url === url)) {
          articles.push({
            title,
            url,
            summary: description || 'Read the full article for more details.',
            source: 'Farmers Weekly',
            date: parseDate(pubDate)
          });
        }
      });
      
      console.log(`FWI feed ${feedUrl} found ${articles.length} total articles so far`);
      
    } catch (error) {
      console.error(`FWI feed ${feedUrl} error:`, error.message);
    }
  }
  
  const filtered = articles.filter(article => {
    const text = (article.title + ' ' + article.summary).toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  });
  
  console.log(`FWI filtered to ${filtered.length} articles matching keywords`);
  
  return filtered.map((a, i) => ({
    id: `fwi-${i}`,
    title: a.title,
    url: a.url,
    source: a.source,
    date: a.date || new Date().toISOString().split('T')[0],
    summary: a.summary,
    keywords: keywords.filter(kw => (a.title + ' ' + a.summary).toLowerCase().includes(kw.toLowerCase()))
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
    
    const [fwiArticles, sfArticles, fgArticles] = await Promise.all([
      scrapeFWI(keywords),
      scrapeScottishFarmer(keywords),
      scrapeFarmersGuardian(keywords)
    ]);
    
    const allArticles = [...fwiArticles, ...sfArticles, ...fgArticles];
    
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`Found ${allArticles.length} articles`);
    
    res.json({
      success: true,
      count: allArticles.length,
      articles: allArticles
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
