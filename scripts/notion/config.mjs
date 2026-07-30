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
  control: {
    name: 'Controle de Questões TDAS',
    databaseUrl: 'https://app.notion.com/p/7ef15150d39b4215816b9d318fc88fa3?v=363cf5a267318175ad3c000c50ff353b',
    dataSourceId: process.env.NOTION_CONTROL_DATA_SOURCE_ID || 'c8026b97-34bc-4bb9-98ce-6fd8290c9337'
  },
  errors: {
    name: 'Caderno de Erros TDAS / PRO',
    databaseUrl: 'https://app.notion.com/p/fabd0f60bdb84327bd83d99dc9a40374?v=575d735c37e647508dcc3e944ea56f1e',
    dataSourceId: process.env.NOTION_ERRORS_DATA_SOURCE_ID || 'd973bca7-5aad-480a-9ea0-067d89d18dc1'
  },
  redactions: {
    name: 'Banco de Redações TDAS',
    databaseUrl: 'https://app.notion.com/p/9b628a5313c646d8aa57576baa459bdb?v=363cf5a26731816e93d8000c0d7ba2f0',
    dataSourceId: process.env.NOTION_REDACTIONS_DATA_SOURCE_ID || 'a3a4763e-3df0-4adb-aef6-8d31e4990a77'
  }
};

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const compact = value => norm(value).replace(/[^a-z0-9]+/g, '');
export const round = (number, digits = 2) => Number.isFinite(number) ? Number(number.toFixed(digits)) : 0;
export const slugify = value => norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const sourceList = () => Object.values(SOURCES).map(source => ({ name: source.name, url: source.databaseUrl }));

export function localDate(iso = new Date().toISOString()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(iso));
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function localDateTime(iso = new Date().toISOString()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(iso));
}


export function localIso(iso = new Date().toISOString()) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-03:00`;
}

export function weeksBetween(start, end) {
  return Math.max(0, (new Date(`${end}T12:00:00-03:00`) - new Date(`${start}T12:00:00-03:00`)) / 604800000);
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJson(file, value) {
  const target = path.join(ROOT, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value)}\n`, 'utf8');
}

export async function writeText(file, value) {
  const target = path.join(ROOT, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, value, 'utf8');
}
