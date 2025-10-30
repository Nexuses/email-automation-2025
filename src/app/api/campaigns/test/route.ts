import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

function buildHtmlEmail(pitch: string): string {
  let out = pitch || '';
  if (out.includes('<') && out.includes('>')) {
    out = out
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/class="[^"]*"/gi, '')
      .replace(/<font[^>]*>/gi, '')
      .replace(/<\/font>/gi, '')
      .replace(/<span[^>]*>/gi, '')
      .replace(/<\/span>/gi, '');
    out = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${out}</div>`;
  } else {
    out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = out.split('\n');
    const processed: string[] = [];
    let inList = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (line === '') {
        if (inList) {
          processed.push('</ul>');
          inList = false;
        }
        processed.push('<br>');
        continue;
      }
      const bullet = line.match(/^[\s]*[•\-\*\+]\s+(.+)$/);
      if (bullet) {
        if (!inList) {
          inList = true;
          processed.push('<ul style="margin: 8px 0; padding-left: 20px;">');
        }
        processed.push(`<li style="margin: 4px 0;">${bullet[1]}</li>`);
      } else {
        if (inList) {
          processed.push('</ul>');
          inList = false;
        }
        processed.push(`<p style="margin: 8px 0;">${line}</p>`);
      }
    }
    if (inList) processed.push('</ul>');
    out = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${processed.join('')}</div>`;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toEmail, senderName, senderEmail, subject, pitch, pdfBase64 } = body || {};

    if (!toEmail || !senderName || !senderEmail || !subject || !pitch) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const smtpHost = process.env.SMTP_HOST || '';
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({ error: 'SMTP environment variables not configured' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const html = buildHtmlEmail(pitch);

    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: toEmail,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, ''),
      attachments: pdfBase64
        ? [{ filename: 'attachment.pdf', content: Buffer.from(pdfBase64, 'base64') }]
        : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Send test failed:', e);
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}
