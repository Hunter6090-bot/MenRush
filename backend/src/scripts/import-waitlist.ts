import fs from 'fs';
import path from 'path';
import pool from '../db';
import { subscribeToWaitlist, runDripBatch } from '../services/drip.service';

interface ImportArgs {
  csvPath: string;
  source: string;
  autoSend: boolean;
  limit: number;
}

function parseArgs(argv: string[]): ImportArgs {
  const args = argv.slice(2);
  let csvPath = '';
  let source = 'zoho-import';
  let autoSend = false;
  let limit = 500;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--csv') {
      csvPath = args[i + 1] || '';
      i += 1;
    } else if (arg === '--source') {
      source = args[i + 1] || source;
      i += 1;
    } else if (arg === '--send-now') {
      autoSend = true;
    } else if (arg === '--limit') {
      const parsed = parseInt(args[i + 1] || '', 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
      i += 1;
    }
  }

  if (!csvPath) {
    throw new Error(
      'Missing --csv <path>. Example: npm run waitlist:import -- --csv /tmp/waitlist.csv --send-now',
    );
  }

  return { csvPath, source, autoSend, limit };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function stripCell(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"').trim();
  }
  return trimmed;
}

async function main() {
  const { csvPath, source, autoSend, limit } = parseArgs(process.argv);
  const absolutePath = path.resolve(csvPath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const emailIndex = headers.findIndex((header) => header === 'email' || header === 'emailaddress');
  if (emailIndex === -1) {
    throw new Error('Could not find an Email column in the CSV header.');
  }

  let imported = 0;
  let alreadySubscribed = 0;
  let invalid = 0;

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line).map(stripCell);
    const email = (cells[emailIndex] || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalid += 1;
      continue;
    }

    const result = await subscribeToWaitlist(email, source);
    if (result.alreadySubscribed) {
      alreadySubscribed += 1;
    } else {
      imported += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        csv: absolutePath,
        source,
        imported,
        already_subscribed: alreadySubscribed,
        invalid_rows: invalid,
      },
      null,
      2,
    ),
  );

  if (autoSend) {
    const batch = await runDripBatch(limit);
    console.log(JSON.stringify({ send_now: true, batch }, null, 2));
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end().finally(() => process.exit(1));
  });
