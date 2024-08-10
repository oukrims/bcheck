import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { launchBrowser, closeBrowser, readProxiesFromFile, getRandomProxy, Proxy } from './utils/browserUtils';
import { loginBinance } from './scripts/loginBinance';
import fs from 'fs';
import path from 'path';
import { Level } from 'level';
import { Browser, Page } from 'puppeteer';

const db = new Level('./leveldb', { valueEncoding: 'json' });

const BATCH_SIZE = 3; 
const THROTTLE_TIME = 10000; 
const CONCURRENCY_LIMIT = 2; // Number of concurrent browser instances

const filePath = path.join(__dirname, '..', 'ick.txt');
const emails = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);

const screen = blessed.screen({ smartCSR: true, title: 'Login Script' });
const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });
const table = grid.set(0, 0, 12, 12, contrib.table, {
  keys: true,
  fg: 'white',
  label: 'Check Results',
  columnSpacing: 2,
  columnWidth: [30, 10],
});

screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

const updateTable = (results: { email: string; success: boolean }[]) => {
  const data = {
    headers: ['Email', 'Status'],
    data: results.map(({ email, success }) => [
      email,
      success ? '✅ Success' : '❌ Failed',
    ]),
  };
  table.setData(data);
  screen.render();
};

async function processEmail(browser: Browser, email: string): Promise<{ email: string; success: boolean }> {
  try {
    const cachedResult = await db.get(email).catch(() => null);
    if (cachedResult) {
      const { success } = JSON.parse(cachedResult);
      return { email, success };
    }

    const success = await loginBinance(browser, email);
    await db.put(email, JSON.stringify({ success, timestamp: new Date().toISOString() }));
    return { email, success };
  } catch (error) {
    console.error(`Error processing ${email}:`, error);
    return { email, success: false };
  }
}

async function processBatch(browser: Browser, emails: string[]): Promise<{ email: string; success: boolean }[]> {
  const results = await Promise.all(emails.map(email => processEmail(browser, email)));
  return results;
}

async function processEmailsInParallel(emails: string[], concurrencyLimit: number) {
  let index = 0;
  const loginResults: { email: string; success: boolean }[] = [];

  const processNextBatch = async () => {
    if (index >= emails.length) return;

    const batch = emails.slice(index, index + BATCH_SIZE);
    index += BATCH_SIZE;

    const browser = await launchBrowser();
    try {
      const batchResults = await processBatch(browser, batch);
      loginResults.push(...batchResults);
    } finally {
      await closeBrowser(browser);
    }

    // Update the table with results
    updateTable(loginResults);

    // Continue processing the next batch
    await new Promise(resolve => setTimeout(resolve, THROTTLE_TIME));
    await processNextBatch();
  };

  // Start processing with limited concurrency
  const concurrencyPromises = Array.from({ length: concurrencyLimit }, processNextBatch);
  await Promise.all(concurrencyPromises);
}

(async () => {
  // Process emails with concurrency and throttling
  await processEmailsInParallel(emails, CONCURRENCY_LIMIT);

  screen.render();
})();
