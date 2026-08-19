# LEGITIFY 🛡️
**Evidence-Based Recruitment & Internship Trust Intelligence Platform**

LEGITIFY is a production-quality, student-focused trust verification platform designed to evaluate internship offers, recruiter emails, companies, domains, websites, certificates, and employment documents for authenticity and fraud risk.

---

## 🌟 Key Features

1. **Multi-Factor Trust Verification**:
   - **Company Registry**: Normalization and corporate verification (CIN, GST, official company entities).
   - **Domain Intelligence**: DNS resolution, ICANN RDAP domain age, SSL/TLS certificate inspection, typosquatting & brand lookalike detection.
   - **Recruiter Authenticity**: Sender vs company domain alignment, public free webmail detection (`@gmail.com` vs corporate handles), SPF/DKIM/DMARC status.
   - **Document & Offer Analysis**: Text extraction for PDFs, images, EMLs, and pasted offer letters; regex fee detection (upfront training fees, security deposits, UPI payment handles).
   - **Threat Feeds & IOC Matching**: VirusTotal, AbuseIPDB, Google Safe Browsing, and fraud heuristic pattern matching.
2. **Transparent Deterministic Scoring**:
   - 7-dimension weighted model (Company 25%, Domain 15%, Recruiter 15%, Document 15%, Threat 15%, Public Evidence 10%, Consistency 5%).
   - Separate **Confidence Score** (0–100%) and **Risk Level** (Very Low, Low, Moderate, High, Critical).
   - Definite verdicts: `LIKELY LEGITIMATE`, `LOW RISK`, `MODERATE RISK`, `HIGH RISK`, `LIKELY SCAM`, `INSUFFICIENT EVIDENCE`.
3. **Zero-Hallucination AI Synthesis**:
   - Google Gemini 1.5 Flash server-side integration.
   - Strict anti-hallucination prompt rules (reasons strictly from supplied factual evidence).
   - Prompt-injection defense: User-supplied documents are wrapped in `<UNTRUSTED_EVIDENCE>` tags.
   - Deterministic fallback report when AI or external providers are offline.
4. **Secure Authentication & Privacy**:
   - Supabase Auth with Google OAuth + Email/Password registration.
   - PostgreSQL Row Level Security (RLS) ensuring private documents are accessible only to the owner.
   - Shared sanitized company intelligence cache (speeds up repeat searches without exposing private documents).
5. **Reporting & Sharing**:
   - Client-side branded PDF export via `jsPDF`.
   - Cryptographically secure tokenized public report sharing (`/shared-report/:token`).
   - Interactive AI Copilot for report-specific questions.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts, Lucide Icons, Framer Motion.
- **Backend API**: Node.js, Express, Multer, Zod.
- **Database & Auth**: Supabase PostgreSQL with RLS, Supabase Auth (Google OAuth + Email).
- **AI Synthesis**: Google Gemini 1.5 Flash API (Server-side).
- **Security Feeds**: VirusTotal, AbuseIPDB, Google Safe Browsing, ICANN RDAP, Authoritative DNS.
- **Build & Deploy**: Vite, Vercel.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the template file `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your API keys in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

### 4. Run the Application
Start both the backend API server and Vite client concurrently:
```bash
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## 🧪 Running Tests & Demo Seed

### Run Automated Unit Tests
```bash
npm test
```

### Seed Synthetic Demo Threat Indicators
```bash
npm run seed
```

---

## 📦 Production Build & Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel
1. Push repository to GitHub or GitLab.
2. Import project into Vercel.
3. Configure the environment variables in Vercel Project Settings.
4. Deploy!

---

## 🔒 Security & Privacy Notice
LEGITIFY provides an automated evidence-based risk analysis to support applicant decision-making. It is not a legal determination, guarantee of employment legitimacy, or definitive proof of fraudulent intent.