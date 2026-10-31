# Tournament Web

Frontend for the standalone tournament module. It has two parts:

- **Public site** (`/`, `/t/<slug>`, `/verify`): published tournaments, live brackets, medal tables, certificate download and verification.
- **Organiser area** (`/login`, `/admin`): create tournaments, register students, assign referees, draw and score, conclude, print certificates, and publish.

Stack: Next.js 16 (App Router), React 19, Tailwind CSS 4, lucide-react.

## Setup

```bash
cp .env.example .env.local    # NEXT_PUBLIC_API_URL → the Tnja-backend API, e.g. http://localhost:9100/api
npm install
npm run dev                   # http://localhost:3100
```

Production: `npm run build && npm start`. `NEXT_PUBLIC_API_URL` is baked in at build time, so set it
(e.g. in `.env.production`) before building.

## Organiser workflow

1. **Create** a tournament (draft, visible only to you).
2. **Students** tab: register students (pick from the master list or add new). The age group and weight class are filled in automatically; take the fee with Razorpay or mark it paid.
3. **Referees** tab: assign referees and officials with role and mat.
4. **Draws & Matches**: generate a draw per category (or all at once), then click a match to record the result. Winners move on automatically.
5. **Results & Certificates**: check or adjust medals, conclude each category, view / download certificates one by one, per category, or all in one PDF.
6. **Publish**: publish the tournament page, then publish results so athletes can download and verify certificates.

Organisation name, logo and certificate signatories are set in **Settings**.
