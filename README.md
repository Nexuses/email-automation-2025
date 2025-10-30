SIS Tech Email Automation

Environment variables required to send emails (create `.env.local`):

```
SMTP_HOST=smtp.yourhost.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

Usage:
- Upload the Excel with columns `Client`, `ClientEmailId`, `SisRepresentativeEmail` and the SaaS PDF.
- Enter the sender email (Shreya’s email), confirm the subject, choose Dry run to preview or uncheck to send.
- On send, each email goes to the customer. CC is now picked per-row from the sheet using the `SisRepresentativeEmail` column (if present).
- Dry-run shows the per-email CC list and an HTML preview of the email body so you can verify content before sending.

Additional notes:
- There is no global CC override; CCs are only derived from the `SisRepresentativeEmail` column of each row.
- Emails are sent in batches (default 50) with a 5-minute delay between batches. Configure via env:

```
# optional
BATCH_SIZE=50
BATCH_DELAY_MINUTES=5
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

Use any Node hosting. Ensure `.env` vars are set. Then build and start:

```bash
npm run build
npm start
```
