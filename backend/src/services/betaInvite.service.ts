function parseBetaInviteCodes(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,\n]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

export function isBetaRegistrationOpen(): boolean {
  return process.env.BETA_REGISTRATION_OPEN === 'true';
}

export function assertValidBetaInviteCode(codeRaw: string): string {
  const code = codeRaw.trim().toUpperCase();
  if (!code) {
    throw new Error('Beta invite code is required.');
  }

  const allowed = parseBetaInviteCodes(process.env.BETA_INVITE_CODES);
  if (allowed.length === 0) {
    throw new Error('Beta registration is not open yet.');
  }

  if (!allowed.includes(code)) {
    throw new Error('That beta invite code is not recognized.');
  }

  return code;
}

export function validateBetaInviteCode(codeRaw: string) {
  const code = assertValidBetaInviteCode(codeRaw);
  const registrationOpen = isBetaRegistrationOpen();

  return {
    valid: true,
    code,
    registration_open: registrationOpen,
    message: registrationOpen
      ? undefined
      : "You're selected for beta. Account creation isn't open yet — we'll email you when your code can be used.",
  };
}
