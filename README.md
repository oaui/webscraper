# Netty Webscraper browser automation

## Engine
Puppeteer real browser

## Features
- Auto solve: CloudFlare Turnstile, Friendlycaptcha, hCaptcha, reCAPTCHA
- Find Job offers by regex match
- Click on the Job offer & extract tasks, etc.

## How to run
1. Clone repo
In the root folder of the project, where the package.json is located, run:
`npm i`
2. Switch to entry file
`cd engine`
3. Run:
`node Scraper.js --website https://example.com`
or
`node Scraper.js -site ..\files\sites.txt`

## Note:
To get past hCaptcha, you will need to add a `.env` file in /engine and specifiy a key `OPENAI_API_KEY` with the corresponding openAI key, which has credits on.

