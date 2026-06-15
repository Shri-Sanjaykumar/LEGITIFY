"""
Report State Machine – single source of truth for status transitions.

Transition Matrix:
  DRAFT      -> GENERATING | FAILED
  GENERATING -> COMPLETED  | FAILED
  FAILED     -> GENERATING  (retry)
  COMPLETED  -> ARCHIVED

Immutability Rule:
  A COMPLETED report's scored fields (trust_score, risk_score,
  confidence_score, summary, recommendation) are locked and cannot be
  modified. Any attempt raises a ValueError.
"""

from typing import Dict, Set

# Allowed next states for each current state
_ALLOWED_TRANSITIONS: Dict[str, Set[str]] = {
    "DRAFT": {"GENERATING", "FAILED"},
    "GENERATING": {"COMPLETED", "FAILED"},
    "FAILED": {"GENERATING"},
    "COMPLETED": {"ARCHIVED"},
    "ARCHIVED": set(),
}

# Fields that become immutable once a report reaches COMPLETED
IMMUTABLE_FIELDS_WHEN_COMPLETED = {
    "trust_score",
    "risk_score",
    "confidence_score",
    "summary",
    "recommendation",
}


def validate_transition(current_status: str, target_status: str) -> None:
    """
    Validate that the requested status transition is legal.

    Raises:
        ValueError: If the transition is not allowed.
    """
    allowed = _ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise ValueError(
            f"Invalid status transition: '{current_status}' -> '{target_status}'. "
            f"Allowed transitions from '{current_status}': {allowed or 'none'}."
        )


def assert_mutable(current_status: str, fields_being_modified: Set[str]) -> None:
    """
    Assert that a COMPLETED report's immutable fields are not being modified.

    Raises:
        ValueError: If an immutable field is targeted on a COMPLETED report.
    """
    if current_status == "COMPLETED":
        locked = fields_being_modified & IMMUTABLE_FIELDS_WHEN_COMPLETED
        if locked:
            raise ValueError(
                f"Report is completed and immutable. "
                f"Cannot modify: {sorted(locked)}."
            )
