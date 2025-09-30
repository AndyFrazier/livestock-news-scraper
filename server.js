// server.js - Node.js Backend for Livestock News Scraper
// Install dependencies: npm install express axios cheerio cors node-fetch

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
  
  // Handle "X days ago" format
  const daysAgoMatch = dateText.match(/(\d+)\s+days?\s+ago/i);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1]);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }
  
  // Handle "X hours ago" format
  const hoursAgoMatch = dateText.match(/(\d+)\s+hours?\s+ago/i);
  if (hoursAgoMatch) {
    return new Date().toISOString().split('T')[0];
  }
  
  // Handle "Today" or "Yesterday"
  if (dateText.toLowerCase().includes('today')) {
    return new Date().toISOString().split('T')[0];
  }
  if (dateText.toLowerCase().includes('yesterday')) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }
  
  // Try to parse standard date formats
  const date = new Date(dateText);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

// Scrape The Scottish Farmer
async function scrapeScottishFarmer(keywords) {
  const articles = [];
  
  try {
    const response = await axios.get('https://www.thescottishfarmer.co.uk/news/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Find article elements (adjust selectors based on actual HTML structure)
    $('.article-item, .news-item, article, .story-card').each((i, element) => {
      const $elem = $(element);
      
      // Extract article details
      const titleElem = $elem.find('h2, h3, .article-title, .headline').first();
      const linkElem = $elem.find('a').first();
      const summaryElem = $elem.find('p, .summary, .excerpt, .description').first();
      const dateElem = $elem.find('.date, .published, time, .timestamp').first();
      
      const title = titleElem.text().trim();
      let url = linkElem.attr('href');
      let summary = summaryElem.text().trim();
      
      // If no summary, try to get text from multiple p tags
      if (!summary || summary.length < 50) {
        summary = $elem.find('p').map((i, el) => $(el).text().trim()).get().join(' ').substring(0, 300);
      }
      
      const dateText = dateElem.text().trim() || dateElem.attr('datetime');
      
      // Make URL absolute if relative
      if (url && !url.startsWith('http')) {
        url = 'https://www.thescottishfarmer.co.uk' + url;
      }
      
      if (title && url) {
        const date = parseDate(dateText) || new Date().toISOString().split('T')[0];
        
        // Check if article matches keywords
        const textToSearch = (title + ' ' + summary).toLowerCase();
        const matchedKeywords = keywords.filter(keyword => 
          textToSearch.includes(keyword.toLowerCase())
        );
        
        if (matchedKeywords.length > 0 && isWithinSevenDays(date)) {
          articles.push({
            id: `sf-${i}`,
            title,
            url,
            source: 'The Scottish Farmer',
            date,
            summary: summary.substring(0, 300) || 'Click to read the full article for details.',
            keywords: matchedKeywords
          });
        }
      }
    });
  } catch (error) {
    console.error('Error scraping Scottish Farmer:', error.message);
  }
  
  return articles;
}

// Scrape Farmers Guardian
async function scrapeFarmersGuardian(keywords) {
  const articles = [];
  
  try {
    const response = await axios.get('https://www.fginsight.com/news', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    $('.article, .news-article, .story, article').each((i, element) => {
      const $elem = $(element);
      
      const titleElem = $elem.find('h2, h3, .title, .headline').first();
      const linkElem = $elem.find('a').first();
      const summaryElem = $elem.find('p, .summary, .teaser').first();
      const dateElem = $elem.find('.date, time, .published').first();
      
      const title = titleElem.text().trim();
      let url = linkElem.attr('href');
      const summary = summaryElem.text().trim();
      const dateText = dateElem.text().trim() || dateElem.attr('datetime');
      
      if (url && !url.startsWith('http')) {
        url = 'https://www.fginsight.com' + url;
      }
      
      if (title && url) {
        const date = parseDate(dateText) || new Date().toISOString().split('T')[0];
        
        const textToSearch = (title + ' ' + summary).toLowerCase();
        const matchedKeywords = keywords.filter(keyword => 
          textToSearch.includes(keyword.toLowerCase())
        );
        
        if (matchedKeywords.length > 0 && isWithinSevenDays(date)) {
          articles.push({
            id: `fg-${i}`,
            title,
            url,
            source: 'Farmers Guardian',
            date,
            summary: summary.substring(0, 200) || 'No summary available',
            keywords: matchedKeywords
          });
        }
      }
    });
  } catch (error) {
    console.error('Error scraping Farmers Guardian:', error.message);
  }
  
  return articles;
}

// Scrape Farmers Weekly
async function scrapeFarmersWeekly(keywords) {
  const articles = [];
  
  try {
    const response = await axios.get('https://www.fwi.co.uk/livestock', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    $('.article, article, .story-card').each((i, element) => {
      const $elem = $(element);
      
      const titleElem = $elem.find('h2, h3, .title').first();
      const linkElem = $elem.find('a').first();
      const summaryElem = $elem.find('p, .summary').first();
      const dateElem = $elem.find('.date, time').first();
      
      const title = titleElem.text().trim();
      let url = linkElem.attr('href');
      let summary = summaryElem.text().trim();
      
      // Better summary extraction
      if (!summary || summary.length < 50) {
        summary = $elem.find('p').map((i, el) => $(el).text().trim()).get().join(' ').substring(0, 300);
      }
      
      const dateText = dateElem.text().trim() || dateElem.attr('datetime');
      
      if (url && !url.startsWith('http')) {
        url = 'https://www.fwi.co.uk' + url;
      }
      
      if (title && url) {
        const date = parseDate(dateText) || new Date().toISOString().split('T')[0];
        
        const textToSearch = (title + ' ' + summary).toLowerCase();
        const matchedKeywords = keywords.filter(keyword => 
          textToSearch.includes(keyword.toLowerCase())
        );
        
        if (matchedKeywords.length > 0 && isWithinSevenDays(date)) {
          articles.push({
            id: `fw-${i}`,
            title,
            url,
            source: 'Farmers Weekly',
            date,
            summary: summary.substring(0, 300) || 'Click to read the full article for details.',
            keywords: matchedKeywords
          });
        }
      }
    });
  } catch (error) {
    console.error('Error scraping Farmers Weekly:', error.message);
  }
  
  return articles;
}

// Scrape Irish Farmers Journal
async function scrapeIrishFarmersJournal(keywords) {
  const articles = [];
  
  try {
    const response = await axios.get('https://www.farmersjournal.ie/livestock', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    $('article, .article, .story').each((i, element) => {
      const $elem = $(element);
      
      const titleElem = $elem.find('h2, h3, .headline, .title').first();
      const linkElem = $elem.find('a').first();
      const summaryElem = $elem.find('p, .excerpt, .description').first();
      const dateElem = $elem.find('time, .date, .published').first();
      
      const title = titleElem.text().trim();
      let url = linkElem.attr('href');
      let summary = summaryElem.text().trim();
      
      if (!summary || summary.length < 50) {
        summary = $elem.find('p').map((i, el) => $(el).text().trim()).get().join(' ').substring(0, 300);
      }
      
      const dateText = dateElem.text().trim() || dateElem.attr('datetime');
      
      if (url && !url.startsWith('http')) {
        url = 'https://www.farmersjournal.ie' + url;
      }
      
      if (title && url) {
        const date = parseDate(dateText) || new Date().toISOString().split('T')[0];
        
        const textToSearch = (title + ' ' + summary).toLowerCase();
        const matchedKeywords = keywords.filter(keyword => 
          textToSearch.includes(keyword.toLowerCase())
        );
        
        if (matchedKeywords.length > 0 && isWithinSevenDays(date)) {
          articles.push({
            id: `ifj-${i}`,
            title,
            url,
            source: 'Irish Farmers Journal',
            date,
            summary: summary.substring(0, 300) || 'Click to read the full article for details.',
            keywords: matchedKeywords
          });
        }
      }
    });
  } catch (error) {
    console.error('Error scraping Irish Farmers Journal:', error.message);
  }
  
  return articles;
}

// Scrape Beef Farmer
async function scrapeBeefFarmer(keywords) {
  const articles = [];
  
  try {
    const response = await axios.get('https://beeffarmer.co.uk/news/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    $('article, .post, .news-item').each((i, element) => {
      const $elem = $(element);
      
      const titleElem = $elem.find('h2, h3, .entry-title, .title').first();
      const linkElem = $elem.find('a').first();
      const summaryElem = $elem.find('p, .excerpt, .entry-summary').first();
      const dateElem = $elem.find('time, .date, .entry-date').first();
      
      const title = titleElem.text().trim();
      let url = linkElem.attr('href');
      let summary = summaryElem.text().trim();
      
      if (!summary || summary.length < 50) {
        summary = $elem.find('p').map((i, el) => $(el).text().trim()).get().join(' ').substring(0, 300);
      }
      
      const dateText = dateElem.text().trim() || dateElem.attr('datetime');
      
      if (url && !url.startsWith('http')) {
        url = 'https://beeffarmer.co.uk' + url;
      }
      
      if (title && url) {
        const date = parseDate(dateText) || new Date().toISOString().split('T')[0];
        
        const textToSearch = (title + ' ' + summary).toLowerCase();
        const matchedKeywords = keywords.filter(keyword => 
          textToSearch.includes(keyword.toLowerCase())
        );
        
        if (matchedKeywords.length > 0 && isWithinSevenDays(date)) {
          articles.push({
            id: `bf-${i}`,
            title,
            url,
            source: 'Beef Farmer',
            date,
            summary: summary.substring(0, 300) || 'Click to read the full article for details.',
            keywords: matchedKeywords
          });
        }
      }
    });
  } catch (error) {
    console.error('Error scraping Beef Farmer:', error.message);
  }
  
  return articles;
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
      scottishFarmerArticles, 
      farmersGuardianArticles, 
      farmersWeeklyArticles,
      irishFarmersJournalArticles,
      beefFarmerArticles
    ] = await Promise.all([
      scrapeScottishFarmer(keywords),
      scrapeFarmersGuardian(keywords),
      scrapeFarmersWeekly(keywords),
      scrapeIrishFarmersJournal(keywords),
      scrapeBeefFarmer(keywords)
    ]);
    
    // Combine all articles
    const allArticles = [
      ...scottishFarmerArticles,
      ...farmersGuardianArticles,
      ...farmersWeeklyArticles,
      ...irishFarmersJournalArticles,
      ...beefFarmerArticles
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
