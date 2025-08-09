
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from tempfile import NamedTemporaryFile
import json

from extractor_pipeline import extract_text_pipeline
from text_cleaner import clean_and_split_sections
from text_cleaner_nlp import clean_and_split_sections_nlp
from resumo_ai import resumir_em_chunks
from json_model import montar_json_modelo
from starlette.concurrency import run_in_threadpool

app = FastAPI()

# Permitir acesso do frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Novo endpoint: pré-processamento (extração, seções, prompt)
@app.post("/api/process-pdf/")
async def process_pdf(file: UploadFile = File(...)):
    with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        def pipeline():
            extracao = extract_text_pipeline(tmp_path)
            texto = extracao["text"]
            metodo = extracao["method"]
            assuntos = extracao.get("assuntos", [])
            partes_representantes = extracao.get("partes_representantes", {})
            informacoes_adicionais = extracao.get("informacoes_adicionais", {})
            tables_p2_raw = extracao.get("tables_p2_raw", [])
            secoes = clean_and_split_sections(texto)
            secoes_nlp = clean_and_split_sections_nlp(texto)
            fatos = secoes.get("fatos", "")
            prompt = f"Você é um estagiário jurídico. Leia a seção 'Dos Fatos' abaixo e produza um resumo claro e organizado dos eventos principais relatados:\n\n{fatos}\n\nResuma os fatos de forma objetiva e numerada, com linguagem jurídica simples."
            return {
                "textoExtraido": texto[:10000],
                "metodoExtracao": metodo,
                "secoes": secoes,
                "secoesNLP": secoes_nlp,
                "assuntos": assuntos,
                "partesRepresentantes": partes_representantes,
                "informacoesAdicionais": informacoes_adicionais,
                "tabelasPagina2Raw": tables_p2_raw,
                "prompt": prompt
            }
        preIA = await run_in_threadpool(pipeline)
        return {"preIA": preIA}
    finally:
        os.remove(tmp_path)

# Novo endpoint: processamento IA
@app.post("/api/process-ia/")
async def process_ia(payload: dict):
    from resumo_ai import resumir_texto
    secoes = payload.get("secoes", {})
    prompt = payload.get("prompt", "")
    fatos = secoes.get("fatos", "")
    resumo_fatos = await run_in_threadpool(lambda: resumir_texto(fatos))
    dados = {**secoes, "resumo_fatos": resumo_fatos}
    json_data = montar_json_modelo(dados)
    with NamedTemporaryFile(delete=False, suffix=".json", mode="w", encoding="utf-8") as json_tmp:
        json.dump(json_data, json_tmp, ensure_ascii=False, indent=2)
        json_tmp_path = json_tmp.name
    return {"data": json_data, "download_url": f"/api/download-json/?path={json_tmp_path}"}

@app.get("/api/download-json/")
def download_json(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    return FileResponse(path, filename="processo.json", media_type="application/json")
