from typing import List, Dict, Any


def generate_recommendations(
    fired_rules: List[Dict[str, Any]], trust_score: float
) -> List[str]:
    """Dynamically generate recommendations based on the rules that fired and the final trust score."""
    recommendations = []

    # Check for rule-specific flags
    rule_names = {rule["rule_name"] for rule in fired_rules}

    # 1. Payment or training fee requests (critical)
    payment_rules = {
        "PAYMENT_REQUESTED",
        "SECURITY_DEPOSIT_REQUESTED",
        "TRAINING_FEE_REQUESTED",
    }
    if rule_names.intersection(payment_rules):
        recommendations.append(
            "Do not send any payment under any circumstances. Legitimate hiring processes never charge candidates for registration, security deposits, or training materials."
        )

    # 2. Free Email Recruiters
    if "FREE_EMAIL_RECRUITER" in rule_names:
        recommendations.append(
            "Request the recruiter to communicate via their official corporate email domain. Official company representatives do not conduct recruiting using free accounts (Gmail, Yahoo, etc.)."
        )

    # 3. Domain/Email Mismatches
    if "EMAIL_DOMAIN_MISMATCH" in rule_names:
        recommendations.append(
            "Verify the recruiter's official relationship with the company. The sender's email domain does not match the corporate domain listed on their official website."
        )

    # 4. Broken or Missing Website
    if "NO_COMPANY_WEBSITE" in rule_names or "BROKEN_WEBSITE" in rule_names:
        recommendations.append(
            "Verify the company's legal existence. The official website is either completely missing or failing to resolve via standard DNS checks."
        )

    # 5. Missing social / LinkedIn presence
    if "NO_LINKEDIN_PRESENCE" in rule_names:
        recommendations.append(
            "Verify the company's active headcount and business history. There is no professional company presence detected on LinkedIn."
        )

    # 6. Missing Signature blocks
    if "MISSING_SIGNATURE" in rule_names:
        recommendations.append(
            "Request a signed and stamped copy of the offer letter on official corporate letterhead featuring the signatory's corporate credentials."
        )

    # 7. Grammar / Quality issues
    if "GRAMMAR_ISSUES" in rule_names:
        recommendations.append(
            "Review the document spelling and layout quality. Standard corporate documentation undergoes review and rarely displays multiple grammatical errors."
        )

    # 8. Score-based generic guidelines
    if trust_score < 40:
        recommendations.append(
            "Contact the company's human resources department directly by searching for their official phone number on a public corporate directory (do not use any phone numbers or links provided inside the document itself)."
        )
    elif trust_score < 70:
        recommendations.append(
            "Cross-reference this offer on company review channels (like Glassdoor) or reach out to alumni who currently work there to verify the recruiter's validity."
        )
    else:
        recommendations.append(
            "Confirm receipt of the offer using standard company channels, but proceed with onboarding guidelines as normal."
        )

    return recommendations
