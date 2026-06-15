import os
import zipfile
import logging
import xml.etree.ElementTree as ET
from pypdf import PdfReader

logger = logging.getLogger("app.services.trust_engine.extractor")


def extract_text_from_txt(file_path: str) -> str:
    """Read a plain text file with utf-8 decoding fallback."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Failed to read TXT file {file_path}: {e}")
        return ""


def extract_text_from_docx(file_path: str) -> str:
    """Extract paragraphs text from DOCX document.xml without third party deps."""
    try:
        with zipfile.ZipFile(file_path) as z:
            doc_xml = z.read("word/document.xml")
        root = ET.fromstring(doc_xml)
        paragraphs = []
        for elem in root.iter():
            if elem.tag.endswith("}t"):
                paragraphs.append(elem.text or "")
        return " ".join(paragraphs)
    except Exception as e:
        logger.error(f"Failed to read DOCX file {file_path}: {e}")
        return ""


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF pages using pypdf. Falls back to ascii stream scan on error."""
    try:
        reader = PdfReader(file_path)
        pages_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
        return "\n".join(pages_text)
    except Exception as e:
        logger.error(f"Failed to read PDF file {file_path} using pypdf: {e}")
        try:
            with open(file_path, "rb") as f:
                content = f.read()
            return content.decode("utf-8", errors="ignore")
        except Exception as e_inner:
            logger.error(f"PDF raw binary fallback failed: {e_inner}")
            return ""


def extract_text(file_path: str) -> str:
    """Determine file extension and trigger appropriate extractor."""
    if not os.path.exists(file_path):
        logger.warning(f"File path does not exist: {file_path}")
        return ""

    ext = file_path.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        return extract_text_from_pdf(file_path)
    elif ext == "docx":
        return extract_text_from_docx(file_path)
    elif ext == "txt":
        return extract_text_from_txt(file_path)
    else:
        return extract_text_from_txt(file_path)
