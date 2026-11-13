import type { Sentiment, SentimentSource } from "./types.js";
import { localChat } from "./local-chat.js";

const POSITIVE = [
  "beat",
  "beats",
  "growth",
  "record",
  "surge",
  "rally",
  "upgrade",
  "strong",
  "gain",
  "gains",
  "profit",
  "bullish",
  "outperform",
];
const NEGATIVE = [
  "miss",
  "misses",
  "fall",
  "falls",
  "drop",
  "drops",
  "cut",
  "cuts",
  "downgrade",
  "weak",
  "loss",
  "losses",
  "bearish",
  "lawsuit",
  "probe",
  "decline",
  "warning",
];

export function scoreText(text: string): number {
  const words = text.toLowerCase().split(/[^a-z]+/);
  let positive = 0;
  let negative = 0;
  for (const word of words) {
    if (POSITIVE.includes(word)) positive += 1;
    if (NEGATIVE.includes(word)) negative += 1;
  }
  const total = positive + negative;
  if (total === 0) return 0;
  return Math.max(-1, Math.min(1, (positive - negative) / total));
}

function noteFor(score: number, count: number, source: SentimentSource): string {
  if (count < 2) return `sparse ${source}`;
  if (score <= -0.4) return `extreme negative ${source}`;
  if (score >= 0.4) return `extreme positive ${source}`;
  return `mixed ${source}`;
}

function titlesFromRss(xml: string): string[] {
  return [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((title) => title && title !== "Yahoo! Finance: RSS");
}

export async function headlineTexts(ticker: string): Promise<string[]> {
  const response = await fetch(
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`,
    { headers: { "user-agent": "SSA-Desk/0.1 (research)" }, signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) return [];
  return titlesFromRss(await response.text()).slice(0, 12);
}

async function xTexts(ticker: string): Promise<string[] | null> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return null;
  const query = new URLSearchParams({
    query: `${ticker} lang:en -is:retweet`,
    max_results: "10",
    "tweet.fields": "text",
  });
  const response = await fetch(`https://api.x.com/2/tweets/search/recent?${query.toString()}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: Array<{ text?: string }> };
  const texts = (body.data ?? []).map((row) => row.text ?? "").filter(Boolean);
  return texts.length > 0 ? texts : null;
}

export async function sentimentFor(ticker: string): Promise<Sentiment & { localRoute: string }> {
  let texts: string[] = [];
  let source: SentimentSource = "headlines";
  const posts = await xTexts(ticker).catch(() => null);
  if (posts && posts.length > 0) {
    texts = posts;
    source = "x";
  } else {
    texts = await headlineTexts(ticker).catch(() => []);
  }
  const score = scoreText(texts.join(" "));
  let volatilityNote = noteFor(score, texts.length, source);
  let localRoute = "commercial";
  if (process.env.MODEL_ROUTE === "local" && process.env.LOCAL_OPENAI_BASE_URL) {
    localRoute = "local-unreached";
    const draft = await localChat(
      "Classify the headlines. Reply with one JSON object {\"score\": number between -1 and 1} and no other numbers.",
      texts.join("\n").slice(0, 2000),
    ).catch(() => null);
    if (draft) {
      localRoute = "local";
      const match = draft.match(/-?\d+(?:\.\d+)?/);
      const drafted = match ? Number(match[0]) : null;
      if (drafted !== null && Math.abs(drafted - score) <= 0.15) {
        volatilityNote = `${volatilityNote}; local classification agrees`;
      }
    }
  }
  return {
    score: Math.round(score * 1000) / 1000,
    source,
    volatilityNote,
    localRoute,
  };
}

export function sentimentFromTexts(texts: string[], source: SentimentSource): Sentiment {
  const score = scoreText(texts.join(" "));
  return {
    score: Math.round(score * 1000) / 1000,
    source,
    volatilityNote: noteFor(score, texts.length, source),
  };
}
