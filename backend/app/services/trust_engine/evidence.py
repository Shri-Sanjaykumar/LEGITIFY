from typing import List, Dict, Any


def map_rule_to_evidence(rule: Dict[str, Any]) -> Dict[str, Any]:
    """Map rule properties (confidence, score_change, category) to database-compatible EvidenceItem structure."""
    # Map category to type
    category_map = {
        "DOMAIN_SIGNALS": "DOMAIN",
        "COMPANY_SIGNALS": "COMPANY",
        "RECRUITER_SIGNALS": "RECRUITER",
        "DOCUMENT_SIGNALS": "DOCUMENT",
        "CONTACT_SIGNALS": "EMAIL",
        "SOCIAL_SIGNALS": "LINKEDIN",
    }
    evidence_type = category_map.get(rule["rule_category"], "DOCUMENT")

    # Map confidence to float
    conf_map = {"HIGH": 0.95, "MEDIUM": 0.75, "LOW": 0.50}
    confidence_val = conf_map.get(rule["confidence"], 0.5)

    # Map score change to severity
    score_change = rule["score_change"]
    if score_change > 0:
        severity = "INFO"
    elif score_change >= -10.0:
        severity = "LOW"
    elif score_change >= -20.0:
        severity = "MEDIUM"
    elif score_change >= -35.0:
        severity = "HIGH"
    else:
        severity = "CRITICAL"

    # Title mapping
    title = rule["rule_name"].replace("_", " ").title()

    return {
        "evidence_type": evidence_type,
        "title": title,
        "description": rule["reason"],
        "severity": severity,
        "confidence": confidence_val,
        "source": rule["source"],
    }


def compile_evidence(fired_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compile rules list to evidence item inputs."""
    evidence_items = []
    for rule in fired_rules:
        # Ignore DOMAIN_AGE_UNKNOWN for evidence logs as it has no score impact
        if rule["rule_name"] == "DOMAIN_AGE_UNKNOWN":
            continue
        evidence_items.append(map_rule_to_evidence(rule))
    return evidence_items
