import { loadConfig, universe, type SupplyRecord } from "./config.js";
import { latestFilingText } from "./sec.js";
import type { SupplyLink } from "./types.js";

function fileLinks(ticker: string): SupplyLink[] {
  const symbol = ticker.toUpperCase();
  const links = loadConfig().supplyLinks;
  const related: SupplyLink[] = [];
  for (const link of links) {
    if (link.ticker === symbol) {
      related.push({ ticker: link.related, source: link.source, confidence: link.confidence });
    } else if (link.related === symbol) {
      related.push({ ticker: link.ticker, source: link.source, confidence: link.confidence });
    }
  }
  return related;
}

export function curatedLinks(ticker: string): SupplyLink[] {
  return fileLinks(ticker);
}

export function statedMentions(text: string, ticker: string): string[] {
  const symbol = ticker.toUpperCase();
  const names = new Set<string>([...universe(), ...loadConfig().supplyLinks.flatMap((link) => [link.ticker, link.related])]);
  names.delete(symbol);
  const found: string[] = [];
  for (const name of names) {
    const pattern = new RegExp(`\\b${name.replace(/[.]/g, "\\.")}\\b`);
    if (pattern.test(text) && !found.includes(name)) found.push(name);
  }
  return found;
}

export function mergeLinks(base: SupplyLink[], mentioned: string[]): SupplyLink[] {
  const links = base.map((link) => ({ ...link }));
  for (const name of mentioned) {
    const existing = links.find((link) => link.ticker === name);
    if (existing) {
      existing.source = "stated";
      existing.confidence = Math.max(existing.confidence, 0.55);
    } else {
      links.push({ ticker: name, source: "stated", confidence: 0.5 });
    }
  }
  return links.sort((a, b) => a.ticker.localeCompare(b.ticker) || a.source.localeCompare(b.source));
}

export async function supplyFor(ticker: string): Promise<SupplyLink[]> {
  const base = fileLinks(ticker);
  try {
    const text = await latestFilingText(ticker);
    if (!text) return mergeLinks(base, []);
    return mergeLinks(base, statedMentions(text, ticker));
  } catch {
    return mergeLinks(base, []);
  }
}

export function records(): SupplyRecord[] {
  return loadConfig().supplyLinks;
}
