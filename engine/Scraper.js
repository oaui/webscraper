import {
  formatLocales,
  getTimeZoneByIp,
  randnum,
  readFile,
  getChromePath,
} from "../util/Helpers.js";
import { setupProxy } from "../proxy/Proxyutil.js";
import { log } from "../util/Util.js";
import { getBrowser } from "./Browser.js";
import { solveCaptcha } from "./Captcha.js";
import { automate } from "./Automation.js";
import { Browser } from "rebrowser-puppeteer-core";

const BROWSER_CONFIG = {
  website:
    process.argv.find((arg) => arg.startsWith("-site="))?.split("=")[1] ||
    process.argv.find((arg) => arg.startsWith("--website="))?.split("=")[1] ||
    "https://example.com",
  targetPort:
    parseInt(
      process.argv.find((arg) => arg.startsWith("-port="))?.split("=")[1],
    ) ||
    parseInt(
      process.argv
        .find((arg) => arg.startsWith("--targetPort="))
        ?.split("=")[1],
    ) ||
    null,
  browserCount:
    /**
     * * Max amount of browsers with different proxies
     */
    parseInt(
      process.argv.find((arg) => arg.startsWith("-b="))?.split("=")[1],
    ) ||
    parseInt(
      process.argv.find((arg) => arg.startsWith("--browsers="))?.split("=")[1],
    ) ||
    5,
  runtime:
    parseInt(
      process.argv.find((arg) => arg.startsWith("--time="))?.split("=")[1],
    ) ||
    parseInt(
      process.argv.find((arg) => arg.startsWith("-runtime="))?.split("=")[1],
    ) ||
    120,
  userAgents:
    process.argv.find((arg) => arg.startsWith("--uas-file="))?.split("=")[1] ||
    process.argv.find((arg) => arg.startsWith("-uas="))?.split("=")[1] ||
    "../files/uas.txt",
  localeFile:
    process.argv
      .find((arg) => arg.startsWith("--locale-file="))
      ?.split("=")[1] ||
    process.argv.find((arg) => arg.startsWith("-locales="))?.split("=")[1] ||
    "../files/locales.txt",
  proxyFile:
    process.argv
      .find((arg) => arg.startsWith("--proxy-file="))
      ?.split("=")[1] ||
    process.argv.find((arg) => arg.startsWith("-p="))?.split("=")[1] ||
    "../files/proxies.txt",
};

const args = process.argv.slice(2);

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--website":
    case "-site":
      BROWSER_CONFIG.website = args[i + 1];
      i++;
      break;
    case "--browsers":
    case "-b":
      BROWSER_CONFIG.browserCount = parseInt(args[i + 1]);
      i++;
      break;
    case "--time":
    case "-runtime":
      BROWSER_CONFIG.runtime = parseInt(args[i + 1]);
      i++;
      break;
    case "--proxy-file":
    case "-p":
      BROWSER_CONFIG.proxyFile = args[i + 1];
      i++;
      break;
    case "--uas-file":
    case "-uas":
      BROWSER_CONFIG.userAgents = args[i + 1];
      i++;
      break;
    case "--locale-file":
    case "-locales":
      BROWSER_CONFIG.localeFile = args[i + 1];
      i++;
      break;
    case "--help":
    case "-h":
      console.log(`
🌐 Cloudflare Browser Automation Tool

Usage: node browser.js [options]

Required Options:
      -site, --websites <url> [String, Array] Target URL(s) to visit (e.g. -site https://example.com or -site urls.txt)
  

Optional Options:


Note: This tool automates browsers.
            `);
      process.exit(0);
      break;
  }
}

if (
  !BROWSER_CONFIG.website ||
  BROWSER_CONFIG.website === "https://example.com"
) {
  console.error("❌ Error: Target URL is required!");
  console.error("Usage: node browser.js -t <target_url>");
  console.error("Use --help for more information");
  process.exit(1);
}

async function setupBrowser(website, browserId, browsers, proxies) {
  const brwsr = await getBrowser(BROWSER_CONFIG, browserId, proxies);

  let browser, page;
  try {
    const result = await brwsr.connect(brwsr.connectOptions);
    browser = result.browser;
    page = result.page;

    page = await browser.newPage();

    browsers[browserId - 1] = browser;
  } catch (error) {
    log("ERROR", `Browser ${browserId}: Failed to connect: ${error.message}`);
    return false;
  }

  try {
    log("SUCCESS", `Browser ${browserId}: Starting Puppeteer`);
    log("INFO", `Browser ${browserId}: > ${website}`);

    await page.goto(website, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    /**
     * ? This is where the magic happens.
     */
    const captchaResult = await solveCaptcha(page);

    if (captchaResult.success) {
      await automate(page);
    }
  } catch (error) {
    log(
      "ERROR",
      `Browser ${browserId}: Unable to create proxy tunnel: ${error}`,
    );
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    return { success: false };
  }
}

async function startBrowsers(website, browserCount = 1) {
  log("FARM", `Starting ${browserCount} browsers...`);

  const proxies = await setupProxy(BROWSER_CONFIG);

  const browserPromises = [];
  const browsers = [];
  let index = 1;
  for (const site of website.websiteArr || [website]) {
    const browserPromise = setupBrowser(site, index++, browsers, proxies);
    browserPromises.push(browserPromise);
    if (index < browserCount) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  log("INFO", "All browsers started. Waiting for completion...");
  const settled = await Promise.allSettled(browserPromises);
  const results = settled
    .map((p, i) =>
      p.status === "fulfilled"
        ? p.value
        : { success: false, browserId: i + 1, error: p.reason },
    )
    .filter(Boolean);

  log("INFO", `Amount of browser instances: ${results.length}`);
  const successfulBrowsers = results.filter((r) => r && r.success);
  log("INFO", `Successfully connected browsers: ${successfulBrowsers.length}`);
}

async function main() {
  log("INFO", "Scraping...");

  const website = function () {
    let websiteArr = BROWSER_CONFIG.website;
    if (BROWSER_CONFIG.website.includes(".txt")) {
      try {
        websiteArr = readFile(BROWSER_CONFIG.website);
      } catch (error) {
        log("ERROR", `Error reading website file: ${error.message}`);
        process.exit(1);
      }
    }
    if (BROWSER_CONFIG.website.includes(",")) {
      websiteArr = BROWSER_CONFIG.website.split(",");
    }
    return { websiteArr, browserCount: websiteArr ? websiteArr.length : 1 };
  };

  await Promise.race([startBrowsers(website(), website().browserCount)]);
}

main().catch((error) => {
  log("ERROR", error.message);
  if (error.message.includes("Time limit")) {
    log("WARN", "Shutting down all browsers due to timeout...");
    process.exit(0);
  }
  if (error.message.includes("Failed to launch the browser")) {
    log("INFO", "Possible solutions:");
    log("INFO", "1. Run with sudo (Linux/Mac)");
    log("INFO", "2. Install Chrome/Chromium");
    log("INFO", "3. Try with --no-sandbox flag");
  }
});
