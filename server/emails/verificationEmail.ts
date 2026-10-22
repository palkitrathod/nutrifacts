import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MailMessage } from '../mailer';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const SANS = "'Segoe UI', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

const COPY = {
  signup: {
    subject: 'Verify your email address',
    preview: 'Use this code to finish creating your Nutrifacts account.',
    heading: 'Welcome to Nutrifacts',
    intro: "You're one step away from personalised diet plans, progress tracking and consultations with Dt. Anchal.",
    ask: 'Use this code to verify your email address:',
    ignore: "If you didn't create a Nutrifacts account, you can ignore this email.",
  },
  email_change: {
    subject: 'Confirm your new email address',
    preview: 'Use this code to confirm the new email address for your Nutrifacts account.',
    heading: 'Confirm your new email',
    intro: 'You asked to use this address for your Nutrifacts account.',
    ask: 'Use this code to confirm your new email address:',
    ignore: "If you didn't ask for this, you can ignore this email. Nothing changes until the code is entered.",
  },
};

/** Verification-code email. The code appears only in the body, never in the subject or inbox preview. */
export function verificationEmail(opts: {
  to: string;
  name: string;
  code: string;
  expiresInMinutes: number;
  purpose?: keyof typeof COPY;
}): MailMessage {
  const { to, code, expiresInMinutes } = opts;
  const copy = COPY[opts.purpose ?? 'signup'];
  const firstName = opts.name.trim().split(/\s+/)[0] || 'there';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F5;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${copy.preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6F5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;background:#FFFFFF;border:1px solid #E3E8E5;border-radius:12px;">
          <tr>
            <td style="line-height:0;font-size:0;">
              <img src="cid:nf-header" width="520" alt="A fresh, balanced meal bowl" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:12px 12px 0 0;">
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0 32px;font-family:${SANS};font-size:15px;line-height:1.6;color:#334155;">
              <div style="font-family:${SERIF};font-size:22px;font-weight:700;color:#2D4C3C;padding-bottom:14px;">${copy.heading}</div>
              <p style="margin:0 0 12px 0;">Hi ${escapeHtml(firstName)},</p>
              <p style="margin:0;">${copy.intro} ${copy.ask}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px;">
              <div style="display:inline-block;padding:14px 24px;background:#F2F7F4;border-radius:8px;font-family:'Courier New', Courier, monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#2D4C3C;white-space:nowrap;">${code}</div>
              <div style="padding-top:10px;font-family:${SANS};font-size:13px;color:#64748B;">This code expires in ${expiresInMinutes} minutes.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;"><div style="height:1px;background:#E3E8E5;line-height:1px;font-size:0;">&nbsp;</div></td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="56" valign="middle" style="width:56px;">
                    <img src="cid:nf-dietitian" width="56" height="56" alt="Dt. Anchal Dewan" style="display:block;width:56px;height:56px;border-radius:28px;border:0;">
                  </td>
                  <td valign="middle" style="padding-left:14px;font-family:${SANS};font-size:14px;line-height:1.5;color:#334155;">
                    Looking forward to working with you.<br>
                    <strong style="color:#2D4C3C;">Dt. Anchal Dewan</strong>
                    <span style="color:#64748B;font-size:13px;"> · Clinical Nutritionist</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;max-width:520px;font-family:${SANS};font-size:12px;line-height:1.6;color:#94A3B8;">
          ${copy.ignore}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${firstName},`,
    '',
    copy.intro,
    '',
    `${copy.ask} ${code}`,
    `This code expires in ${expiresInMinutes} minutes.`,
    '',
    'Looking forward to working with you.',
    'Dt. Anchal Dewan, Clinical Nutritionist',
    '',
    copy.ignore,
  ].join('\n');

  return {
    to,
    subject: copy.subject,
    html,
    text,
    attachments: [
      { filename: 'nutrifacts.jpg', path: path.join(ASSETS, 'header.jpg'), cid: 'nf-header' },
      { filename: 'dt-anchal.jpg', path: path.join(ASSETS, 'dietitian.jpg'), cid: 'nf-dietitian' },
    ],
  };
}
