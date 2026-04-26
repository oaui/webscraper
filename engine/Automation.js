import { solveCaptcha } from "./Captcha.js";
import { log } from "../util/Util.js";

export async function automate(page) {
  for (let i = 0; i < 3; i++) {
    try {
      const didNavigate = await scanWebsite(page);
      if (!didNavigate.success) {
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      continue;
    }
  }
  return { success: true };
}
async function handlePotentialJobs(text, page, element) {
  const jobs = ["entwickler", "developer", "linux"];

  if (jobs.some((job) => text.includes(job))) {
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    element.click();
  }
}
async function scanWebsite(page) {
  const keywords = [
    "karriere",
    "career",
    "jobs",
    "stellenangebote",
    "stellenanzeigen",
    "offene stellen",
  ];

  const clickableSelectors = [
    "a",
    "button",
    "input[type='submit']",
    "input[type='button']",
  ];

  for (const frame of page.frames()) {
    for (const selector of clickableSelectors) {
      const elements = await frame.$$(selector);

      for (const element of elements) {
        try {
          const text = await frame.evaluate((el) => {
            if (!el) return "";

            if (el.tagName === "INPUT") {
              return (el.value || "").toLowerCase();
            }

            return (el.textContent || "").toLowerCase();
          }, element);

          const captchaSolved = await solveCaptcha(page);
          if (captchaSolved.success) {
            const cookiesPresent = await handleCookies(page);
            const jobs = await handlePotentialJobs(text, page, element);
          }

          if (!keywords.some((k) => text.includes(k))) continue;

          console.log("Clicking:", text);

          const box = await element.boundingBox();
          if (!box) continue;

          await element.evaluate((el) =>
            el.scrollIntoView({ block: "center" }),
          );

          await Promise.all([
            page
              .waitForNavigation({ waitUntil: "domcontentloaded" })
              .catch(() => {}),
            element.click({ delay: 500 }),
          ]);
        } catch (err) {
          continue;
        }
      }
    }
  }
  return { success: true };
}
async function handleCookies(page) {
  const keywords = /accept|agree|akzeptieren|zustimmen|consent|allow/i;

  for (const frame of page.frames()) {
    try {
      const clicked = await frame.evaluate((keywordsStr) => {
        const regex = new RegExp(keywordsStr, "i");

        function isVisible(el) {
          const rect = el.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            window.getComputedStyle(el).visibility !== "hidden" &&
            window.getComputedStyle(el).display !== "none"
          );
        }

        function walk(node) {
          if (!node) return false;

          const isClickable =
            node.tagName === "BUTTON" ||
            node.tagName === "A" ||
            node.onclick ||
            node.getAttribute?.("role") === "button";

          if (isClickable) {
            const text = (
              node.innerText ||
              node.textContent ||
              ""
            ).toLowerCase();

            if (regex.test(text) && isVisible(node)) {
              node.click();
              return true;
            }
          }

          for (const child of node.children || []) {
            if (walk(child)) return true;
          }
          if (node.shadowRoot) {
            if (walk(node.shadowRoot)) return true;
          }

          return false;
        }

        return walk(document);
      }, keywords.source);

      if (clicked) {
        return true;
      }
    } catch (e) {
      continue;
    }
  }

  return false;
}
