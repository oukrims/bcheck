import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

puppeteer.use(StealthPlugin());

export interface Proxy {
  host: string;
  port: string;
  username: string;
  password: string;
}

export const readProxiesFromFile = async (filePath: string): Promise<Proxy[]> => {
  const proxies: Proxy[] = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const [host, port, username, password] = line.split(':');
    proxies.push({ host, port, username, password });
  }

  return proxies;
};

export const getRandomProxy = (proxies: Proxy[]): Proxy => {
  const randomIndex = Math.floor(Math.random() * proxies.length);
  return proxies[randomIndex];
};

export const launchBrowser = async (): Promise<Browser> => {
    // const extensionPath = path.resolve('extensions', 'capsolver');
    const proxyServer = `http://127.0.0.1:9095`;
    
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        // `--disable-extensions-except=${extensionPath}`,
        // `--load-extension=${extensionPath}`,
        `--proxy-server=${proxyServer}`,
      ],
    });

    return browser;
};

export const closeBrowser = async (browser: Browser) => {
  await browser.close();
};