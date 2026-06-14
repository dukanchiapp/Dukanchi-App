import type { Request } from 'express';

/**
 * Session 128.40 — User-Agent → bot/link-unfurler classification.
 *
 * Strategy: plain substring matching against pinned, documented lists. No
 * regex engines that could blow up under crafted input; no maxmind-style
 * external lookups; just `ua.toLowerCase().includes(token)`.
 *
 * ── Source documentation for the UA lists ──
 * - Googlebot family:        https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
 * - Bingbot:                 https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0
 * - Yahoo Slurp + Yandex:    long-documented; substrings are the canonical UA tokens.
 * - DuckDuckBot:             https://duckduckgo.com/duckduckbot
 * - Baidu, Apple:            standard UA tokens, stable for >10 years.
 * - AI crawlers (GPT/Claude/etc):
 *   - GPTBot:                https://platform.openai.com/docs/gptbot
 *   - ChatGPT-User:          on-demand fetch by ChatGPT for user-triggered Q&A.
 *   - OAI-SearchBot:         https://platform.openai.com/docs/bots
 *   - ClaudeBot / anthropic-ai: https://docs.claude.com/en/docs/bots
 *   - CCBot (Common Crawl):  https://commoncrawl.org/ccbot
 *   - PerplexityBot:         https://docs.perplexity.ai/guides/bots
 *   - Google-Extended:       Google's AI-training opt-in token.
 *
 * - Link-unfurler family (do NOT execute JS even though some are modern):
 *   - WhatsApp:              https://developers.facebook.com/docs/whatsapp/sharing#link-previews
 *   - Slackbot:              https://api.slack.com/robots
 *   - Twitterbot:            https://developer.x.com/en/docs/twitter-for-websites/cards/overview/getting-started
 *   - Facebook external hit: https://developers.facebook.com/docs/sharing/webmasters/web-crawlers
 *   - LinkedInBot:           https://www.linkedin.com/help/linkedin/answer/a522714
 *   - TelegramBot:           https://telegram.org/blog/instant-view
 *   - DiscordBot, Skype, Reddit, Pinterest, LINE, Viber, embedly, vkShare:
 *     all standard UA tokens published in their developer docs.
 *
 * Lists are kept SHORT and AUTHORITATIVE. Add a new token only with the
 * publishing-vendor doc link in the comment; do not generalize via regex
 * (a bad regex here means every request gets the bot HTML — including real
 * users — which is the failure mode we MUST avoid).
 */

const BOT_UA_TOKENS: ReadonlyArray<string> = [
  // Search engines
  'googlebot',
  'bingbot',
  'slurp',          // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'applebot',
  // AI crawlers
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'claudebot',
  'anthropic-ai',
  'ccbot',
  'perplexitybot',
  'google-extended',
];

const LINK_UNFURLER_UA_TOKENS: ReadonlyArray<string> = [
  'whatsapp',
  'slackbot',
  'twitterbot',
  'telegrambot',
  'discordbot',
  'facebookexternalhit',
  'linkedinbot',
  'embedly',
  'redditbot',
  'skypeuripreview',
  'pinterest',
  'line/',          // LINE messenger; trailing "/" anchors to the canonical token boundary
  'vkshare',
  'viber',
];

function uaLower(req: Request): string {
  const ua = req.headers['user-agent'];
  if (typeof ua !== 'string') return '';
  return ua.toLowerCase();
}

/** True when the UA matches a documented search/AI crawler. Cheap to call. */
export function isBot(req: Request): boolean {
  const ua = uaLower(req);
  if (!ua) return false;
  for (const token of BOT_UA_TOKENS) {
    if (ua.includes(token)) return true;
  }
  return false;
}

/**
 * True when the UA is a chat/social link unfurler (WhatsApp, Slack, etc.).
 * These DO NOT execute JS even though some are modern — they need server-side
 * meta/OG tags to produce a rich link preview.
 */
export function isLinkUnfurler(req: Request): boolean {
  const ua = uaLower(req);
  if (!ua) return false;
  for (const token of LINK_UNFURLER_UA_TOKENS) {
    if (ua.includes(token)) return true;
  }
  return false;
}

/** Combined: either a search crawler or a link unfurler. The bot-render middleware uses this. */
export function isBotOrUnfurler(req: Request): boolean {
  return isBot(req) || isLinkUnfurler(req);
}
