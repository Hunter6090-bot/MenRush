# OpenClaw MenRush Ops

## Current status

- OpenClaw runtime is updated and healthy enough to load plugins.
- `@openclaw/codex` is installed.
- MenRush is **not fully automated yet** because two operator blockers remain:
  - model auth for `openai-codex:default` is expired
  - no `commands.ownerAllowFrom` is configured

## Fix next

1. Re-auth Codex model access:
   - `openclaw models auth login --provider openai-codex`
2. Set the command owner:
   - `openclaw config set commands.ownerAllowFrom '["telegram:YOUR_ID"]'`
3. If Telegram group posting will be used, either:
   - add approved sender ids to `channels.telegram.groupAllowFrom`
   - or set `channels.telegram.groupPolicy` to `open`
4. If you want your existing Codex skills available inside OpenClaw agents:
   - `openclaw migrate codex --dry-run`

## Recommended MenRush automations

### 1. Waitlist health

- Frequency: every 30 minutes
- Purpose: check new signups, import drift, and drip send failures
- Output:
  - new signup count
  - due welcome emails
  - failed or delayed sends
  - resend delivery events worth checking

### 2. Social draft queue

- Frequency: every morning at 08:00 Europe/London
- Purpose: generate today's X, Instagram, and TikTok draft set
- Output:
  - one post per channel
  - one story prompt
  - one CTA variation
  - one founder reply bank for comments and DMs

### 3. Founder radar

- Frequency: every day at 18:00 Europe/London
- Purpose: summarize launch momentum
- Output:
  - waitlist total
  - today's signups
  - best performing post
  - comments and DMs needing reply
  - tomorrow's top recommendation

## Approval model to start with

- Draft automatically
- Human approve before publish
- Auto-post only after 5 to 7 days of stable results

This is the safest way to build momentum without letting the account go off-tone.
