import re
from typing import Dict, Any, List
from app.services.company_verification.crawler import FREE_EMAIL_DOMAINS


def calculate_verification_results(crawl_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate the verification score, status level, confidence, and breakdowns from crawl results."""
    score = 0.0
    breakdowns: List[Dict[str, Any]] = []
    evidence: List[Dict[str, Any]] = []

    web_details = crawl_data.get("website_details", {})
    dns_resolved = crawl_data.get("dns_resolved", False)
    mx_records_present = crawl_data.get("mx_records_present", False)

    provided_email = crawl_data.get("provided_email")
    provided_phone = crawl_data.get("provided_phone")
    provided_address = crawl_data.get("provided_address")
    provided_name = crawl_data.get("provided_name", "")

    # Website details values
    reachable = web_details.get("reachable", False)
    https_enabled = web_details.get("https_enabled", False)
    ssl_valid = web_details.get("ssl_valid", False)
    careers_exists = web_details.get("careers_page_exists", False)
    privacy_exists = web_details.get("privacy_policy_exists", False)
    terms_exists = web_details.get("terms_exists", False)
    contact_exists = web_details.get("contact_page_exists", False)
    about_exists = web_details.get("about_page_exists", False)

    extracted_emails = web_details.get("extracted_emails", [])
    extracted_phones = web_details.get("extracted_phones", [])
    extracted_addresses = web_details.get("extracted_addresses", [])

    # 1. WEBSITE REACHABLE / BROKEN
    if reachable:
        score += 10.0
        breakdowns.append(
            {
                "rule_name": "WEBSITE_REACHABLE",
                "category": "WEBSITE_SIGNALS",
                "score_change": 10.0,
                "confidence": "HIGH",
                "source_reliability": "HIGH",
                "reason": "The corporate website responded successfully to HTTP/HTTPS requests.",
                "source": "HTTP_CHECK",
            }
        )
        evidence.append(
            {
                "evidence_type": "WEBSITE",
                "description": f"Website {crawl_data.get('provided_name')} is reachable.",
                "source": "HTTP_CHECK",
                "severity": "INFO",
                "confidence": "HIGH",
            }
        )
    else:
        score -= 25.0
        breakdowns.append(
            {
                "rule_name": "BROKEN_WEBSITE",
                "category": "WEBSITE_SIGNALS",
                "score_change": -25.0,
                "confidence": "HIGH",
                "source_reliability": "HIGH",
                "reason": "The corporate website could not be reached via standard HTTP/HTTPS protocols.",
                "source": "HTTP_CHECK",
            }
        )
        evidence.append(
            {
                "evidence_type": "WEBSITE",
                "description": "Website is broken or unreachable.",
                "source": "HTTP_CHECK",
                "severity": "CRITICAL",
                "confidence": "HIGH",
            }
        )

    # 2. HTTPS / SSL SIGNALS
    if reachable:
        if https_enabled:
            score += 10.0
            breakdowns.append(
                {
                    "rule_name": "HTTPS_ENABLED",
                    "category": "WEBSITE_SIGNALS",
                    "score_change": 10.0,
                    "confidence": "HIGH",
                    "source_reliability": "HIGH",
                    "reason": "The website uses secure HTTPS for transmission.",
                    "source": "PROTOCOL_CHECK",
                }
            )
        else:
            score -= 15.0
            breakdowns.append(
                {
                    "rule_name": "NO_HTTPS",
                    "category": "WEBSITE_SIGNALS",
                    "score_change": -15.0,
                    "confidence": "HIGH",
                    "source_reliability": "HIGH",
                    "reason": "The website relies on insecure HTTP without transport security.",
                    "source": "PROTOCOL_CHECK",
                }
            )
            evidence.append(
                {
                    "evidence_type": "SSL",
                    "description": "HTTPS protocol is missing on target website.",
                    "source": "PROTOCOL_CHECK",
                    "severity": "HIGH",
                    "confidence": "HIGH",
                }
            )

        if ssl_valid:
            score += 10.0
            breakdowns.append(
                {
                    "rule_name": "SSL_VALID",
                    "category": "WEBSITE_SIGNALS",
                    "score_change": 10.0,
                    "confidence": "HIGH",
                    "source_reliability": "HIGH",
                    "reason": "Valid TLS/SSL certificate trust chain established.",
                    "source": "SSL_CHECK",
                }
            )
            evidence.append(
                {
                    "evidence_type": "SSL",
                    "description": "SSL certificate is valid and trusted.",
                    "source": "SSL_CHECK",
                    "severity": "INFO",
                    "confidence": "HIGH",
                }
            )

    # 3. WEBSITE INTERNAL PAGES (Careers, Privacy, Terms, Contact, About)
    if reachable:
        if careers_exists:
            score += 10.0
            breakdowns.append(
                {
                    "rule_name": "CAREERS_PAGE_EXISTS",
                    "category": "WEBSITE_SIGNALS",
                    "score_change": 10.0,
                    "confidence": "MEDIUM",
                    "source_reliability": "MEDIUM",
                    "reason": "Careers or recruitment reference page found.",
                    "source": "HTML_PARSER",
                }
            )
        if privacy_exists:
            score += 5.0
            breakdowns.append(
                {
                    "rule_name": "PRIVACY_POLICY_EXISTS",
                    "category": "WEBSITE_SIGNALS",
                    "score_change": 5.0,
                    "confidence": "HIGH",
                    "source_reliability": "MEDIUM",
                    "reason": "Privacy Policy disclosure page detected.",
                    "source": "HTML_PARSER",
                }
            )
        if terms_exists:
            score += 5.0
            breakdowns.append(
                {
                    "rule_name": "TERMS_PAGE_EXISTS",
                    "category": "WEBSITE_SIGNALS",
                    "score_change": 5.0,
                    "confidence": "HIGH",
                    "source_reliability": "MEDIUM",
                    "reason": "Terms of Service page detected.",
                    "source": "HTML_PARSER",
                }
            )
        if contact_exists:
            score += 5.0
            breakdowns.append(
                {
                    "rule_name": "CONTACT_PAGE_EXISTS",
                    "category": "WEBSITE_SIGNALS",
                    "score_change": 5.0,
                    "confidence": "MEDIUM",
                    "source_reliability": "MEDIUM",
                    "reason": "Contact Us information page detected.",
                    "source": "HTML_PARSER",
                }
            )
        if about_exists:
            score += 5.0
            breakdowns.append(
                {
                    "rule_name": "ABOUT_PAGE_EXISTS",
                    "category": "WEBSITE_SIGNALS",
                    "score_change": 5.0,
                    "confidence": "MEDIUM",
                    "source_reliability": "MEDIUM",
                    "reason": "About Us company description page detected.",
                    "source": "HTML_PARSER",
                }
            )

    # 4. BUSINESS & CONTACT SIGNALS (Address, Phone, Email)
    has_any_address = bool(provided_address or extracted_addresses)
    if has_any_address:
        score += 10.0
        breakdowns.append(
            {
                "rule_name": "ADDRESS_PRESENT",
                "category": "BUSINESS_SIGNALS",
                "score_change": 10.0,
                "confidence": "MEDIUM",
                "source_reliability": "LOW" if extracted_addresses else "HIGH",
                "reason": "Physical office address detected on website or provided directly.",
                "source": "CONTACT_CHECK",
            }
        )
        evidence.append(
            {
                "evidence_type": "CONTACT",
                "description": f"Physical address verified: {provided_address or extracted_addresses[0]}",
                "source": "CONTACT_CHECK",
                "severity": "INFO",
                "confidence": "HIGH" if provided_address else "MEDIUM",
            }
        )
    else:
        score -= 15.0
        breakdowns.append(
            {
                "rule_name": "NO_ADDRESS",
                "category": "BUSINESS_SIGNALS",
                "score_change": -15.0,
                "confidence": "HIGH",
                "source_reliability": "HIGH",
                "reason": "No physical mailing or headquarters address is visible.",
                "source": "CONTACT_CHECK",
            }
        )
        evidence.append(
            {
                "evidence_type": "CONTACT",
                "description": "No corporate address found.",
                "source": "CONTACT_CHECK",
                "severity": "MEDIUM",
                "confidence": "HIGH",
            }
        )

    has_any_phone = bool(provided_phone or extracted_phones)
    if has_any_phone:
        score += 10.0
        breakdowns.append(
            {
                "rule_name": "PHONE_PRESENT",
                "category": "CONTACT_SIGNALS",
                "score_change": 10.0,
                "confidence": "MEDIUM",
                "source_reliability": "LOW" if extracted_phones else "HIGH",
                "reason": "Contact phone number detected on website or provided directly.",
                "source": "CONTACT_CHECK",
            }
        )
    else:
        score -= 20.0
        breakdowns.append(
            {
                "rule_name": "NO_PHONE",
                "category": "CONTACT_SIGNALS",
                "score_change": -20.0,
                "confidence": "HIGH",
                "source_reliability": "HIGH",
                "reason": "No phone support number is visible in contact details.",
                "source": "CONTACT_CHECK",
            }
        )

    # Check if contact information is completely missing
    if (
        not has_any_address
        and not has_any_phone
        and not provided_email
        and not extracted_emails
    ):
        score -= 20.0
        breakdowns.append(
            {
                "rule_name": "NO_CONTACT_INFO",
                "category": "CONTACT_SIGNALS",
                "score_change": -20.0,
                "confidence": "HIGH",
                "source_reliability": "HIGH",
                "reason": "No active telephone, physical address, or email contacts found.",
                "source": "CONTACT_CHECK",
            }
        )
        evidence.append(
            {
                "evidence_type": "CONTACT",
                "description": "Complete absence of contact methods.",
                "source": "CONTACT_CHECK",
                "severity": "HIGH",
                "confidence": "HIGH",
            }
        )

    # 5. EMAIL & DOMAIN SIGNALS
    email_to_check = provided_email or (
        extracted_emails[0] if extracted_emails else None
    )

    if email_to_check:
        email_parts = email_to_check.split("@")
        if len(email_parts) == 2:
            email_domain = email_parts[1].lower()
            if email_domain not in FREE_EMAIL_DOMAINS:
                score += 15.0
                breakdowns.append(
                    {
                        "rule_name": "CORPORATE_EMAIL",
                        "category": "EMAIL_SIGNALS",
                        "score_change": 15.0,
                        "confidence": "HIGH",
                        "source_reliability": "HIGH",
                        "reason": f"Recruiter contact email domain ({email_domain}) belongs to a private company.",
                        "source": "EMAIL_CHECK",
                    }
                )
            else:
                score -= 20.0
                breakdowns.append(
                    {
                        "rule_name": "NO_CORPORATE_EMAIL",
                        "category": "EMAIL_SIGNALS",
                        "score_change": -20.0,
                        "confidence": "HIGH",
                        "source_reliability": "HIGH",
                        "reason": "Contact email relies on a free public provider (e.g. gmail.com).",
                        "source": "EMAIL_CHECK",
                    }
                )
                evidence.append(
                    {
                        "evidence_type": "EMAIL",
                        "description": f"Insecure contact email domain: {email_to_check}",
                        "source": "EMAIL_CHECK",
                        "severity": "MEDIUM",
                        "confidence": "HIGH",
                    }
                )

    # DNS MX check
    if dns_resolved:
        if mx_records_present:
            score += 10.0
            breakdowns.append(
                {
                    "rule_name": "MX_RECORDS_PRESENT",
                    "category": "EMAIL_SIGNALS",
                    "score_change": 10.0,
                    "confidence": "HIGH",
                    "source_reliability": "HIGH",
                    "reason": "Mail Exchange (MX) records exist for domain, enabling email delivery.",
                    "source": "DNS_CHECK",
                }
            )
            evidence.append(
                {
                    "evidence_type": "DNS",
                    "description": "DNS MX mail servers verified.",
                    "source": "DNS_CHECK",
                    "severity": "INFO",
                    "confidence": "HIGH",
                }
            )

    # 6. CONSISTENCY SIGNALS
    # Email domain matches website domain
    website_domain = crawl_data.get("website_domain")
    if email_to_check and website_domain:
        email_parts = email_to_check.split("@")
        if len(email_parts) == 2:
            email_domain = email_parts[1].lower()
            if email_domain == website_domain or email_domain.endswith(
                "." + website_domain
            ):
                score += 10.0
                breakdowns.append(
                    {
                        "rule_name": "EMAIL_DOMAIN_MATCH",
                        "category": "CONSISTENCY_SIGNALS",
                        "score_change": 10.0,
                        "confidence": "HIGH",
                        "source_reliability": "HIGH",
                        "reason": "Email domain suffix corresponds exactly with the official company website.",
                        "source": "CONSISTENCY_CHECK",
                    }
                )
                evidence.append(
                    {
                        "evidence_type": "EMAIL",
                        "description": "Recruiter domain matches official corporate website.",
                        "source": "CONSISTENCY_CHECK",
                        "severity": "INFO",
                        "confidence": "HIGH",
                    }
                )

    # Company name matches website title
    if reachable and provided_name and web_details.get("html_content"):
        # Look for company name in HTML title or body tag
        html_content = web_details["html_content"]
        title_match = re.search(r"<title>(.*?)</title>", html_content, re.IGNORECASE)
        name_matched = False
        if title_match:
            title_text = title_match.group(1).lower()
            if provided_name.lower() in title_text:
                name_matched = True

        if name_matched:
            score += 5.0
            breakdowns.append(
                {
                    "rule_name": "COMPANY_NAME_MATCH",
                    "category": "CONSISTENCY_SIGNALS",
                    "score_change": 5.0,
                    "confidence": "MEDIUM",
                    "source_reliability": "MEDIUM",
                    "reason": "Corporate brand name matches index title metadata.",
                    "source": "CONSISTENCY_CHECK",
                }
            )

    # Clamp final score
    clamped_score = max(0.0, min(100.0, score))

    # Determine level
    if clamped_score >= 80.0:
        level = "VERIFIED"
    elif clamped_score >= 60.0:
        level = "LIKELY_VERIFIED"
    elif clamped_score >= 40.0:
        level = "PARTIALLY_VERIFIED"
    elif clamped_score >= 20.0:
        level = "SUSPICIOUS"
    else:
        level = "UNVERIFIED"

    # Determine confidence
    if reachable and dns_resolved:
        if mx_records_present and has_any_address:
            confidence = "HIGH"
        else:
            confidence = "MEDIUM"
    else:
        confidence = "LOW"

    return {
        "score": clamped_score,
        "level": level,
        "confidence": confidence,
        "breakdowns": breakdowns,
        "evidence": evidence,
    }
