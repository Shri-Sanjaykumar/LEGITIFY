import asyncio
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from sqlalchemy.future import select

# Import all models to ensure registries are fully populated
from app.models.user import User, Session
from app.models.file import UploadedFile
from app.models.scan import Scan
from app.models.report import Report, EvidenceItem, ReportHistory
from app.models.audit import AuditLog

async def seed():
    async with SessionLocal() as db:
        # Check if admin already exists
        admin_res = await db.execute(select(User).where(User.email == "admin@legitify.io"))
        admin = admin_res.scalars().first()
        if not admin:
            admin = User(
                email="admin@legitify.io",
                password_hash=get_password_hash("Admin@1234"),
                full_name="Legitify Administrator",
                role="admin",
                is_active=True
            )
            db.add(admin)
            print("Admin user seeded: admin@legitify.io / Admin@1234")
        else:
            print("Admin user already exists.")

        # Check if student already exists
        student_res = await db.execute(select(User).where(User.email == "student@legitify.io"))
        student = student_res.scalars().first()
        if not student:
            student = User(
                email="student@legitify.io",
                password_hash=get_password_hash("Student@1234"),
                full_name="Sanjay Kumar",
                role="student",
                is_active=True
            )
            db.add(student)
            print("Student user seeded: student@legitify.io / Student@1234")
        else:
            print("Student user already exists.")

        await db.commit()

if __name__ == "__main__":
    asyncio.run(seed())
