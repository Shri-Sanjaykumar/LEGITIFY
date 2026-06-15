# Import all the models, so that Base has them before being
# imported by Alembic.
from app.db.base_class import Base # noqa
from app.models.user import User, Session # noqa
from app.models.file import UploadedFile # noqa
from app.models.scan import Scan # noqa
from app.models.report import Report, TrustScore, EvidenceItem # noqa
from app.models.audit import AuditLog # noqa
