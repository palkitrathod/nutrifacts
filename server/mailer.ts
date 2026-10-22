import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

export interface MailAttachment {
  filename: string;
  path: string;
  /** Referenced from the HTML as `cid:<cid>` (inline image). */
  cid: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  /** true = TLS from the start (port 465); false = STARTTLS (port 587). */
  secure: boolean;
  user?: string;
  pass?: string;
  /** e.g. "Nutrifacts <no-reply@nutrifacts.in>" */
  from: string;
}

export function smtpMailer(config: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: config.from, ...message });
    },
  };
}

/**
 * No email service configured: each message is saved to `dir` as a viewable .html file (images
 * embedded) plus a .txt copy, and the subject is logged. For development and automated tests.
 */
export function outboxMailer(dir: string, log: (line: string) => void = console.log): Mailer {
  return {
    async send(message) {
      fs.mkdirSync(dir, { recursive: true });
      const base = `${Date.now()}-${message.to.replace(/[^a-z0-9@._-]/gi, '_')}`;
      let html = message.html;
      for (const a of message.attachments ?? []) {
        const data = fs.readFileSync(a.path).toString('base64');
        const type = path.extname(a.filename).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
        html = html.replaceAll(`cid:${a.cid}`, `data:${type};base64,${data}`);
      }
      fs.writeFileSync(path.join(dir, `${base}.html`), html);
      fs.writeFileSync(path.join(dir, `${base}.txt`), `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
      log(`[mail] "${message.subject}" to ${message.to} → saved in ${path.join(dir, `${base}.html`)}`);
    },
  };
}

/**
 * SMTP when SMTP_HOST is set, otherwise the outbox. MAIL_TRANSPORT=outbox forces the outbox even
 * when SMTP is configured (e.g. in .env), so automated tests can never email real addresses.
 */
export function mailerFromEnv(env: NodeJS.ProcessEnv, outboxDir: string): { mailer: Mailer; kind: 'smtp' | 'outbox' } {
  if (!env.SMTP_HOST || env.MAIL_TRANSPORT === 'outbox') return { mailer: outboxMailer(outboxDir), kind: 'outbox' };
  const port = Number(env.SMTP_PORT ?? 587);
  return {
    kind: 'smtp',
    mailer: smtpMailer({
      host: env.SMTP_HOST,
      port,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
      user: env.SMTP_USER || undefined,
      pass: env.SMTP_PASS || undefined,
      from: env.MAIL_FROM || `Nutrifacts <${env.SMTP_USER ?? 'no-reply@localhost'}>`,
    }),
  };
}
