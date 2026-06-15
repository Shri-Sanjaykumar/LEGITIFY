export const APP_NAME = "LEGITIFY";
export const APP_TAGLINE = "Verify Before You Trust";
export const APP_DESCRIPTION =
  "AI-powered trust intelligence platform that verifies internships, jobs, recruiters, companies, and offer letters before you make decisions.";

export const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Scan", href: "/scan" },
  { label: "About", href: "#about" },
] as const;

export const FEATURES = [
  {
    icon: "FileText",
    title: "Document Verification",
    description:
      "Upload offer letters, PDFs, and documents. Our AI extracts, analyzes, and cross-references every claim against verified databases.",
  },
  {
    icon: "Globe",
    title: "Domain Intelligence",
    description:
      "Deep WHOIS analysis, SSL verification, domain age tracking, and DNS record inspection to detect fraudulent or newly created websites.",
  },
  {
    icon: "Building2",
    title: "Company Verification",
    description:
      "Real-time MCA/ROC registry checks, CIN verification, GST validation, and incorporation date cross-referencing against government databases.",
  },
  {
    icon: "UserCheck",
    title: "Recruiter Verification",
    description:
      "LinkedIn profile analysis, employment history validation, professional network assessment, and identity cross-referencing.",
  },
  {
    icon: "MessageSquare",
    title: "Community Intelligence",
    description:
      "Aggregated reputation analysis from Reddit, Glassdoor, Quora, and professional forums with AI-powered sentiment scoring.",
  },
  {
    icon: "Shield",
    title: "AI Investigation Reports",
    description:
      "Comprehensive trust reports with explainable AI reasoning, evidence trails, confidence scores, and actionable recommendations.",
  },
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: "Upload or Paste",
    description: "Drop a PDF, paste a URL, share an email, or enter a LinkedIn profile. LEGITIFY accepts any input.",
    icon: "Upload",
  },
  {
    step: 2,
    title: "AI Investigates",
    description: "Multiple AI agents simultaneously verify the document, domain, company, recruiter, and community reputation.",
    icon: "Brain",
  },
  {
    step: 3,
    title: "Get Trust Report",
    description: "Receive a comprehensive trust score with evidence, risk breakdown, and clear recommendations within seconds.",
    icon: "FileCheck",
  },
] as const;

export const STATS = [
  { label: "Scams Detected", value: 12847, suffix: "+" },
  { label: "Reports Generated", value: 89234, suffix: "+" },
  { label: "Users Protected", value: 156000, suffix: "+" },
  { label: "Accuracy Rate", value: 97.3, suffix: "%" },
] as const;

export const TESTIMONIALS = [
  {
    id: "1",
    name: "Aarav Mehta",
    role: "B.Tech Student, IIT Bombay",
    avatar: "AM",
    content:
      "LEGITIFY saved me from a fake internship scam. The offer letter looked perfect, but the trust score was 12. Turns out the company didn't even exist in the MCA registry.",
    rating: 5,
  },
  {
    id: "2",
    name: "Dr. Priya Sharma",
    role: "Placement Cell Head, DTU",
    avatar: "PS",
    content:
      "We now run every recruiter through LEGITIFY before allowing them on campus. In the first month, we flagged 3 fraudulent companies that had previously gone undetected.",
    rating: 5,
  },
  {
    id: "3",
    name: "Rishi Kapoor",
    role: "Fresh Graduate",
    avatar: "RK",
    content:
      "Got an amazing job offer via email. Something felt off. LEGITIFY's domain analysis showed the domain was 4 days old with a free SSL. Saved my personal information.",
    rating: 5,
  },
  {
    id: "4",
    name: "Sneha Reddy",
    role: "Career Services, BITS Pilani",
    avatar: "SR",
    content:
      "The community intelligence feature is brilliant. It pulls real user reviews from Reddit and Glassdoor and gives a clear picture of whether the company is legitimate.",
    rating: 5,
  },
] as const;

export const TRUST_DIMENSIONS = [
  { key: "document", label: "Document", weight: 0.25 },
  { key: "domain", label: "Domain", weight: 0.20 },
  { key: "company", label: "Company", weight: 0.20 },
  { key: "recruiter", label: "Recruiter", weight: 0.15 },
  { key: "community", label: "Community", weight: 0.10 },
  { key: "technical", label: "Technical", weight: 0.10 },
] as const;

export const INPUT_TYPES = [
  { type: "pdf", label: "PDF Document", icon: "FileText", accept: ".pdf" },
  { type: "docx", label: "Word Document", icon: "FileText", accept: ".docx,.doc" },
  { type: "url", label: "Website URL", icon: "Globe", placeholder: "https://example.com" },
  { type: "linkedin", label: "LinkedIn Profile", icon: "Linkedin", placeholder: "https://linkedin.com/in/..." },
  { type: "email", label: "Email Content", icon: "Mail", placeholder: "Paste the email content here..." },
  { type: "text", label: "Raw Text", icon: "Type", placeholder: "Paste any text content to analyze..." },
] as const;
