import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { isBot, isLinkUnfurler, isBotOrUnfurler } from '../middlewares/bot-detect.middleware';

/**
 * Session 128.40 — bot/unfurler UA classifier unit test.
 *
 * Strategy: pinned, documented UA strings (one per family) → assert
 * isBot/isLinkUnfurler/isBotOrUnfurler return the expected boolean.
 * Plus 5 real-browser UAs from current Chrome/Safari/Firefox/Edge/iOS
 * Safari → must all return false (the failure mode to avoid: real users
 * incidentally getting the bot HTML).
 */

function reqWithUa(ua: string | undefined): Request {
  return { headers: { 'user-agent': ua } } as unknown as Request;
}

describe('isBot — known search/AI crawlers', () => {
  const cases: Array<[string, string]> = [
    ['googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
    ['slurp', 'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)'],
    ['duckduckbot', 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)'],
    ['baiduspider', 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)'],
    ['yandexbot', 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'],
    ['applebot', 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)'],
    ['gptbot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)'],
    ['chatgpt-user', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)'],
    ['claudebot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
    ['perplexitybot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'],
    ['ccbot', 'CCBot/2.0 (https://commoncrawl.org/faq/)'],
  ];

  it.each(cases)('isBot recognises %s', (_family, ua) => {
    expect(isBot(reqWithUa(ua))).toBe(true);
    expect(isBotOrUnfurler(reqWithUa(ua))).toBe(true);
  });
});

describe('isLinkUnfurler — chat/social link-preview fetchers', () => {
  const cases: Array<[string, string]> = [
    ['whatsapp', 'WhatsApp/2.23.20.0'],
    ['slackbot', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
    ['twitterbot', 'Twitterbot/1.0'],
    ['telegrambot', 'TelegramBot (like TwitterBot)'],
    ['discordbot', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'],
    ['facebookexternalhit', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['linkedinbot', 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1 +http://www.linkedin.com)'],
  ];

  it.each(cases)('isLinkUnfurler recognises %s', (_family, ua) => {
    expect(isLinkUnfurler(reqWithUa(ua))).toBe(true);
    expect(isBotOrUnfurler(reqWithUa(ua))).toBe(true);
    // Cross-check: a unfurler should NOT trip the search-bot path.
    expect(isBot(reqWithUa(ua))).toBe(false);
  });
});

describe('Real browser UAs must NEVER match', () => {
  const browsers: Array<[string, string]> = [
    ['Chrome 132 macOS', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'],
    ['Safari 18 macOS', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'],
    ['Firefox 135 Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'],
    ['iOS Safari 18', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'],
    ['Android Chrome 132', 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'],
  ];

  it.each(browsers)('isBotOrUnfurler returns false for %s', (_label, ua) => {
    const r = reqWithUa(ua);
    expect(isBot(r)).toBe(false);
    expect(isLinkUnfurler(r)).toBe(false);
    expect(isBotOrUnfurler(r)).toBe(false);
  });
});

describe('Edge cases', () => {
  it('missing UA → false (no header, no match)', () => {
    const r = reqWithUa(undefined);
    expect(isBot(r)).toBe(false);
    expect(isLinkUnfurler(r)).toBe(false);
    expect(isBotOrUnfurler(r)).toBe(false);
  });

  it('empty UA → false', () => {
    const r = reqWithUa('');
    expect(isBotOrUnfurler(r)).toBe(false);
  });

  it('case-insensitive — uppercase WHATSAPP/2.0 still matches', () => {
    expect(isLinkUnfurler(reqWithUa('WHATSAPP/2.23.20.0'))).toBe(true);
  });
});
