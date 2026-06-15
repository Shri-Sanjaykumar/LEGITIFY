from typing import List, Dict, Any, Tuple
from app.services.trust_engine.constants import BASE_TRUST_SCORE


def calculate_scores(
    fired_rules: List[Dict[str, Any]],
) -> Tuple[float, float, str, int]:
    """Calculate trust score, risk score, risk level, and confidence score.

    Ensures score clamping and that low confidence signals alone cannot trigger
    high risk.
    """
    trust_score = BASE_TRUST_SCORE

    for rule in fired_rules:
        # score_change is already negative for deductions
        trust_score += rule["score_change"]

    # Clamp trust score strictly between 0 and 100
    trust_score = max(0.0, min(100.0, float(trust_score)))
    risk_score = 100.0 - trust_score

    # Determine risk level based on the trust score
    if trust_score >= 70.0:
        risk_level = "low"
    elif trust_score >= 40.0:
        risk_level = "medium"
    elif trust_score >= 15.0:
        risk_level = "high"
    else:
        risk_level = "critical"

    # Scoring Principle Check: Never classify as High/Critical Risk from a single LOW confidence signal
    if risk_level in {"high", "critical"}:
        # Count high and medium confidence deductions
        severe_signals = [
            r
            for r in fired_rules
            if r["score_change"] < 0 and r["confidence"] in {"HIGH", "MEDIUM"}
        ]
        # If there are no severe signals (only low confidence ones), override risk level to medium
        if not severe_signals:
            risk_level = "medium"

    # Calculate average confidence score for the report
    if fired_rules:
        conf_map = {"HIGH": 95, "MEDIUM": 75, "LOW": 50}
        total_conf = sum(conf_map.get(rule["confidence"], 75) for rule in fired_rules)
        confidence_score = int(total_conf / len(fired_rules))
    else:
        confidence_score = 90  # Default confidence when no rules fired

    return trust_score, risk_score, risk_level, confidence_score


def generate_summary(
    fired_rules: List[Dict[str, Any]], trust_score: float, risk_level: str
) -> str:
    """Generate an explainable markdown summary of the trust engine's analysis."""
    negatives = [r for r in fired_rules if r["score_change"] < 0]

    risk_level_str = risk_level.upper()

    summary = (
        f"### Trust Analysis Summary\n"
        f"This content was evaluated using LEGITIFY's rule-based trust intelligence engine v1. "
        f"A trust score of **{trust_score:.1f}/100** was determined, resulting in a **{risk_level_str}** risk classification.\n\n"
    )

    if negatives:
        summary += "#### Key Risk Factors Identified:\n"
        for rule in negatives:
            # Skip age unknown marker to keep summary clean
            if rule["rule_name"] == "DOMAIN_AGE_UNKNOWN":
                continue
            conf_icon = (
                "🔴"
                if rule["confidence"] == "HIGH"
                else ("🟡" if rule["confidence"] == "MEDIUM" else "⚪")
            )
            summary += f"- {conf_icon} **{rule['rule_name'].replace('_', ' ').title()}** ({rule['confidence']} Confidence, Impact: {rule['score_change']:.1f}): {rule.get('reason', '')}\n"
    else:
        summary += "🟢 No significant risk signals were detected in the provided input details. All analyzed metadata and text parameters appear normal.\n"

    return summary
