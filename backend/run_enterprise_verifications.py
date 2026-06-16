import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.services.domain_intelligence.engine import (
    start_domain_verification,
    execute_domain_verification_pipeline,
)
from app.services.company_verification.engine import (
    start_company_verification,
    execute_verification_pipeline as execute_company_verification_pipeline,
)
from app.services.recruiter_verification.engine import (
    start_recruiter_verification,
    execute_verification_pipeline as execute_recruiter_verification_pipeline,
)

from sqlalchemy.future import select
from app.models.user import User
from app.models.file import UploadedFile
from app.models.scan import Scan
from app.models.report import (
    Report,
    EvidenceItem,
    TrustScoreBreakdown,
    ReportHistory,
    CompanyVerification,
    CompanyVerificationBreakdown,
    DomainVerification,
)
from app.models.recruiter import (
    RecruiterVerification,
    RecruiterVerificationBreakdown,
    RecruiterVerificationEvidence,
    RecruiterReputationSnapshot,
)
from app.models.audit import AuditLog

COMPANIES = [
    {
        "name": "Microsoft",
        "website": "microsoft.com",
        "recruiter_email": "recruiter@microsoft.com",
        "recruiter_name": "Microsoft Recruiter",
    },
    {
        "name": "Google",
        "website": "google.com",
        "recruiter_email": "recruiter@google.com",
        "recruiter_name": "Google Recruiter",
    },
    {
        "name": "Amazon",
        "website": "amazon.com",
        "recruiter_email": "recruiter@amazon.com",
        "recruiter_name": "Amazon Recruiter",
    },
    {
        "name": "Infosys",
        "website": "infosys.com",
        "recruiter_email": "recruiter@infosys.com",
        "recruiter_name": "Infosys Recruiter",
    },
    {
        "name": "TCS",
        "website": "tcs.com",
        "recruiter_email": "recruiter@tcs.com",
        "recruiter_name": "TCS Recruiter",
    },
    {
        "name": "Accenture",
        "website": "accenture.com",
        "recruiter_email": "recruiter@accenture.com",
        "recruiter_name": "Accenture Recruiter",
    },
]

async def main():
    print("Starting Enterprise Verifications...")
    
    proof_lines = [
        "# REAL VERIFICATION PROOF",
        "",
        "This document lists the real, native (non-mocked) crawler verifications for the six target enterprise brands.",
        "",
    ]
    
    for comp in COMPANIES:
        name = comp["name"]
        domain = comp["website"]
        email = comp["recruiter_email"]
        rec_name = comp["recruiter_name"]
        
        print(f"\nVerifying {name} ({domain})...")
        
        async with SessionLocal() as db:
            # 1. Initialize Domain Verification
            dom_ver = await start_domain_verification(db, domain)
            dom_id = dom_ver.id
            
            # 2. Initialize Company Verification
            comp_ver = await start_company_verification(db, name, f"https://{domain}")
            comp_id = comp_ver.id
            
            # 3. Initialize Recruiter Verification
            rec_ver = await start_recruiter_verification(db, rec_name, email, name)
            rec_id = rec_ver.id
            
        # Run Pipelines
        print(f"  Running domain pipeline for {domain}...")
        await execute_domain_verification_pipeline(SessionLocal, dom_id)
        
        print(f"  Running company pipeline for {name}...")
        await execute_company_verification_pipeline(SessionLocal, comp_id)
        
        print(f"  Running recruiter pipeline for {email}...")
        await execute_recruiter_verification_pipeline(SessionLocal, rec_id)
        
        # Query and display result
        async with SessionLocal() as db:
            final_dom = (await db.execute(select(DomainVerification).where(DomainVerification.id == dom_id))).scalar()
            final_comp = (await db.execute(select(CompanyVerification).where(CompanyVerification.id == comp_id))).scalar()
            final_rec = (await db.execute(select(RecruiterVerification).where(RecruiterVerification.id == rec_id))).scalar()
            
            print(f"  Domain verification level: {final_dom.verification_level} (Score: {final_dom.verification_score})")
            print(f"  Company verification level: {final_comp.verification_level} (Score: {final_comp.verification_score})")
            print(f"  Recruiter verification level: {final_rec.verification_level} (Score: {final_rec.verification_score})")
            
            proof_lines.append(f"## {name} Verification Audit")
            proof_lines.append(f"- **Domain**: `{final_dom.domain}`")
            proof_lines.append(f"  - Status: `{final_dom.verification_status}`")
            proof_lines.append(f"  - Level: `{final_dom.verification_level}`")
            proof_lines.append(f"  - Score: `{final_dom.verification_score}/100`")
            proof_lines.append(f"  - DNS: `{final_dom.dns_status}` | MX: `{final_dom.mx_status}` | SPF: `{final_dom.spf_status}` | DMARC: `{final_dom.dmarc_status}`")
            proof_lines.append(f"  - SSL: `{final_dom.ssl_status}` (Expires: `{final_dom.certificate_expiry}`)")
            proof_lines.append(f"- **Company**: `{final_comp.company_name}`")
            proof_lines.append(f"  - Status: `{final_comp.verification_status}`")
            proof_lines.append(f"  - Level: `{final_comp.verification_level}`")
            proof_lines.append(f"  - Score: `{final_comp.verification_score}/100`")
            proof_lines.append(f"  - Trust Level: `{final_comp.verification_confidence}`")
            proof_lines.append(f"- **Recruiter**: `{final_rec.recruiter_name}` ({final_rec.recruiter_email})")
            proof_lines.append(f"  - Status: `{final_rec.verification_status}`")
            proof_lines.append(f"  - Level: `{final_rec.verification_level}`")
            proof_lines.append(f"  - Score: `{final_rec.verification_score}/100`")
            proof_lines.append(f"  - Company Match: `{final_rec.company_match_status}`")
            proof_lines.append(f"")
            proof_lines.append("---")
            proof_lines.append("")
            
    # Write docs/REAL_VERIFICATION_PROOF.md
    docs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
    os.makedirs(docs_dir, exist_ok=True)
    proof_path = os.path.join(docs_dir, "REAL_VERIFICATION_PROOF.md")
    with open(proof_path, "w", encoding="utf-8") as f:
        f.write("\n".join(proof_lines))
        
    print(f"Proof written to {proof_path}")

if __name__ == "__main__":
    asyncio.run(main())
