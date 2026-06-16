# Import all the models, so that Base has them before being
# imported by Alembic.
from app.db.base_class import Base  # noqa
from app.models.user import User, Session  # noqa
from app.models.file import UploadedFile  # noqa
from app.models.scan import Scan  # noqa
from app.models.report import (
    Report,  # noqa: F401
    TrustScore,  # noqa: F401
    EvidenceItem,  # noqa: F401
    ReportHistory,  # noqa: F401
    TrustScoreBreakdown,  # noqa: F401
    CompanyVerification,  # noqa: F401
    CompanyVerificationBreakdown,  # noqa: F401
    CompanyVerificationEvidence,  # noqa: F401
    DomainVerification,  # noqa: F401
    DomainVerificationBreakdown,  # noqa: F401
    DomainVerificationEvidence,  # noqa: F401
    DomainReputationSnapshot,  # noqa: F401
)
from app.models.recruiter import (
    RecruiterVerification,  # noqa: F401
    RecruiterVerificationBreakdown,  # noqa: F401
    RecruiterVerificationEvidence,  # noqa: F401
    RecruiterReputationSnapshot,  # noqa: F401
)
from app.models.audit import AuditLog  # noqa
