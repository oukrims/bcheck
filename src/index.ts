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

async function processEmail(browser: Browser, email: string): Promise<{ email: string; success: boolean }> {
  try {
    const cachedResult = await db.get(email).catch(() => null);
    if (cachedResult) {
      const { success } = JSON.parse(cachedResult);
      return { email, success };
    }

    const success = await loginBinance(browser, email);
    await closeBrowser(browser);
    await db.put(email, JSON.stringify({ success, timestamp: new Date().toISOString() }));
    return { email, success };
  } catch (error) {
    console.error(`Error processing ${email}:`, error);
    return { email, success: false };
  }
}

async function processBatch(browser: Browser, emails: string[]): Promise<{ email: string; success: boolean }[]> {
  const results = await Promise.all(emails.map(email => processEmail(browser, email)));
  await new Promise(resolve => setTimeout(resolve, THROTTLE_TIME));
  return results;
}

(async () => {
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

  const loginResults: { email: string; success: boolean }[] = [];

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const browser = await launchBrowser();
    const batch = emails.slice(i, i + BATCH_SIZE);
    const batchResults = await processBatch(browser, batch);
    loginResults.push(...batchResults);
    updateTable(loginResults);
    await closeBrowser(browser);
  }

  screen.render();
})();