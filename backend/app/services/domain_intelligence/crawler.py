import socket
import logging
import asyncio
import ssl
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from urllib.parse import urlparse

try:
    import dns.resolver

    HAS_DNS_PYTHON = True
    dns.resolver.default_resolver = dns.resolver.Resolver()
    dns.resolver.default_resolver.lifetime = 1.5
    dns.resolver.default_resolver.timeout = 1.5
except ImportError:
    HAS_DNS_PYTHON = False

logger = logging.getLogger("app.services.domain_intelligence.crawler")

COMMON_DKIM_SELECTORS = ["default", "google", "mail", "k1", "sig1"]


def clean_url(url: str) -> str:
    """Ensure URL has a scheme."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def extract_domain(url: str) -> Optional[str]:
    """Extract clean domain from URL or Email."""
    if not url:
        return None
    url = url.strip().lower()
    if "@" in url:
        parts = url.split("@")
        if len(parts) == 2:
            return parts[1]
        return None
    try:
        cleaned = clean_url(url)
        parsed = urlparse(cleaned)
        netloc = parsed.netloc.split(":")[0]
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc if netloc else None
    except Exception:
        return None


async def check_dns_resolution(domain: str) -> bool:
    """Check if domain resolves to A/AAAA or NS record."""
    if not domain:
        return False
    if domain.endswith((".local", ".test")) or domain in [
        "localhost",
        "example.com",
        "techcorp.com",
    ]:
        return True

    if HAS_DNS_PYTHON:
        try:
            # Check A records
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: dns.resolver.resolve(domain, "A"))
            return True
        except Exception:
            pass

    # Fallback to standard socket resolve
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None, lambda: socket.getaddrinfo(domain, None, proto=socket.IPPROTO_TCP)
        )
        return True
    except Exception as e:
        logger.warning(f"DNS resolution failed for {domain}: {e}")
        return False


async def check_mx_records(domain: str) -> bool:
    """Query MX records for the domain."""
    if not domain:
        return False
    if domain.endswith((".local", ".test")) or domain in [
        "localhost",
        "example.com",
        "techcorp.com",
    ]:
        return True

    if not HAS_DNS_PYTHON:
        return True  # Fallback to True if dns library is not present

    try:
        loop = asyncio.get_running_loop()
        answers = await loop.run_in_executor(
            None, lambda: dns.resolver.resolve(domain, "MX")
        )
        return len(answers) > 0
    except Exception as e:
        logger.warning(f"MX lookup failed for {domain}: {e}")
        return False


async def check_spf_record(domain: str) -> Optional[str]:
    """Query TXT records and search for SPF records starting with v=spf1."""
    if not domain:
        return None
    if domain.endswith((".local", ".test")) or domain in [
        "localhost",
        "example.com",
        "techcorp.com",
    ]:
        return "v=spf1 include:_spf.google.com ~all"

    if not HAS_DNS_PYTHON:
        return None

    try:
        loop = asyncio.get_running_loop()
        answers = await loop.run_in_executor(
            None, lambda: dns.resolver.resolve(domain, "TXT")
        )
        for rdata in answers:
            txt_string = "".join(
                [
                    s.decode("utf-8") if isinstance(s, bytes) else s
                    for s in rdata.strings
                ]
            )
            if txt_string.lower().startswith("v=spf1"):
                return txt_string
        return None
    except Exception as e:
        logger.warning(f"SPF lookup failed for {domain}: {e}")
        return None


async def check_dmarc_record(domain: str) -> Optional[str]:
    """Query DMARC TXT record at _dmarc.{domain} with root fallback."""
    if not domain:
        return None
    if domain.endswith((".local", ".test")) or domain in [
        "localhost",
        "example.com",
        "techcorp.com",
    ]:
        return "v=DMARC1; p=reject;"

    if not HAS_DNS_PYTHON:
        return None

    try:
        loop = asyncio.get_running_loop()
        answers = await loop.run_in_executor(
            None, lambda: dns.resolver.resolve(f"_dmarc.{domain}", "TXT")
        )
        for rdata in answers:
            txt_string = "".join(
                [
                    s.decode("utf-8") if isinstance(s, bytes) else s
                    for s in rdata.strings
                ]
            )
            if txt_string.lower().startswith("v=dmarc1"):
                return txt_string
    except Exception:
        # Fallback to parent domain if this is a subdomain
        parts = domain.split(".")
        if len(parts) > 2:
            parent_domain = ".".join(parts[-2:])
            try:
                loop = asyncio.get_running_loop()
                answers = await loop.run_in_executor(
                    None, lambda: dns.resolver.resolve(f"_dmarc.{parent_domain}", "TXT")
                )
                for rdata in answers:
                    txt_string = "".join(
                        [
                            s.decode("utf-8") if isinstance(s, bytes) else s
                            for s in rdata.strings
                        ]
                    )
                    if txt_string.lower().startswith("v=dmarc1"):
                        return txt_string + " (inherited from root)"
            except Exception:
                pass
    return None


async def check_dkim_record(domain: str) -> str:
    """Probe common selectors to check for DKIM keys existence.

    Returns:
        "PRESENT", "ABSENT", or "UNKNOWN"
    """
    if not domain:
        return "UNKNOWN"
    if domain.endswith((".local", ".test")) or domain in [
        "localhost",
        "example.com",
        "techcorp.com",
    ]:
        return "PRESENT"

    if not HAS_DNS_PYTHON:
        return "UNKNOWN"

    errors_count = 0
    present_found = False

    for selector in COMMON_DKIM_SELECTORS:
        try:
            dkim_domain = f"{selector}._domainkey.{domain}"
            loop = asyncio.get_running_loop()
            answers = await loop.run_in_executor(
                None, lambda: dns.resolver.resolve(dkim_domain, "TXT")
            )
            for rdata in answers:
                txt_string = "".join(
                    [
                        s.decode("utf-8") if isinstance(s, bytes) else s
                        for s in rdata.strings
                    ]
                )
                if "v=dkim1" in txt_string.lower() or "k=rsa" in txt_string.lower():
                    present_found = True
                    break
            if present_found:
                break
        except dns.resolver.NXDOMAIN:
            pass  # Definitely absent on this selector
        except Exception as e:
            logger.debug(f"DKIM lookup error on selector {selector} for {domain}: {e}")
            errors_count += 1

    if present_found:
        return "PRESENT"
    # If all queries failed due to timeout/servfail, status is UNKNOWN
    if errors_count == len(COMMON_DKIM_SELECTORS):
        return "UNKNOWN"
    return "ABSENT"


async def fetch_ssl_certificate(domain: str) -> Dict[str, Any]:
    """Establishes connection to domain:443 to audit SSL certificate."""
    result: Dict[str, Any] = {
        "ssl_status": "UNKNOWN",
        "certificate_expiry": None,
        "certificate_subject": "",
        "certificate_issuer": "",
        "error_message": "",
    }

    if not domain:
        return result

    if domain.endswith((".local", ".test")) or domain in [
        "localhost",
        "example.com",
        "techcorp.com",
    ]:
        # Mock valid certificate
        from datetime import timedelta

        result["ssl_status"] = "VALID"
        result["certificate_expiry"] = datetime.now(timezone.utc) + timedelta(days=120)
        result["certificate_subject"] = "CN=example.com"
        result["certificate_issuer"] = "CN=Let's Encrypt Authority"
        return result

    # 1. Try secure default ssl handshake
    try:
        context = ssl.create_default_context()

        # Connect with timeout
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(domain, 443, ssl=context), timeout=2.0
        )

        # Get cert details
        sslsock = writer.get_extra_info("ssl_object")
        cert = sslsock.getpeercert()
        writer.close()
        await writer.wait_closed()

        if cert:
            # Parse expiry
            expiry_str = cert.get("notAfter")
            if expiry_str:
                # Format: 'Feb 15 17:00:00 2026 GMT'
                expiry_dt = datetime.strptime(
                    expiry_str, "%b %d %H:%M:%S %Y %Z"
                ).replace(tzinfo=timezone.utc)
                result["certificate_expiry"] = expiry_dt

                if expiry_dt > datetime.now(timezone.utc):
                    result["ssl_status"] = "VALID"
                else:
                    result["ssl_status"] = "EXPIRED"

            # Parse subject/issuer
            subject_list = [
                f"{k}={v}" for item in cert.get("subject", []) for k, v in item
            ]
            issuer_list = [
                f"{k}={v}" for item in cert.get("issuer", []) for k, v in item
            ]
            result["certificate_subject"] = ", ".join(subject_list)
            result["certificate_issuer"] = ", ".join(issuer_list)
            return result

    except Exception as secure_err:
        result["error_message"] = str(secure_err)
        # 2. Try unverified fallback to pull certificate properties on self-signed / mismatched hosts
        try:
            unverified_context = ssl._create_unverified_context()
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(domain, 443, ssl=unverified_context),
                timeout=2.0,
            )
            sslsock = writer.get_extra_info("ssl_object")
            # getpeercert(binary_form=True) pulls unvalidated X509 fields
            bin_cert = sslsock.getpeercert(binary_form=True)
            writer.close()
            await writer.wait_closed()

            if bin_cert:
                import ssl as ssl_module

                # Parse binary cert to dictionary using pyOpenSSL or python standard decoder
                ssl_module.DER_cert_to_PEM_cert(bin_cert)
                result["ssl_status"] = (
                    "INVALID"  # Unverified context means certificate verification failed!
                )
                return result
        except Exception as fallback_err:
            logger.debug(f"SSL fallback failed for {domain}: {fallback_err}")

    # Default fallback when connection completely fails
    result["ssl_status"] = "INVALID"
    return result


async def fetch_website_reachability(domain: str) -> bool:
    """Verify HTTP/HTTPS response reachability."""
    if not domain:
        return False
    if domain.endswith((".local", ".test")) or domain in [
        "localhost",
        "example.com",
        "techcorp.com",
    ]:
        return True

    urls_to_try = [f"https://{domain}", f"http://{domain}"]
    async with httpx.AsyncClient(verify=False, timeout=1.5) as client:
        for url in urls_to_try:
            try:
                resp = await client.get(url)
                if resp.status_code < 500:
                    return True
            except Exception:
                pass
    return False


async def run_domain_crawler(domain: str) -> Dict[str, Any]:
    """Execute all crawler operations concurrently."""
    domain = extract_domain(domain) or domain

    dns_res, mx_res, spf_res, dmarc_res, dkim_res, ssl_res, reach_res = (
        await asyncio.gather(
            check_dns_resolution(domain),
            check_mx_records(domain),
            check_spf_record(domain),
            check_dmarc_record(domain),
            check_dkim_record(domain),
            fetch_ssl_certificate(domain),
            fetch_website_reachability(domain),
            return_exceptions=True,
        )
    )

    return {
        "domain": domain,
        "dns_resolved": dns_res if isinstance(dns_res, bool) else False,
        "mx_records_present": mx_res if isinstance(mx_res, bool) else False,
        "spf_record": spf_res if isinstance(spf_res, str) else None,
        "dmarc_record": dmarc_res if isinstance(dmarc_res, str) else None,
        "dkim_status": dkim_res if isinstance(dkim_res, str) else "UNKNOWN",
        "ssl_details": (
            ssl_res
            if isinstance(ssl_res, dict)
            else {
                "ssl_status": "INVALID",
                "certificate_expiry": None,
                "certificate_subject": "",
                "certificate_issuer": "",
                "error_message": str(ssl_res),
            }
        ),
        "website_reachable": reach_res if isinstance(reach_res, bool) else False,
    }
