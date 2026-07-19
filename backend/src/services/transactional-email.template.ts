/**
 * Branded MenRush transactional email shell — matches waitlist/drip assets
 * (dark copper palette, logo header, table-based layout for email clients).
 */

export type TransactionalEmailOptions = {
  title: string;
  preheader: string;
  eyebrow?: string;
  headlineHtml: string;
  subheadline?: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  footerNote?: string;
};

export function transactionalParagraph(html: string, centered = false): string {
  const align = centered ? 'center' : 'left';
  return `<p style="margin:0 0 20px 0; font-family:Helvetica,Arial,sans-serif; font-size:16px; line-height:1.7; color:#C4A878; text-align:${align};">${html}</p>`;
}

export function buildTransactionalEmail(options: TransactionalEmailOptions): string {
  const {
    title,
    preheader,
    eyebrow = 'MenRush',
    headlineHtml,
    subheadline,
    bodyHtml,
    ctaUrl,
    ctaLabel,
    footerNote = 'You received this because of activity on your MenRush account.',
  } = options;

  const subheadlineBlock = subheadline
    ? `<p style="margin:0 0 28px 0; font-family:Helvetica,Arial,sans-serif; font-size:15px; line-height:1.6; color:#A89070;">${subheadline}</p>`
    : '';

  const ctaBlock =
    ctaUrl && ctaLabel
      ? `
          <tr>
            <td style="padding:8px 40px 0 40px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:14px; background:linear-gradient(135deg,#C4832A 0%,#8B4513 100%);">
                    <a href="${escapeAttr(ctaUrl)}" style="display:inline-block; padding:14px 28px; font-family:Helvetica,Arial,sans-serif; font-size:15px; font-weight:bold; color:#FFFFFF; text-decoration:none; border-radius:14px;">${escapeHtml(ctaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px 0 40px;">
              <p style="margin:0; font-family:Helvetica,Arial,sans-serif; font-size:12px; line-height:1.6; color:#7a6242; word-break:break-all;">
                Or copy this link: <a href="${escapeAttr(ctaUrl)}" style="color:#C4832A; text-decoration:underline;">${escapeHtml(ctaUrl)}</a>
              </p>
            </td>
          </tr>`
      : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <style>
    table, td, div, h1, p { font-family: Georgia, 'Times New Roman', serif; }
  </style>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#1a1208; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1208; padding:40px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#1a1208;">
          <tr>
            <td style="padding:30px 40px 25px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:18px;">
                    <img src="https://menrush.com/menrush-logo.png" width="60" height="60" alt="MenRush" style="display:block; width:60px; height:60px; border-radius:50%; border:0;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family:Georgia,'Times New Roman',serif; font-size:32px; font-weight:bold; letter-spacing:6px; color:#F0E0C0;">MENRUSH</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #C4832A; height:1px; line-height:1px; font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 0 40px;">
              <p style="margin:0 0 14px 0; font-family:Helvetica,Arial,sans-serif; font-size:13px; font-weight:bold; letter-spacing:3px; color:#C4832A; text-transform:uppercase;">
                ${escapeHtml(eyebrow)}
              </p>
              <h1 style="margin:0 0 20px 0; font-family:Georgia,'Times New Roman',serif; font-size:42px; font-weight:bold; line-height:1.1; color:#F0E0C0;">
                ${headlineHtml}
              </h1>
              ${subheadlineBlock}
              ${bodyHtml}
            </td>
          </tr>
          ${ctaBlock}
          <tr>
            <td style="padding:38px 40px 0 40px;">
              <div style="border-top:1px solid #3a2a14; height:1px; line-height:1px; font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 40px 32px 40px; font-family:Helvetica,Arial,sans-serif; color:#C4A878; font-size:15px; line-height:1.6;">
              <p style="margin:0 0 8px 0; font-weight:bold; color:#F0E0C0;">MenRush</p>
              <p style="margin:0;"><a href="mailto:hello@menrush.com" style="color:#C4832A; text-decoration:none;">hello@menrush.com</a></p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0D0A06; padding:22px 40px; text-align:center; font-family:Helvetica,Arial,sans-serif; font-size:12px; line-height:1.6; color:#7a6242;">
              ${escapeHtml(footerNote)}<br/>
              <a href="https://menrush.com" style="color:#7a6242; text-decoration:underline;">menrush.com</a>
              ·
              <a href="https://menrush.com/privacy" style="color:#7a6242; text-decoration:underline;">Privacy</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
