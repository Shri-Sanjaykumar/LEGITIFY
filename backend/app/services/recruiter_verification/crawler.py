import re
import logging
from typing import Dict, Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger("app.services.recruiter_verification.crawler")

# Common free email providers
FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "yahoo.co.in",
    "rediffmail.com",
    "live.com",
    "aol.com",
    "zoho.com",
    "protonmail.com",
    "proton.me",
    "mail.com",
    "yandex.com",
    "icloud.com",
}

# Major corporate brands
MAJOR_BRANDS = {"microsoft", "google", "amazon", "tcs", "infosys", "accenture"}

# Standard recruiter role keywords
RECRUITER_ROLE_KEYWORDS = {
    "hr",
    "recruiter",
    "talent",
    "acquisition",
    "hiring",
    "people",
    "coordinator",
    "placement",
    "headhunter",
    "sourcing",
    "staffing",
    "human resources",
}


def clean_url(url: str) -> str:
    """Ensure URL has a scheme."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def extract_domain(email_or_url: str) -> Optional[str]:
    """Extract clean domain from email or website URL."""
    if not email_or_url:
        return None
    email_or_email = email_or_url.strip().lower()
    if not email_or_email:
        return None

    if "@" in email_or_email:
        parts = email_or_email.split("@")
        if len(parts) == 2:
            return parts[1]
        return None

    try:
        cleaned = clean_url(email_or_email)
        parsed = urlparse(cleaned)
        netloc = parsed.netloc.split(":")[0]
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc if netloc else None
    except Exception:
        return None


def is_internal_domain(domain: str) -> bool:
    """Determine if a domain is an internal domain (.local, .test, internal.*, vpn.*, corp.*)."""
    if not domain:
        return False
    domain = domain.lower().strip()

    if domain.endswith((".local", ".test")):
        return True

    # Check prefix patterns internal.*, vpn.*, corp.*
    parts = domain.split(".")
    if len(parts) > 1 and parts[0] in ("internal", "vpn", "corp"):
        return True

    return False


def claims_major_brand(company_name: str) -> bool:
    """Determine if the claimed company matches a major brand (Google, Microsoft, Amazon, TCS, Infosys)."""
    if not company_name:
        return False
    normalized = company_name.lower().strip()
    words = set(re.findall(r"\b\w+\b", normalized))
    return any(brand in words or brand == normalized for brand in MAJOR_BRANDS)


async def run_recruiter_verification_crawler(
    recruiter_name: str,
    recruiter_email: str,
    claimed_company: str,
    recruiter_phone: Optional[str] = None,
    recruiter_role: Optional[str] = None,
    company_website: Optional[str] = None,
    reply_to: Optional[str] = None,
    display_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Runs a series of local consistency checks on recruiter metadata.

    Returns a structured dictionary of audit findings.
    """
    email_domain = extract_domain(recruiter_email)
    company_domain = extract_domain(company_website) if company_website else None

    # 1. Domain Checks
    is_free = email_domain in FREE_EMAIL_DOMAINS
    is_internal = is_internal_domain(email_domain) if email_domain else False

    # Check email domain match against company website domain
    email_domain_matches_company = False
    if email_domain and company_domain:
        # Exact match or subdomain
        email_domain_matches_company = (
            email_domain == company_domain
            or email_domain.endswith("." + company_domain)
        )

    # 2. Major corporate authority mismatch
    claims_authority = claims_major_brand(claimed_company)
    free_email_authority_mismatch = is_free and claims_authority

    # 3. Reply-To Alignment Check
    reply_to_mismatch = False
    if reply_to and email_domain:
        reply_to_domain = extract_domain(reply_to)
        if reply_to_domain and reply_to_domain != email_domain:
            reply_to_mismatch = True

    # 4. Display Name & Email Provider Check
    display_name_mismatch = False
    if display_name and email_domain:
        display_lower = display_name.lower()
        # If display name claims authority of a brand but uses a public/unrelated domain
        claimed_brands_in_display = any(
            brand in display_lower for brand in MAJOR_BRANDS
        )
        if claimed_brands_in_display and is_free:
            display_name_mismatch = True

    # 5. Role consistency check
    role_consistent = True
    if recruiter_role:
        role_lower = recruiter_role.lower()
        role_words = set(re.findall(r"\b\w+\b", role_lower))
        role_consistent = any(
            kw in role_words or kw in role_lower for kw in RECRUITER_ROLE_KEYWORDS
        )

    # 6. Phone number validation
    phone_valid = True
    if recruiter_phone:
        # Standard phone number pattern (digits, spaces, hyphens, plus, parenthesis)
        cleaned_phone = re.sub(r"[\s\-\(\)\+]", "", recruiter_phone)
        if len(cleaned_phone) < 7 or not cleaned_phone.isdigit():
            phone_valid = False

    return {
        "recruiter_name": recruiter_name,
        "recruiter_email": recruiter_email,
        "email_domain": email_domain,
        "claimed_company": claimed_company,
        "company_website": company_website,
        "company_domain": company_domain,
        "is_free_email": is_free,
        "is_internal_email": is_internal,
        "email_domain_matches_company": email_domain_matches_company,
        "claims_major_brand": claims_authority,
        "free_email_authority_mismatch": free_email_authority_mismatch,
        "reply_to_mismatch": reply_to_mismatch,
        "display_name_mismatch": display_name_mismatch,
        "role_consistent": role_consistent,
        "phone_valid": phone_valid,
        "recruiter_role": recruiter_role,
        "recruiter_phone": recruiter_phone,
    }
