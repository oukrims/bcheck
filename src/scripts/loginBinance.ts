import { Browser } from 'puppeteer';
import { Proxy } from '../utils/browserUtils';

export const loginBinance = async (browser: Browser, email: string): Promise<boolean> =>  {
  const page = await browser.newPage();

  await page.goto('https://accounts.binance.com/en/login');

  await page.waitForSelector('input[name="username"]');
  await page.type('input[name="username"]', email);
 
  await page.waitForSelector('button[data-e2e="btn-accounts-form-submit"]');
  await page.click('button[data-e2e="btn-accounts-form-submit"]');

  try {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
    
    const currentUrl = page.url();
    if (currentUrl.includes('https://accounts.binance.com/en/login-password?')) {
      console.log('Login successful.');
      return true;
    } else {
      console.log('Login failed or redirected.');
      return false;
    }
  } catch (error) {
    return false;
  } finally {
    await page.close();
  }
};
