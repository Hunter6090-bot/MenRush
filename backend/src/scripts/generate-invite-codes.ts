import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pool from '../db';
import { inviteCodeService } from '../services/invite-code.service';

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const count = Number(readArg('count') ?? '100');
  const maxUses = Number(readArg('max-uses') ?? '1');
  const expiresInDays = Number(readArg('expires-in-days') ?? '90');
  const note = readArg('note') ?? 'beta-batch';
  const outPath = readArg('out');

  if (!Number.isFinite(count) || count < 1) {
    throw new Error('Invalid --count');
  }

  const codes = await inviteCodeService.generateBatch({
    count,
    maxUses: Number.isFinite(maxUses) ? maxUses : 1,
    expiresInDays: Number.isFinite(expiresInDays) ? expiresInDays : 90,
    note,
  });

  const lines = codes.map((row) => row.code);
  console.log(`Generated ${lines.length} invite code(s).`);

  if (outPath) {
    const resolved = path.resolve(outPath);
    fs.writeFileSync(resolved, `${lines.join('\n')}\n`, 'utf8');
    console.log(`Wrote ${resolved}`);
  } else {
    for (const code of lines) {
      console.log(code);
    }
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end().finally(() => process.exit(1));
  });
