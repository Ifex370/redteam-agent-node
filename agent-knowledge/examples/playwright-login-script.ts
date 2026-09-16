import { chromium } from "playwright";

async function main() {
  const targetUrl = process.env.TARGET_URL;
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!targetUrl || !username || !password) {
    throw new Error("TARGET_URL, TEST_USERNAME, and TEST_PASSWORD are required.");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: "screenshots/login-page.png", fullPage: true });

  await page.fill('input[name="username"], input[type="email"]', username);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForLoadState("networkidle");

  await page.screenshot({ path: "screenshots/after-login.png", fullPage: true });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
