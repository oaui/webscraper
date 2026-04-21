import * as puppeteer from "puppeteer-real-browser";
import {
  formatLocales,
  getTimeZoneByIp,
  randnum,
  readFile,
  getChromePath,
} from "../util/Helpers.js";
import { log } from "../util/Util.js";

const WINDOW_SIZES = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1680, height: 1050 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 }, // 4K
  { width: 3440, height: 1440 }, // Ultrawide
  { width: 1920, height: 1200 }, // 16:10
  { width: 1680, height: 1050 }, // 16:10
  { width: 1440, height: 900 }, // 16:10
  { width: 1280, height: 800 }, // 16:10
];

function getRandomWindowSize() {
  return WINDOW_SIZES[Math.floor(Math.random() * WINDOW_SIZES.length)];
}

function getRandomUserAgent(uaArr) {
  return uaArr[Math.floor(Math.random() * uaArr.length)];
}

export async function getBrowser(BROWSER_CONFIG, browserId, proxies) {
  const proxyIndex = browserId - 1;

  let connect;
  try {
    connect = puppeteer.connect;
  } catch (error) {
    log(
      "ERROR",
      `Browser ${browserId}: Failed to import puppeteer-real-browser: ${error.message}`,
    );
    return false;
  }

  /**
   * ! Grab all necessary arrays or values
   */
  /**
   * Read file content into array
   */

  const userAgentArr = readFile(BROWSER_CONFIG.userAgents);
  /**
   * localesArr is an array of locales AND timezones, Format locale:timezone
   */
  const localesArr = readFile(BROWSER_CONFIG.localeFile);
  /**
   * Turn locales in array of objects {lang, timezone}
   */
  const locales = formatLocales(localesArr);

  if (proxies.length <= 0) {
    log("ERROR", `Browser ${browserId}: No valid proxies available.`);
  } else {
    log("PROXY", `Browser ${browserId}: Amount of proxies: ${proxies.length}`);
  }

  const windowSize = getRandomWindowSize();
  const userAgent = getRandomUserAgent(userAgentArr);
  /**
   * ? Create hashmaps to obtain correct country codes
   */
  /* locale -> timezone */
  const localeToTimezone = new Map(
    locales.map((obj) => [obj.lang, obj.timezone]),
  );
  const timezoneToLocale = new Map(
    locales.map((obj) => [obj.timezone, obj.lang]),
  );
  const timezoneFromIp =
    (await getTimeZoneByIp(proxies[proxyIndex].host)) || "America/New_York";
  /**
   * Grab locals from hashMap and API
   */
  /**
   * ? Incase, the getTimeZoneByIp is unable, to obtain the proxies locales, use default on both
   */
  const locale = timezoneToLocale.get(timezoneFromIp) || "en-US";
  const timezone = localeToTimezone.get(locale) || timezoneFromIp;

  const connectOptions = {
    headless: false,
    turnstile: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      `--window-size=${windowSize.width},${windowSize.height}`,
      `--lang=${locale}`,
      `--timezone=${timezone}`,
    ],
    connectOption: {
      /**
       * ! IMPORTANT:
       */
      defaultViewport: null,
    },
    fingerprint: {
      devices: ["desktop"],
      locales: [locale],
      screens: [`${windowSize.width}x${windowSize.height}`],
    },
    customConfig: {
      userAgent: userAgent,
      executablePath: getChromePath(),
    },
    proxy: {
      host: proxies[proxyIndex].host || null,
      port: proxies[proxyIndex].port || null,
      username: proxies[proxyIndex].username || null,
      password: proxies[proxyIndex].password || null,
    },
  };

  return { connect, connectOptions, success: true };
}
