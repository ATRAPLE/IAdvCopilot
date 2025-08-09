import re
from typing import Dict, Any

def clean_and_split_sections(text: str) -> Dict[str, Any]:
    seções = {"fatos": "", "partes": [], "assuntos": []}
    # Fatos
    fatos = re.search(r"(?i)(dos fatos|fatos)(.*?)(dos pedidos|dos fundamentos|fundamentação|conclusão|$)", text, re.DOTALL)
    if fatos:
        seções["fatos"] = fatos.group(2).strip()

    # Partes (busca nomes, tipos e papéis)
    partes = re.findall(r"(?i)(autor|réu|exequente|executado|requerente|requerido|apelante|apelado|impetrante|impetrado|agravante|agravado)[\s:.-]+([A-ZÁ-Úa-zá-ú\s\.,\-\']+)", text)
    partes_normalizadas = set()
    partes_unicas = []
    for papel, nome in partes:
        papel_norm = papel.strip().capitalize()
        nome_norm = " ".join(nome.strip().split())
        chave = f"{papel_norm}:{nome_norm.lower()}"
        if chave not in partes_normalizadas:
            partes_normalizadas.add(chave)
            partes_unicas.append({"role": papel_norm, "name": nome_norm})
    seções["partes"] = partes_unicas

    # Assuntos (busca por palavras-chave comuns)
    assuntos = re.findall(r"(?i)(assunto[s]?|matéria)[\s:.-]+([A-ZÁ-Úa-zá-ú\s\.,\-\']+)", text)
    assuntos_normalizados = set()
    assuntos_unicos = []
    for _, assunto in assuntos:
        assunto_norm = " ".join(assunto.strip().split())
        chave = assunto_norm.lower()
        if chave not in assuntos_normalizados:
            assuntos_normalizados.add(chave)
            assuntos_unicos.append({"description": assunto_norm})
    seções["assuntos"] = assuntos_unicos

    return seções
