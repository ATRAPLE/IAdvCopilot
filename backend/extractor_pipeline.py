import pdfplumber
import pytesseract
from pdf2image import convert_from_path
import fitz  # PyMuPDF
from pdfminer.high_level import extract_text as pdfminer_extract_text
from PIL import Image
import os

def extract_text_pipeline(pdf_path: str) -> dict:
    # 1. Tentar extrair com pdfplumber, separando tabelas da página 2 e texto corrido das demais
    try:
        with pdfplumber.open(pdf_path) as pdf:
            assuntos = []
            partes_representantes = {"autor": [], "acusado": [], "mp": []}
            informacoes_adicionais = {}
            tables_p2_raw = []
            if len(pdf.pages) > 1:
                page2 = pdf.pages[1]
                tables = page2.extract_tables()
                for table in tables:
                    if table and len(table) > 1:
                        tables_p2_raw.append(table)
            # Processar tabelas para identificar blocos
            for table in tables_p2_raw:
                # Detectar "Assuntos"
                if any("Assuntos" in (cell or "") for cell in table[0]):
                    for row in table[1:]:
                        if len(row) >= 3:
                            assuntos.append({
                                "codigo": row[0],
                                "descricao": row[1],
                                "principal": row[2]
                            })
                # Detectar "Partes e Representantes"
                elif any("Partes" in (cell or "") for cell in table[0]):
                    # Procurar por "AUTOR", "ACUSADO", "MP" nas linhas
                    current_section = None
                    for row in table:
                        row_str = " ".join([str(cell) for cell in row if cell])
                        if "AUTOR" in row_str:
                            current_section = "autor"
                            continue
                        if "ACUSADO" in row_str:
                            current_section = "acusado"
                            continue
                        if "MP" in row_str:
                            current_section = "mp"
                            continue
                        if current_section and any(cell for cell in row):
                            partes_representantes[current_section].append(row_str)
                # Detectar "Informações Adicionais"
                elif any("Informações Adicionais" in (cell or "") for cell in table[0]):
                    for row in table[1:]:
                        if len(row) >= 2 and row[0]:
                            chave = row[0].strip().replace(":", "")
                            valor = row[1].strip() if row[1] else ""
                            informacoes_adicionais[chave] = valor
            # Texto corrido das demais páginas (exceto página 2)
            text_rest = ""
            for i, page in enumerate(pdf.pages):
                if i != 1:
                    text_rest += page.extract_text() or ""
        if text_rest.strip() or assuntos or partes_representantes["autor"] or partes_representantes["acusado"] or partes_representantes["mp"] or informacoes_adicionais:
            return {
                "method": "pdfplumber",
                "text": text_rest,
                "assuntos": assuntos,
                "partes_representantes": partes_representantes,
                "informacoes_adicionais": informacoes_adicionais,
                "tables_p2_raw": tables_p2_raw
            }
    except Exception:
        pass
    # 2. Tentar extrair com PyMuPDF (fitz)
    try:
        doc = fitz.open(pdf_path)
        text = " ".join([page.get_text("blocks") for page in doc])
        if text.strip():
            return {"method": "pymupdf", "text": text}
    except Exception:
        pass
    # 3. Tentar extrair com pdfminer
    try:
        text = pdfminer_extract_text(pdf_path)
        if text.strip():
            return {"method": "pdfminer", "text": text}
    except Exception:
        pass
    # 4. Se tudo falhar, usar OCR (pytesseract)
    try:
        images = convert_from_path(pdf_path)
        text = ""
        for img in images:
            text += pytesseract.image_to_string(img, lang="por")
        if text.strip():
            return {"method": "ocr", "text": text}
    except Exception:
        pass
    return {"method": "none", "text": ""}
