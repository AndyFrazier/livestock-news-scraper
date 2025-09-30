// server.js - Improved News Scraper Backend
// Install dependencies: npm install express axios cheerio cors

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Helper function to check if date is within last 7 days
function isWithinSevenDays(dateString) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const articleDate = new Date(dateString);
  return articleDate >= sevenDaysAgo;
}

// Helper function to extract date from various formats
function parseDate(dateText) {
  if (!dateText) return null;
  
  const daysAgoMatch = dateText.match(/(\d+)\s+days?\s+ago/i);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1]);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }
  
  const hoursAgoMatch = dateText.match(/(\d+)\s+hours?\s+ago/i);
  if (hoursAgoMatch) {
    return new Date().toISOString().split('T')[0];
  }
  
  if (dateText.toLowerCase().includes('today')) {
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
  
  return null;
}

// Helper to extract summary from article page
async function fetchArticleSummary(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove script and style tags
    $('script, style, nav, header, footer, aside').remove();
    
    // Try multiple selectors for article content
    let summary = '';
    const selectors = [
      'article p',
      '.article-content p',
      '.entry-content p',
      '.post-content p',
      '.content p',
      'main p'
    ];
    
    for (const selector of selectors) {
      const paragraphs = $(selector).map((i, el) => $(el).text().trim()).get();
      const combined = paragraphs.filter(p => p.length > 50).slice(0, 3).join(' ');
      if (combined.length > 100) {
        summary = combined;
        break;
      }
    }
    
    return summary.substring(0, 400) || null;
  } catch (error) {
    console.error('Error fetching article summary:', error.message);
    return null;
  }
}

// Scrape Farmers Weekly (FWI)
async function scrapeFarmersWeekly(keywords) {
  const articles = [];
  
  try {
    const response = await axios.get('https://www.fwi.co.uk/livestock', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Look for article links
    $('a[href*="/livestock"]').each((i, element) => {
      if (i >= 20) return false; // Limit to 20 articles
      
      const $link = $(element);
      const url = $link.attr('href');
      
      if (!url || url === '#') return;
      
      const fullUrl = url.startsWith('http') ? url : 'https://www.fwi.co.uk' + url;
      
      // Get title from link text or nearby heading
      let title = $link.text().trim();
      if (!title || title.length < 10) {
        title = $link.find('h2, h3, h4').text().trim();
      }
      if (!title || title.length < 10) {
        title = $link.closest('article, .article, div').find('h2, h3, h4').first().text().trim();
      }
      
      if (title && title.length > 10 && !articles.find(a => a.url === fullUrl)) {
        articles.push({
          title,
          url: fullUrl,
          source: 'Farmers Weekly',
          needsSummary: true
        });
      }
    });
  } catch (error) {
    console.error('Error scraping Farmers Weekly:', error.message);
  }
  
  // Filter by keywords and fetch summaries
  const filteredArticles = [];
  for (const article of articles) {
    const titleLower = article.title.toLowerCase();
    const matchedKeywords = keywords.filter(keyword => 
      titleLower.includes(keyword.toLowerCase())
    );
    
    if (matchedKeywords.length > 0) {
      const summary = await fetchArticleSummary(article.url);
      if (summary) {
        filteredArticles.push({
          id: `fwi-${filteredArticles.length}`,
          title: article.title,
          url: article.url,
          source: article.source,
          date: new Date().toISOString().split('T')[0],
          summary: summary,
          keywords: matchedKeywords
        });
      }
    }
  }
  
  return filteredArticles;
}

// Scrape Western Livestock Journal
async function scrapeWesternLivestockJournal(keywords) {
  const articles = [];
  
  try {
    const response = await axios.get('https://www.wlj.net/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    $('a[href*="/"]').each((i, element) => {
      if (i >= 20) return false;
      
      const $link = $(element);
      const url = $link.attr('href');
      
      if (!url || url === '#' || url === '/') return;
      
      const fullUrl = url.startsWith('http') ? url : 'https://www.wlj.net' + url;
      
      let title = $link.text().trim();
      if (!title || title.length < 10) {
        title = $link.find('h2, h3, h4').text().trim();
      }
      if (!title || title.length < 10) {
        title = $link.closest('article, .article, div').find('h2, h3, h4').first().text().trim();
      }
      
      if (title && title.length > 10 && !articles.find(a => a.url === fullUrl)) {
        articles.push({
          title,
          url: fullUrl,
          source: 'Western Livestock Journal',
          needsSummary: true
        });
      }
    });
  } catch (error) {
    console.error('Error scraping Western Livestock Journal:', error.message);
  }
  
  const filteredArticles = [];
  for (const article of articles) {
    const titleLower = article.title.toLowerCase();
    const matchedKeywords = keywords.filter(keyword => 
      titleLower.includes(keyword.toLowerCase())
    );
    
    if (matchedKeywords.length > 0) {
      const summary = await fetchArticleSummary(article.url);
      if (summary) {
        filteredArticles.push({
          id: `wlj-${filteredArticles.length}`,
          title: article.title,
          url: article.url,
          source: article.source,
          date: new Date().toISOString().split('T')[0],
          summary: summary,
          keywords: matchedKeywords
        });
      }
    }
  }
  
  return filteredArticles;
}

// Scrape The Scottish Farmer
async function scrapeScottishFarmer(keywords) {
  const articles = [];
  
  try {
    const response = await axios.get('https://www.thescottishfarmer.co.uk/news/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    $('a[href*="/news/"]').each((i, element) => {
      if (i >= 20) return false;
      
      const $link = $(element);
      const url = $link.attr('href');
      
      if (!url || url === '#') return;
      
      const fullUrl = url.startsWith('http') ? url : 'https://www.thescottishfarmer.co.uk' + url;
      
      let title = $link.text().trim();
      if (!title || title.length < 10) {
        title = $link.find('h2, h3, h4').text().trim();
      }
      if (!title || title.length < 10) {
        title = $link.closest('article, .article, div').find('h2, h3, h4').first().text().trim();
      }
      
      if (title && title.length > 10 && !articles.find(a => a.url === fullUrl)) {
        articles.push({
          title,
          url: fullUrl,
          source: 'The Scottish Farmer',
          needsSummary: true
        });
      }
    });
  } catch (error) {
    console.error('Error scraping Scottish Farmer:', error.message);
  }
  
  const filteredArticles = [];
  for (const article of articles) {
    const titleLower = article.title.toLowerCase();
    const matchedKeywords = keywords.filter(keyword => 
      titleLower.includes(keyword.toLowerCase())
    );
    
    if (matchedKeywords.length > 0) {
      const summary = await fetchArticleSummary(article.url);
      if (summary) {
        filteredArticles.push({
          id: `sf-${filteredArticles.length}`,
          title: article.title,
          url: article.url,
          source: article.source,
          date: new Date().toISOString().split('T')[0],
          summary: summary,
          keywords: matchedKeywords
        });
      }
    }
  }
  
  return filteredArticles;
}

// API endpoint to search articles
app.post('/api/search', async (req, res) => {
  try {
    const { keywords } = req.body;
    
    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords array is required' });
    }
    
    console.log('Searching for keywords:', keywords);
    
    // Scrape all sources in parallel
    const [
      farmersWeeklyArticles,
      westernLivestockArticles,
      scottishFarmerArticles
    ] = await Promise.all([
      scrapeFarmersWeekly(keywords),
      scrapeWesternLivestockJournal(keywords),
      scrapeScottishFarmer(keywords)
    ]);
    
    // Combine all articles
    const allArticles = [
      ...farmersWeeklyArticles,
      ...westernLivestockArticles,
      ...scottishFarmerArticles
    ];
    
    // Sort by date (newest first)
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Proxy endpoint for Zapier webhooks (to avoid CORS issues)
app.post('/api/zapier-proxy', async (req, res) => {
  try {
    const { webhookUrl, data } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'Webhook URL is required' });
    }
    
    console.log('Proxying to Zapier:', webhookUrl);
    
    const response = await axios.post(webhookUrl, data, {
      headers: {
        'Content-Type': 'application/json'
      }
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

// Start server
app.listen(PORT, () => {
  console.log(`News scraper backend running on port ${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/health`);
});

module.exports = app;
