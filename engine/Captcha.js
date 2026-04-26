import { retrieveAiResponse } from "../util/Ai.js";

export async function solveCaptcha(page) {
  let captchaType = null;
  for (const frame of page.frames()) {
    try {
      const url = frame.url().toLowerCase();

      if (url.includes("challenges.cloudflare.com")) {
        captchaType = "cloudflare";
        return {
          success: await solveHelper(frame, 'input[type="checkbox"]').sucess,
          captchaType,
        };
      }
      if (/hcaptcha\.com/.test(url) && /checkbox/i.test(url)) {
        captchaType = "hcaptcha";
        return {
          success: await solveHelper(frame, "#checkbox").sucess,
          captchaType,
        };
      }
      if (frame.url().includes("frcapi.com")) {
        captchaType = "friendlycaptcha";
        return {
          success: await solveHelper(frame, 'button[role="checkbox"]').sucess,
          captchaType,
        };
      }

      const recaptcha = await handleRecaptcha(page);
      if (recaptcha.success) {
        captchaType = recaptcha.captchaType;
        return { success: true, captchaType };
      }

      return { success: true, captchaType: null };
    } catch (err) {
      return { success: false, captchaType: null };
    }
  }
}

async function solveHelper(frame, type = 'button[role="checkbox"]') {
  try {
    await frame.waitForSelector(type, {
      visible: true,
      timeout: 3000,
    });
    await frame.click(type);
    return { success: true };
  } catch {
    /**
     * ! Note: We do not return anything, as the frame might detach
     * */
  }
  return { sucess: false };
}

async function handleRecaptcha(page) {
  await page.waitForSelector('iframe[src*="recaptcha"]', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 1000));
  let recaptchaFrame = null;
  for (const frame of page.frames()) {
    const frameUrl = frame.url();
    try {
      if (/google\.com\/recaptcha\/(api2|enterprise)\/anchor/.test(frameUrl)) {
        let captchaType = "recaptchaV2";

        await frame.waitForSelector('span#recaptcha-anchor[role="checkbox"]', {
          visible: true,
          timeout: 5000,
        });
        await new Promise((r) => setTimeout(r, 500));
        recaptchaFrame = frame;
        await frame.click('span#recaptcha-anchor[role="checkbox"]');
        break;
      }
    } catch (e) {
      return { success: false, captchaType: null };
    }
  }

  /**
   * ? Image captcha:
   *
   */
  try {
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("iframe")].some(
          (f) => f.src.includes("recaptcha") && f.src.includes("bframe"),
        ),
      { timeout: 5000 },
    );
  } catch {
    console.log("No image challenge appeared, checkbox passed");
    return { success: true, captchaType: "recaptchaV2" };
  }

  await new Promise((r) => setTimeout(r, 1000));

  let challengeFrame = null;
  for (const frame of page.frames()) {
    if (/google\.com\/recaptcha\/(api2|enterprise)\/bframe/.test(frame.url())) {
      challengeFrame = frame;
      break;
    }
  }
  if (!challengeFrame) {
    return { success: true, captchaType: "recaptchaV2" };
  }
  const solved = await solveImageChallenge(page, challengeFrame);
  return { success: solved, captchaType: "recaptchaV2" };
}
async function solveImageChallenge(page, challengeFrame) {
  try {
    let solved = false;

    while (!solved) {
      await new Promise((r) => setTimeout(r, 2000));

      const has3x3 = await challengeFrame.$(".rc-imageselect-table-33");
      const has4x4 = await challengeFrame.$(".rc-imageselect-table-44");

      if (!has3x3 && !has4x4) {
        console.log("Unknown grid type, exiting");
        return false;
      }

      const gridType = has3x3 ? "3x3" : "4x4";
      const cellSelector = has3x3
        ? ".rc-imageselect-table-33 td"
        : ".rc-imageselect-table-44 td";
      const gridSelector = has3x3
        ? ".rc-imageselect-table-33"
        : ".rc-imageselect-table-44";

      console.log(`Solving ${gridType} captcha...`);

      const frameElement = await challengeFrame.frameElement();
      const imagePath = `../files/captchas/recaptcha-${Date.now()}.png`;
      await frameElement.screenshot({ path: imagePath });

      const aiPrompt = `Look at this ${gridType} captcha grid image. Think of cells as an array starting from upper-left as cell[0], going left to right, top to bottom. Which cells should I click to pass the captcha? Reply ONLY with cell references like: cell[0], cell[3], cell[7]`;
      const response = await retrieveAiResponse(imagePath, aiPrompt);

      const matches = response.match(/cell\[(\d+)\]/gi) || [];
      const indexes = [
        ...new Set(matches.map((m) => parseInt(m.match(/\d+/)[0]))),
      ];

      if (indexes.length === 0) {
        console.log("AI returned no cells, retrying...");
        continue;
      }

      const cells = await challengeFrame.$$(cellSelector);
      for (const i of indexes) {
        if (!cells[i]) continue;
        await cells[i].click();
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
      }

      await new Promise((r) => setTimeout(r, 1000));

      const verifyBtn = await challengeFrame.$("#recaptcha-verify-button");
      if (verifyBtn) {
        await verifyBtn.click();
        console.log("Clicked verify button");
      }

      await new Promise((r) => setTimeout(r, 3000));

      const tableGone = (await challengeFrame.$$("table")).length === 0;
      if (tableGone) {
        console.log("Captcha solved!");
        solved = true;
      } else {
        console.log("Table still present, solving next round...");
      }
    }

    return true;
  } catch (e) {
    console.log("Image challenge error:", e.message);
    return false;
  }
}
