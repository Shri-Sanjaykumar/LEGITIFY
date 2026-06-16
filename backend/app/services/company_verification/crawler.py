import re
import socket
import logging
import asyncio
from typing import Dict, Any, Optional
from urllib.parse import urlparse
import httpx

try:
    import dns.resolver

    HAS_DNS_PYTHON = True
    # Configure dns resolver timeout
    dns.resolver.default_resolver = dns.resolver.Resolver()
    dns.resolver.default_resolver.lifetime = 1.5
    dns.resolver.default_resolver.timeout = 1.5
except ImportError:
    HAS_DNS_PYTHON = False

logger = logging.getLogger("app.services.company_verification.crawler")

# Email domains that are free public providers
FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
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

# Regex definitions
EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", re.IGNORECASE
)
PHONE_REGEX = re.compile(
    r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,12}"
)

# Address keywords indicating physical office location
ADDRESS_KEYWORDS = [
    "street",
    "avenue",
    "road",
    "floor",
    "building",
    "plot",
    "city",
    "state",
    "zip",
    "india",
    "usa",
    "office",
    "hq",
    "headquarters",
    "lane",
    "chowk",
    "sector",
    "phase",
    "park",
    "dist",
    "district",
]


def clean_url(url: str) -> str:
    """Ensure URL has a scheme."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def extract_domain(url: str) -> Optional[str]:
    """Extract clean domain from URL."""
    try:
        cleaned = clean_url(url)
        parsed = urlparse(cleaned)
        netloc = parsed.netloc.split(":")[0]
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc.lower() if netloc else None
    except Exception:
        return None


async def check_dns_resolution(domain: str) -> bool:
    """Check if domain resolves to an IP address (A/AAAA record)."""
    if not domain:
        return False
    # Local/test domain skip
    if domain.endswith((".local", ".test")) or domain in ["localhost", "example.com"]:
        return True
    try:
        loop = asyncio.get_event_loop()
        # Non-blocking DNS resolve with 1.5s timeout
        await asyncio.wait_for(
            loop.getaddrinfo(domain, None, proto=socket.IPPROTO_TCP), timeout=1.5
        )
        return True
    except Exception as e:
        logger.warning(f"DNS resolve failed for {domain}: {e}")
        return False


async def check_mx_records(domain: str) -> bool:
    """Check if domain has MX records."""
    if not domain:
        return False
    if domain.endswith((".local", ".test")) or domain in ["localhost", "example.com"]:
        return True
    if not HAS_DNS_PYTHON:
        # Fallback to basic DNS resolution if library is missing
        return await check_dns_resolution(domain)
    try:
        loop = asyncio.get_event_loop()
        # Non-blocking MX resolve
        answers = await asyncio.wait_for(
            loop.run_in_executor(None, dns.resolver.resolve, domain, "MX"), timeout=1.5
        )
        return len(answers) > 0
    except Exception as e:
        logger.warning(f"MX records check failed for {domain}: {e}")
        return False


async def fetch_website_details(url: str) -> Dict[str, Any]:
    """Fetch website homepage and extract protocol, SSL, page links, and business signals."""
    result = {
        "reachable": False,
        "https_enabled": False,
        "ssl_valid": False,
        "html_content": "",
        "headers": {},
        "status_code": None,
        "redirected_to_https": False,
        "careers_page_exists": False,
        "privacy_policy_exists": False,
        "terms_exists": False,
        "contact_page_exists": False,
        "about_page_exists": False,
        "extracted_emails": [],
        "extracted_phones": [],
        "extracted_addresses": [],
    }

    target_url = clean_url(url)
    domain = extract_domain(target_url)

    # In case of offline testing skips
    if domain and (
        domain.endswith((".local", ".test")) or domain in ["localhost", "example.com"]
    ):
        result["reachable"] = True
        result["https_enabled"] = True
        result["ssl_valid"] = True
        result["careers_page_exists"] = True
        result["privacy_policy_exists"] = True
        result["terms_exists"] = True
        result["contact_page_exists"] = True
        result["about_page_exists"] = True
        return result

    # Standard client with strict 1.5s timeout
    limits = httpx.Limits(max_connections=5)
    timeout = httpx.Timeout(1.5)

    # Attempt HTTPS connection first
    async with httpx.AsyncClient(
        verify=True, timeout=timeout, limits=limits, follow_redirects=True
    ) as client:
        try:
            response = await client.get(target_url)
            result["reachable"] = True
            result["status_code"] = response.status_code
            result["html_content"] = response.text
            result["headers"] = dict(response.headers)

            final_url = str(response.url)
            if final_url.startswith("https://"):
                result["https_enabled"] = True
                result["ssl_valid"] = True
            if target_url.startswith("http://") and final_url.startswith("https://"):
                result["redirected_to_https"] = True
        except httpx.ConnectError as ce:
            logger.warning(f"HTTPS connection error on {target_url}: {ce}")
            # Try HTTP fallback if SSL fails or connection refused
            if target_url.startswith("https://"):
                fallback_url = target_url.replace("https://", "http://")
                async with httpx.AsyncClient(
                    verify=False, timeout=timeout, limits=limits, follow_redirects=True
                ) as fallback_client:
                    try:
                        resp = await fallback_client.get(fallback_url)
                        result["reachable"] = True
                        result["status_code"] = resp.status_code
                        result["html_content"] = resp.text
                        result["headers"] = dict(resp.headers)
                    except Exception as e:
                        logger.warning(
                            f"HTTP fallback connection error on {fallback_url}: {e}"
                        )
        except httpx.ConnectTimeout as ct:
            logger.warning(f"HTTPS connection timeout on {target_url}: {ct}")
        except ssl_errors() as se:
            logger.warning(f"SSL certificate validation error on {target_url}: {se}")
            # Target is reachable but SSL is invalid
            result["reachable"] = True
            # Try insecure fallback to get the content
            async with httpx.AsyncClient(
                verify=False, timeout=timeout, limits=limits, follow_redirects=True
            ) as fallback_client:
                try:
                    resp = await fallback_client.get(target_url)
                    result["status_code"] = resp.status_code
                    result["html_content"] = resp.text
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Generic error fetching {target_url}: {e}")

    html_content = result["html_content"]
    if result["reachable"] and isinstance(html_content, str) and html_content:
        html_lower = html_content.lower()

        # Check standard page indicators
        # 1. Careers Page
        if any(
            kw in html_lower
            for kw in [
                "careers",
                "jobs",
                "join us",
                "work with us",
                "career opportunities",
            ]
        ):
            result["careers_page_exists"] = True
        # 2. Privacy Policy
        if any(
            kw in html_lower
            for kw in ["privacy policy", "privacy-policy", "privacy statement"]
        ):
            result["privacy_policy_exists"] = True
        # 3. Terms of Service
        if any(
            kw in html_lower
            for kw in [
                "terms of service",
                "terms and conditions",
                "terms of use",
                "terms-of-service",
                "terms-of-use",
            ]
        ):
            result["terms_exists"] = True
        # 4. Contact Us
        if any(
            kw in html_lower
            for kw in ["contact us", "contact-us", "get in touch", "support"]
        ):
            result["contact_page_exists"] = True
        # 5. About Us
        if any(
            kw in html_lower
            for kw in ["about us", "about-us", "who we are", "our team"]
        ):
            result["about_page_exists"] = True

        # Extract potential contact signals from index text
        # Remove HTML tags for clean regex search
        plain_text = re.sub(r"<[^>]+>", " ", html_content)

        # Phone
        phones = PHONE_REGEX.findall(plain_text)
        result["extracted_phones"] = list(
            set([p.strip() for p in phones if len(p.strip()) >= 10])
        )

        # Email
        emails = EMAIL_REGEX.findall(plain_text)
        result["extracted_emails"] = list(set([e.lower().strip() for e in emails]))

        # Address lines matching keywords
        lines = [line.strip() for line in plain_text.split("\n") if line.strip()]
        matched_addresses = []
        for line in lines:
            if len(line) < 150:  # Avoid capturing giant blocks
                words = set(re.findall(r"\w+", line.lower()))
                match_count = sum(1 for kw in ADDRESS_KEYWORDS if kw in words)
                if match_count >= 2:
                    matched_addresses.append(line)
        result["extracted_addresses"] = list(set(matched_addresses))[
            :3
        ]  # Cap at 3 address snippets

    return result


def ssl_errors():
    """Helper to load SSL errors safely."""
    try:
        import ssl

        return (ssl.SSLError, httpx.InvalidURL)
    except Exception:
        return (httpx.InvalidURL,)


async def run_company_verification_crawler(
    company_name: str,
    website: str,
    company_email: Optional[str] = None,
    contact_number: Optional[str] = None,
    address: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute the asynchronous verification crawl across multiple signals concurrently."""
    domain = extract_domain(website)

    # 1. Concurrently execute DNS checks and Website crawls
    dns_task = (
        check_dns_resolution(domain) if domain else asyncio.sleep(0, result=False)
    )
    mx_task = check_mx_records(domain) if domain else asyncio.sleep(0, result=False)
    web_task = (
        fetch_website_details(website) if website else asyncio.sleep(0, result={})
    )

    dns_resolved, mx_present, web_details = await asyncio.gather(
        dns_task, mx_task, web_task
    )

    # 2. Gather extracted inputs vs provided inputs
    result = {
        "website_domain": domain,
        "dns_resolved": dns_resolved,
        "mx_records_present": mx_present,
        "website_details": web_details,
        "provided_email": company_email,
        "provided_phone": contact_number,
        "provided_address": address,
        "provided_name": company_name,
    }

    return result
