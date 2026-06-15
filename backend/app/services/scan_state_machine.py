from fastapi import HTTPException, status

# Centralized State Machine Transition Map
# Extensible configuration supporting future states (e.g. CANCELLED, RETRYING, ARCHIVED)
VALID_TRANSITIONS = {
    "PENDING": {"QUEUED", "PROCESSING", "FAILED"},
    "QUEUED": {"PROCESSING"},
    "PROCESSING": {"COMPLETED", "FAILED"},
    "COMPLETED": set(),
    "FAILED": set(),
}


def validate_transition(current_status: str, new_status: str) -> None:
    """
    Validates scan status transitions.
    Raises HTTPException 400 Bad Request if the transition is invalid.
    """
    if current_status not in VALID_TRANSITIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown current scan status: '{current_status}'"
        )
        
    if new_status not in VALID_TRANSITIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown target scan status: '{new_status}'"
        )

    if current_status == new_status:
        return  # No-op for identical status updates

    allowed_targets = VALID_TRANSITIONS[current_status]
    if new_status not in allowed_targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition: '{current_status}' -> '{new_status}'"
        )
