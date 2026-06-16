from datetime import datetime, timezone
from typing import Dict, Any, List

INTERNAL_SUFFIXES = (".local", ".test", ".internal", ".lan", ".localdomain", ".home")
INTERNAL_PREFIXES = ("vpn.", "corp.", "internal.", "intranet.")


def is_internal_domain(domain: str) -> bool:
    """Identify if a domain is a private internal network resource."""
    if not domain:
        return False
    domain = domain.strip().lower()

    # Check suffixes
    if domain.endswith(INTERNAL_SUFFIXES):
        return True

    # Check prefixes
    if domain.startswith(INTERNAL_PREFIXES):
        return True

    return False


def calculate_domain_results(crawl_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate the domain verification score, level, confidence, and breakdowns."""
    domain = crawl_data.get("domain", "")

    # Check if internal domain
    if is_internal_domain(domain):
        return {
            "score": 90.0,
            "level": "INTERNAL_DOMAIN",
            "confidence": "MEDIUM",
            "breakdowns": [
                {
                    "rule_name": "INTERNAL_DOMAIN_BYPASS",
                    "category": "DNS_SIGNALS",
                    "score_change": 0.0,
                    "confidence": "HIGH",
                    "source_reliability": "HIGH",
                    "reason": "This domain is identified as an internal corporate resource. Public security checks bypassed.",
                    "source": "INTERNAL_CLASSIFIER",
                }
            ],
            "evidence": [
                {
                    "evidence_type": "DNS",
                    "description": f"Internal private network resource identified: {domain}",
                    "source": "INTERNAL_CLASSIFIER",
                    "severity": "INFO",
                    "confidence": "HIGH",
                }
            ],
        }

    score = 100.0
    breakdowns: List[Dict[str, Any]] = []
    evidence: List[Dict[str, Any]] = []

    dns_resolved = crawl_data.get("dns_resolved", False)
    mx_present = crawl_data.get("mx_records_present", False)
    spf_record = crawl_data.get("spf_record")
    dmarc_record = crawl_data.get("dmarc_record")
    dkim_status = crawl_data.get("dkim_status", "UNKNOWN")  # PRESENT, ABSENT, UNKNOWN
    ssl_details = crawl_data.get("ssl_details", {})
    ssl_status = ssl_details.get(
        "ssl_status", "INVALID"
    )  # VALID, EXPIRED, INVALID, UNKNOWN
    cert_expiry = ssl_details.get("certificate_expiry")
    website_reachable = crawl_data.get("website_reachable", False)

    # 1. DNS SIGNALS
    if not dns_resolved:
        score -= 85.0
        breakdowns.append(
            {
                "rule_name": "NO_DNS",
                "category": "DNS_SIGNALS",
                "score_change": -85.0,
                "confidence": "HIGH",
                "source_reliability": "HIGH",
                "reason": "Domain name does not resolve to any active IP address records.",
                "source": "DNS_RESOLVER",
            }
        )
        evidence.append(
            {
                "evidence_type": "DNS",
                "description": "DNS resolution failed. Domain does not exist or has nameserver failures.",
                "source": "DNS_RESOLVER",
                "severity": "CRITICAL",
                "confidence": "HIGH",
            }
        )

    # 2. MX SIGNALS
    if dns_resolved:
        if not mx_present:
            score -= 10.0
            breakdowns.append(
                {
                    "rule_name": "NO_MX",
                    "category": "EMAIL_SIGNALS",
                    "score_change": -10.0,
                    "confidence": "MEDIUM",
                    "source_reliability": "HIGH",
                    "reason": "No MX mail servers configured. Emails sent from this domain cannot receive replies.",
                    "source": "DNS_RESOLVER",
                }
            )
            evidence.append(
                {
                    "evidence_type": "MX_RECORD",
                    "description": "Missing incoming mail server records (MX).",
                    "source": "DNS_RESOLVER",
                    "severity": "HIGH",
                    "confidence": "MEDIUM",
                }
            )

    # 3. SPF SIGNALS
    if dns_resolved:
        if spf_record:
            evidence.append(
                {
                    "evidence_type": "TXT",
                    "description": f"SPF record configured: {spf_record}",
                    "source": "DNS_RESOLVER",
                    "severity": "INFO",
                    "confidence": "HIGH",
                }
            )
        else:
            score -= 10.0
            breakdowns.append(
                {
                    "rule_name": "NO_SPF",
                    "category": "EMAIL_SIGNALS",
                    "score_change": -10.0,
                    "confidence": "MEDIUM",
                    "source_reliability": "HIGH",
                    "reason": "Missing SPF policy record. Spammers can easily spoof emails pretending to belong to this domain.",
                    "source": "DNS_RESOLVER",
                }
            )
            evidence.append(
                {
                    "evidence_type": "TXT",
                    "description": "Missing SPF sender authorization record.",
                    "source": "DNS_RESOLVER",
                    "severity": "MEDIUM",
                    "confidence": "HIGH",
                }
            )

    # 4. DMARC SIGNALS
    if dns_resolved:
        if dmarc_record:
            evidence.append(
                {
                    "evidence_type": "TXT",
                    "description": f"DMARC record configured: {dmarc_record}",
                    "source": "DNS_RESOLVER",
                    "severity": "INFO",
                    "confidence": "HIGH",
                }
            )
        else:
            score -= 10.0
            breakdowns.append(
                {
                    "rule_name": "NO_DMARC",
                    "category": "EMAIL_SIGNALS",
                    "score_change": -10.0,
                    "confidence": "MEDIUM",
                    "source_reliability": "HIGH",
                    "reason": "Missing DMARC validation record. Receivers cannot verify email alignment rules.",
                    "source": "DNS_RESOLVER",
                }
            )
            evidence.append(
                {
                    "evidence_type": "TXT",
                    "description": "Missing DMARC anti-spoofing record.",
                    "source": "DNS_RESOLVER",
                    "severity": "MEDIUM",
                    "confidence": "HIGH",
                }
            )

    # 5. DKIM SIGNALS
    if dns_resolved:
        if dkim_status == "ABSENT":
            score -= 2.0
            breakdowns.append(
                {
                    "rule_name": "NO_DKIM",
                    "category": "EMAIL_SIGNALS",
                    "score_change": -2.0,
                    "confidence": "LOW",
                    "source_reliability": "MEDIUM",
                    "reason": "No DKIM key configurations detected across probed standard selectors.",
                    "source": "DNS_RESOLVER",
                }
            )
            evidence.append(
                {
                    "evidence_type": "TXT",
                    "description": "No DKIM public key signature resolved on probed selectors.",
                    "source": "DNS_RESOLVER",
                    "severity": "LOW",
                    "confidence": "MEDIUM",
                }
            )

    # 6. SSL / HTTPS SIGNALS
    if dns_resolved:
        if ssl_status == "VALID":
            # Check certificate expiry windows
            if cert_expiry:
                now_dt = datetime.now(timezone.utc)
                delta = cert_expiry - now_dt
                days_left = delta.days

                # 90-day informational notice
                if 30 < days_left <= 90:
                    evidence.append(
                        {
                            "evidence_type": "SSL_CERTIFICATE",
                            "description": f"Informational Notice: SSL Certificate is valid but expires in {days_left} days.",
                            "source": "SSL_SOCKET",
                            "severity": "INFO",
                            "confidence": "HIGH",
                        }
                    )
                # 30 days
                elif 15 < days_left <= 30:
                    score -= 2.0
                    breakdowns.append(
                        {
                            "rule_name": "SSL_EXPIRING_SOON",
                            "category": "SSL_SIGNALS",
                            "score_change": -2.0,
                            "confidence": "LOW",
                            "source_reliability": "HIGH",
                            "reason": f"SSL certificate expires soon in {days_left} days.",
                            "source": "SSL_SOCKET",
                        }
                    )
                # 15 days
                elif 7 < days_left <= 15:
                    score -= 5.0
                    breakdowns.append(
                        {
                            "rule_name": "SSL_EXPIRING_URGENT",
                            "category": "SSL_SIGNALS",
                            "score_change": -5.0,
                            "confidence": "MEDIUM",
                            "source_reliability": "HIGH",
                            "reason": f"SSL certificate expires in {days_left} days. Urgent renewal required.",
                            "source": "SSL_SOCKET",
                        }
                    )
                # 7 days
                elif days_left <= 7:
                    score -= 10.0
                    breakdowns.append(
                        {
                            "rule_name": "SSL_EXPIRING_CRITICAL",
                            "category": "SSL_SIGNALS",
                            "score_change": -10.0,
                            "confidence": "HIGH",
                            "source_reliability": "HIGH",
                            "reason": f"SSL certificate expires critically in {days_left} days.",
                            "source": "SSL_SOCKET",
                        }
                    )
        elif ssl_status == "EXPIRED":
            score -= 30.0
            breakdowns.append(
                {
                    "rule_name": "SSL_EXPIRED",
                    "category": "SSL_SIGNALS",
                    "score_change": -30.0,
                    "confidence": "HIGH",
                    "source_reliability": "HIGH",
                    "reason": "The TLS/SSL certificate is expired. Secure HTTPS connections fail.",
                    "source": "SSL_SOCKET",
                }
            )
            evidence.append(
                {
                    "evidence_type": "SSL_CERTIFICATE",
                    "description": "SSL Certificate is expired.",
                    "source": "SSL_SOCKET",
                    "severity": "CRITICAL",
                    "confidence": "HIGH",
                }
            )
        else:  # INVALID or connection failed
            score -= 30.0
            breakdowns.append(
                {
                    "rule_name": "SSL_INVALID",
                    "category": "SSL_SIGNALS",
                    "score_change": -30.0,
                    "confidence": "HIGH",
                    "source_reliability": "HIGH",
                    "reason": "Insecure or self-signed SSL handshake, or failed to connect to port 443.",
                    "source": "SSL_SOCKET",
                }
            )
            evidence.append(
                {
                    "evidence_type": "SSL_CERTIFICATE",
                    "description": f"SSL handshake failed or invalid: {ssl_details.get('error_message', 'Invalid handshake')}",
                    "source": "SSL_SOCKET",
                    "severity": "HIGH",
                    "confidence": "HIGH",
                }
            )

    # 7. WEBSITE REACHABILITY
    if dns_resolved:
        if not website_reachable:
            score -= 15.0
            breakdowns.append(
                {
                    "rule_name": "WEBSITE_UNREACHABLE",
                    "category": "WEBSITE_SIGNALS",
                    "score_change": -15.0,
                    "confidence": "MEDIUM",
                    "source_reliability": "HIGH",
                    "reason": "Host website failed to return valid HTTP status or timed out.",
                    "source": "HTTP_CLIENT",
                }
            )
            evidence.append(
                {
                    "evidence_type": "WEBSITE",
                    "description": "HTTP request timed out or returned broken server error.",
                    "source": "HTTP_CLIENT",
                    "severity": "MEDIUM",
                    "confidence": "MEDIUM",
                }
            )

    # Clamp score
    clamped_score = max(0.0, min(100.0, score))

    # Level Mapping
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

    # Confidence Rating
    if dns_resolved:
        if ssl_status != "UNKNOWN":
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
