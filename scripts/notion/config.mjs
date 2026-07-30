import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = process.cwd();
export const TOKEN = process.env.NOTION_TOKEN;
export const API_VERSION = '2026-03-11';
export const API_BASE = 'https://api.notion.com/v1';
export const EXAM_DATE = process.env.EXAM_DATE || '2026-09-06';
export const TIME_ZONE = 'America/Sao_Paulo';
export const SOURCES = {
  control: { name: 'Controle de Questões TDAS', databaseUrl: 'https://app.notion.com/p/7ef15150d39b4215816b9d318fc88fa3', dataSourceId: process.env.NOTION_CONTROL_DATA_SOURCE_ID || 'c8026b97-34bc-4bb9-98ce-6fd8290c9337' },
  errors: { name: 'Caderno de Erros TDAS / PRO', databaseUrl: 'https://app.notion.com/p/fabd0f60bdb84327bd83d99dc9a40374', dataSourceId: process.env.NOTION_ERRORS_DATA_SOURCE_ID || 'd973bca7-5aad-480a-9ea0-067d89d18dc1' },
  redactions: { name: 'Banco de Redações TDAS', databaseUrl: 'https://app.notion.com/p/9b628a5313c646d8aa57576baa459bdb', dataSourceId: process.env.NOTION_REDACTIONS_DATA_SOURCE_ID || 'a3a4763e-3df0-4adb-aef6-8d31e4990a77' }
};

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const compact = v => norm(v).replace(/[^a-z0-9]+/g, '');
export const round = (n, d = 2) => Number.isFinite(n) ? Number(n.toFixed(d)) : 0;
export const slugify = v => norm(v).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const hash = v => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
export const sourceList = () => Object.values(SOURCES).map(x => ({ name: x.name, url: x.databaseUrl }));

export function localDate(iso = new Date().toISOString()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = t => parts.find(p => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function weeksBetween(a, b) { return Math.max(0, (new Date(`${b}T12:00:00-03:00`) - new Date(`${a}T12:00:00-03:00`)) / 604800000); }
export async function readJson(file, fallback = null) { try { return JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8')); } catch { return fallback; } }
export async function writeJson(file, value) { const target = path.join(ROOT, file); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, `${JSON.stringify(value)}\n`, 'utf8'); }
