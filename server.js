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

// Scrape Farmers Weekly
async function scrapeFWI(keywords) {
  const articles = [];
  try {
    const response = await axios.get('https://www.fwi.co.uk/livestock', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    
    const $ = cheerio.load(response.data);
    
    // Try multiple selectors
    const articleSelectors = [
      'article',
      '.article-card',
      '.story-card',
      '.post',
      'div[class*="article"]'
    ];
    
    for (const selector of articleSelectors) {
      $(selector).each((i, elem) => {
        if (articles.length >= 15) return false;
        
        const $elem = $(elem);
        const $link = $elem.find('a').first();
        const href = $link.attr('href');
        
        if (!href) return;
        
        const url = href.startsWith('http') ? href : `https://www.fwi.co.uk${href}`;
        
        // Get title
        let title = $elem.find('h2, h3, h4, .headline, .title').first().text().trim();
        if (!title) title = $link.text().trim();
        
        // Get summary from any paragraph in the element
        let summary = $elem.find('p').map((i, p) => $(p).text().trim())
          .get()
          .filter(t => t.length > 30)
          .join(' ')
          .substring(0, 350);
        
        if (!summary) {
          summary = 'Read the full article for more details about this livestock news story.';
        }
        
        if (title && title.length > 15 && !articles.find(a => a.url === url)) {
          articles.push({ title, url, summary, source: 'Farmers Weekly' });
        }
      });
      
      if (articles.length > 0) break;
    }
  } catch (error) {
    console.error('FWI error:', error.message);
  }
  
  return articles.filter(article => {
    const text = (article.title + ' ' + article.summary).toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  }).map((a, i) => ({
    id: `fwi-${i}`,
    title: a.title,
    url: a.url,
    source: a.source,
    date: new Date().toISOString().split('T')[0],
    summary: a.summary,
    keywords: keywords.filter(kw => (a.title + ' ' + a.summary).toLowerCase().includes(kw.toLowerCase()))
  }));
}

// Scrape Scottish Farmer
async function scrapeScottishFarmer(keywords) {
  const articles = [];
  try {
    const response = await axios.get('https://www.thescottishfarmer.co.uk/news/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    
    const $ = cheerio.load(response.data);
    
    const articleSelectors = ['article', '.article', '.story', 'div[class*="article"]'];
    
    for (const selector of articleSelectors) {
      $(selector).each((i, elem) => {
        if (articles.length >= 15) return false;
        
        const $elem = $(elem);
        const $link = $elem.find('a').first();
        const href = $link.attr('href');
        
        if (!href) return;
        
        const url = href.startsWith('http') ? href : `https://www.thescottishfarmer.co.uk${href}`;
        
        let title = $elem.find('h2, h3, h4').first().text().trim();
        if (!title) title = $link.text().trim();
        
        let summary = $elem.find('p').map((i, p) => $(p).text().trim())
          .get()
          .filter(t => t.length > 30)
          .join(' ')
          .substring(0, 350);
        
        if (!summary) {
          summary = 'Read the full article for more details about this livestock news story.';
        }
        
        if (title && title.length > 15 && !articles.find(a => a.url === url)) {
          articles.push({ title, url, summary, source: 'The Scottish Farmer' });
        }
      });
      
      if (articles.length > 0) break;
    }
  } catch (error) {
    console.error('Scottish Farmer error:', error.message);
  }
  
  return articles.filter(article => {
    const text = (article.title + ' ' + article.summary).toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  }).map((a, i) => ({
    id: `sf-${i}`,
    title: a.title,
    url: a.url,
    source: a.source,
    date: new Date().toISOString().split('T')[0],
    summary: a.summary,
    keywords: keywords.filter(kw => (a.title + ' ' + a.summary).toLowerCase().includes(kw.toLowerCase()))
  }));
}

// Scrape Farmers Guardian
async function scrapeFarmersGuardian(keywords) {
  const articles = [];
  try {
    const response = await axios.get('https://www.fginsight.com/news', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    
    const $ = cheerio.load(response.data);
    
    const articleSelectors = ['article', '.article', '.news-item', 'div[class*="article"]'];
    
    for (const selector of articleSelectors) {
      $(selector).each((i, elem) => {
        if (articles.length >= 15) return false;
        
        const $elem = $(elem);
        const $link = $elem.find('a').first();
        const href = $link.attr('href');
        
        if (!href) return;
        
        const url = href.startsWith('http') ? href : `https://www.fginsight.com${href}`;
        
        let title = $elem.find('h2, h3, h4').first().text().trim();
        if (!title) title = $link.text().trim();
        
        let summary = $elem.find('p').map((i, p) => $(p).text().trim())
          .get()
          .filter(t => t.length > 30)
          .join(' ')
          .substring(0, 350);
        
        if (!summary) {
          summary = 'Read the full article for more details about this livestock news story.';
        }
        
        if (title && title.length > 15 && !articles.find(a => a.url === url)) {
          articles.push({ title, url, summary, source: 'Farmers Guardian' });
        }
      });
      
      if (articles.length > 0) break;
    }
  } catch (error) {
    console.error('Farmers Guardian error:', error.message);
  }
  
  return articles.filter(article => {
    const text = (article.title + ' ' + article.summary).toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  }).map((a, i) => ({
    id: `fg-${i}`,
    title: a.title,
    url: a.url,
    source: a.source,
    date: new Date().toISOString().split('T')[0],
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
