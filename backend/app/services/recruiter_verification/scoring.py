from typing import Dict, Any, List


def calculate_recruiter_verification_results(
    crawl_data: Dict[str, Any],
    company_verified: bool = False,
    dns_mx_ssl_verified: bool = False,
) -> Dict[str, Any]:
    """Calculate recruiter score, level, confidence, breakdowns, and evidence."""
    score = 100.0
    breakdowns: List[Dict[str, Any]] = []
    evidence: List[Dict[str, Any]] = []

    is_free = crawl_data.get("is_free_email", False)
    is_internal = crawl_data.get("is_internal_email", False)
    email_domain_matches_company = crawl_data.get("email_domain_matches_company", False)
    free_email_authority_mismatch = crawl_data.get(
        "free_email_authority_mismatch", False
    )
    reply_to_mismatch = crawl_data.get("reply_to_mismatch", False)
    display_name_mismatch = crawl_data.get("display_name_mismatch", False)
    phone_valid = crawl_data.get("phone_valid", True)
    recruiter_phone = crawl_data.get("recruiter_phone")
    claimed_company = crawl_data.get("claimed_company", "")

    # Status defaults
    email_domain_status = "UNKNOWN"
    company_match_status = "NOT_FOUND"
    phone_match_status = "NOT_PROVIDED"

    if recruiter_phone:
        phone_match_status = "MATCHED" if phone_valid else "UNMATCHED"

    # Set company match status
    if company_verified:
        company_match_status = "FOUND_VERIFIED"
    else:
        company_match_status = (
            "FOUND_UNVERIFIED" if crawl_data.get("company_website") else "NOT_FOUND"
        )

    # Set email domain status
    if is_free:
        email_domain_status = "FREE_EMAIL"
    elif is_internal:
        email_domain_status = "INTERNAL"
    elif email_domain_matches_company:
        email_domain_status = "MATCHED"
    else:
        email_domain_status = "MISMATCHED"

    # Internal Recruiter check
    if is_internal:
        score = 100.0
        confidence = "HIGH"
        level = "INTERNAL_RECRUITER"

        breakdowns.append(
            {
                "rule_name": "INTERNAL_RECRUITER",
                "category": "EMAIL_SIGNALS",
                "score_change": 0.0,
                "confidence": "HIGH",
                "source_reliability": "HIGH",
                "reason": "Recruiter email belongs to an internal systems domain (.local, .test, corp.*, internal.*, vpn.*).",
                "source": "EMAIL_PARSER",
            }
        )
        evidence.append(
            {
                "evidence_type": "EMAIL_DOMAIN_MATCH",
                "severity": "INFO",
                "confidence": "HIGH",
                "description": f"Internal system recruiter domain detected ({crawl_data.get('email_domain')}).",
                "source": "EMAIL_PARSER",
            }
        )

        return {
            "score": score,
            "level": level,
            "confidence": confidence,
            "email_domain_status": email_domain_status,
            "company_match_status": company_match_status,
            "phone_match_status": phone_match_status,
            "breakdowns": breakdowns,
            "evidence": evidence,
        }

    # 1. Email Domain check
    if is_free:
        if free_email_authority_mismatch:
            score -= 45.0
            breakdowns.append(
                {
                    "rule_name": "FREE_EMAIL_AUTHORITY_MISMATCH",
                    "category": "EMAIL_SIGNALS",
                    "score_change": -45.0,
                    "confidence": "HIGH",
                    "source_reliability": "HIGH",
                    "reason": f"Recruiter uses free email ({crawl_data.get('email_domain')}) but claims authority from a major brand ({claimed_company}).",
                    "source": "EMAIL_PARSER",
                }
            )
            evidence.append(
                {
                    "evidence_type": "FREE_EMAIL_AUTHORITY_MISMATCH",
                    "severity": "HIGH",
                    "confidence": "HIGH",
                    "description": f"Free email provider used while claiming authority of major corporate entity: {claimed_company}.",
                    "source": "EMAIL_PARSER",
                }
            )
        else:
            score -= 10.0
            breakdowns.append(
                {
                    "rule_name": "FREE_EMAIL_PROVIDER",
                    "category": "EMAIL_SIGNALS",
                    "score_change": -10.0,
                    "confidence": "LOW",
                    "source_reliability": "HIGH",
                    "reason": "Recruiter uses a free public email provider (LOW confidence signal).",
                    "source": "EMAIL_PARSER",
                }
            )
            evidence.append(
                {
                    "evidence_type": "FREE_EMAIL_PROVIDER",
                    "severity": "LOW",
                    "confidence": "LOW",
                    "description": "Recruiter email is hosted on a free public domain.",
                    "source": "EMAIL_PARSER",
                }
            )
    else:
        # Corporate email domain
        if crawl_data.get("company_website") or company_verified:
            if email_domain_matches_company:
                score += 15.0
                breakdowns.append(
                    {
                        "rule_name": "EMAIL_DOMAIN_MATCH_CREDIT",
                        "category": "EMAIL_SIGNALS",
                        "score_change": 15.0,
                        "confidence": "HIGH",
                        "source_reliability": "HIGH",
                        "reason": f"Corporate recruiter email matches verified company domain ({crawl_data.get('email_domain')}).",
                        "source": "EMAIL_PARSER",
                    }
                )
                evidence.append(
                    {
                        "evidence_type": "EMAIL_DOMAIN_MATCH",
                        "severity": "INFO",
                        "confidence": "HIGH",
                        "description": "Recruiter email domain aligns perfectly with official corporate domain.",
                        "source": "EMAIL_PARSER",
                    }
                )
            else:
                score -= 45.0
                breakdowns.append(
                    {
                        "rule_name": "EMAIL_DOMAIN_MISMATCH",
                        "category": "EMAIL_SIGNALS",
                        "score_change": -45.0,
                        "confidence": "HIGH",
                        "source_reliability": "HIGH",
                        "reason": "Corporate recruiter email domain does not match verified company domain.",
                        "source": "EMAIL_PARSER",
                    }
                )
                evidence.append(
                    {
                        "evidence_type": "EMAIL_DOMAIN_MISMATCH",
                        "severity": "CRITICAL",
                        "confidence": "HIGH",
                        "description": "Recruiter email domain mismatch: expected alignment with company domain.",
                        "source": "EMAIL_PARSER",
                    }
                )
        else:
            # Corporate domain but claimed company website is unverified/unknown
            score -= 20.0
            breakdowns.append(
                {
                    "rule_name": "UNVERIFIED_CLAIMED_COMPANY",
                    "category": "COMPANY_SIGNALS",
                    "score_change": -20.0,
                    "confidence": "HIGH",
                    "source_reliability": "HIGH",
                    "reason": "Claimed company has not passed Legitify corporate verification.",
                    "source": "COMPANY_ROSTER",
                }
            )
            evidence.append(
                {
                    "evidence_type": "COMPANY_MATCH",
                    "severity": "HIGH",
                    "confidence": "HIGH",
                    "description": f"Claimed company entity '{claimed_company}' could not be matched against verified company listings.",
                    "source": "COMPANY_ROSTER",
                }
            )

    # 2. Reply-To checks
    if reply_to_mismatch:
        score -= 20.0
        breakdowns.append(
            {
                "rule_name": "REPLY_TO_MISMATCH",
                "category": "EMAIL_SIGNALS",
                "score_change": -20.0,
                "confidence": "HIGH",
                "source_reliability": "HIGH",
                "reason": "Email envelope sender domain differs from the Reply-To address domain.",
                "source": "EMAIL_PARSER",
            }
        )
        evidence.append(
            {
                "evidence_type": "EMAIL_DOMAIN_MISMATCH",
                "severity": "HIGH",
                "confidence": "HIGH",
                "description": "Reply-To header domain does not match sender domain.",
                "source": "EMAIL_PARSER",
            }
        )

    # 3. Display Name checks
    if display_name_mismatch:
        score -= 15.0
        breakdowns.append(
            {
                "rule_name": "DISPLAY_NAME_MISMATCH",
                "category": "EMAIL_SIGNALS",
                "score_change": -15.0,
                "confidence": "MEDIUM",
                "source_reliability": "HIGH",
                "reason": "Display name claims authority contradicting the email domain provider.",
                "source": "EMAIL_PARSER",
            }
        )
        evidence.append(
            {
                "evidence_type": "FREE_EMAIL_AUTHORITY_MISMATCH",
                "severity": "MEDIUM",
                "confidence": "MEDIUM",
                "description": "Sender display name claims official status, but email is from a generic provider.",
                "source": "EMAIL_PARSER",
            }
        )

    # 4. Phone check
    if recruiter_phone and not phone_valid:
        score -= 5.0
        breakdowns.append(
            {
                "rule_name": "PHONE_ROSTER_MISMATCH",
                "category": "ROSTER_SIGNALS",
                "score_change": -5.0,
                "confidence": "LOW",
                "source_reliability": "MEDIUM",
                "reason": "Phone contact does not match standard corporate format or country patterns.",
                "source": "PHONE_PARSER",
            }
        )
        evidence.append(
            {
                "evidence_type": "PHONE_MATCH",
                "severity": "LOW",
                "confidence": "LOW",
                "description": "Provided contact number fails format alignment checks.",
                "source": "PHONE_PARSER",
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
    if company_verified and email_domain_matches_company and dns_mx_ssl_verified:
        confidence = "HIGH"
    elif company_verified or (not is_free and dns_mx_ssl_verified):
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    return {
        "score": clamped_score,
        "level": level,
        "confidence": confidence,
        "email_domain_status": email_domain_status,
        "company_match_status": company_match_status,
        "phone_match_status": phone_match_status,
        "breakdowns": breakdowns,
        "evidence": evidence,
    }
