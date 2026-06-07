/**
 * apps/web/src/i18n/messages-coverage.test.ts
 *
 * I-606 — pseudo-locale layout test.
 *
 * Loads every locale file (en, vi, ja, en-XA) and asserts:
 *   1. Same key set across all locales (no missing or extra keys).
 *   2. en-XA wraps every value with `[!! ... !!]` so a visual test
 *      would catch untranslated text leaking through.
 *   3. Every value is a non-empty string.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MESSAGES_DIR = resolve(__dirname, "../messages");
const LOCALES = ["en", "vi", "ja", "en-XA"] as const;

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("_")) continue; // comment key
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out[key] = v;
    } else if (v && typeof v === "object") {
      Object.assign(out, flatten(v as Json, key));
    }
  }
  return out;
}

function load(locale: string): Record<string, string> {
  const path = resolve(MESSAGES_DIR, `${locale}.json`);
  const raw = readFileSync(path, "utf8");
  return flatten(JSON.parse(raw) as Json);
}

describe("i18n messages coverage", () => {
  const en = load("en");
  const enKeys = Object.keys(en).sort();

  it("has the 4 supported locales", () => {
    expect(LOCALES).toEqual(["en", "vi", "ja", "en-XA"]);
  });

  for (const locale of LOCALES) {
    it(`${locale} has the same key set as en`, () => {
      const keys = Object.keys(load(locale)).sort();
      expect(keys).toEqual(enKeys);
    });

    it(`${locale} has non-empty string values for every key`, () => {
      const map = load(locale);
      for (const [k, v] of Object.entries(map)) {
        expect(v, `${locale}:${k} empty`).toBeTruthy();
        expect(typeof v).toBe("string");
      }
    });
  }

  it("en-XA wraps every value with [!! ... !!]", () => {
    const xa = load("en-XA");
    for (const [k, v] of Object.entries(xa)) {
      // Placeholders like {count} are allowed in the middle
      expect(v.startsWith("[!! "), `${k} should start with [!! `).toBe(true);
      expect(v.endsWith(" !!]"), `${k} should end with !!]`).toBe(true);
    }
  });
});
