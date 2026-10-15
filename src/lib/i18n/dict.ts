import { getLanguage, type Language } from ".";
import * as ai from "./messages/ai";
import * as analysis from "./messages/analysis";
import * as auth from "./messages/auth";
import * as common from "./messages/common";
import * as entry from "./messages/entry";
import * as fixed from "./messages/fixed";
import * as history from "./messages/history";
import * as home from "./messages/home";
import * as savings from "./messages/savings";
import * as server from "./messages/server";
import * as settings from "./messages/settings";
import * as wallet from "./messages/wallet";

// Each messages file holds one area's texts in both languages; `en` is typed as `typeof ja`,
// so a text missing from English fails the type check.
const ja = {
  common: common.ja,
  home: home.ja,
  entry: entry.ja,
  history: history.ja,
  analysis: analysis.ja,
  settings: settings.ja,
  savings: savings.ja,
  fixed: fixed.ja,
  ai: ai.ja,
  auth: auth.ja,
  server: server.ja,
  wallet: wallet.ja,
};

export type Dict = typeof ja;

const en: Dict = {
  common: common.en,
  home: home.en,
  entry: entry.en,
  history: history.en,
  analysis: analysis.en,
  settings: settings.en,
  savings: savings.en,
  fixed: fixed.en,
  ai: ai.en,
  auth: auth.en,
  server: server.en,
  wallet: wallet.en,
};

export const DICTS: Record<Language, Dict> = { ja, en };

/** Texts in the current display language, for code outside React. Components use useT(). */
export const dict = (): Dict => DICTS[getLanguage()];
