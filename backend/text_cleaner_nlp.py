import re
import spacy
from typing import Dict, Any

# Carregar modelo spaCy português (baixe com: python -m spacy download pt_core_news_sm)
nlp = spacy.load("pt_core_news_sm")

def clean_and_split_sections_nlp(text: str) -> Dict[str, Any]:
    seções = {"fatos": "", "partes": [], "assuntos": []}
    # Heurística: identificar títulos por regex e por entidades
    # 1. Procurar títulos clássicos
    titulos = list(re.finditer(r"(?i)(dos fatos|fatos|das partes|partes|assunto[s]?|matéria|dos pedidos|fundamentação|conclusão)[\s\n\r:.-]+", text))
    blocos = []
    for i, match in enumerate(titulos):
        start = match.end()
        end = titulos[i+1].start() if i+1 < len(titulos) else len(text)
        titulo = match.group(1).lower()
        blocos.append((titulo, text[start:end].strip()))
    for titulo, bloco in blocos:
        if "fato" in titulo:
            seções["fatos"] += bloco + "\n"
        elif "parte" in titulo:
            seções["partes"].extend([ent.text for ent in nlp(bloco).ents if ent.label_ in ["PER", "ORG"]])
        elif "assunto" in titulo or "matéria" in titulo:
            seções["assuntos"].append({"description": bloco[:200]})
    # NLP extra: buscar nomes próprios e organizações no texto todo se partes estiver vazio
    if not seções["partes"]:
        seções["partes"] = [ent.text for ent in nlp(text).ents if ent.label_ in ["PER", "ORG"]]
    return seções
