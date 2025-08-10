

import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
from tempfile import NamedTemporaryFile
import json
from pdf2image import convert_from_path

from extractor_pipeline import extract_text_pipeline
from text_cleaner import clean_and_split_sections
from text_cleaner_nlp import clean_and_split_sections_nlp
from resumo_ai import resumir_em_chunks
from json_model import montar_json_modelo
from starlette.concurrency import run_in_threadpool


# Configurar logging
logging.basicConfig(level=logging.INFO)
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
            # Geração da imagem da página 2
            imagem_pagina2_path = None
            try:
                logging.info(f"Tentando converter página 2 do PDF em imagem: {tmp_path}")
                images = convert_from_path(tmp_path, first_page=2, last_page=2, fmt="jpeg")
                logging.info(f"Resultado convert_from_path: {images}")
                if images:
                    img_tmp = NamedTemporaryFile(delete=False, suffix=".jpg")
                    images[0].save(img_tmp, "JPEG")
                    imagem_pagina2_path = img_tmp.name
                    logging.info(f"Imagem da página 2 salva em: {imagem_pagina2_path}")
                else:
                    logging.warning("Nenhuma imagem retornada para a página 2.")
            except Exception as e:
                logging.error(f"Erro ao converter página 2 em imagem: {e}")
                imagem_pagina2_path = None
            return {
                "textoExtraido": texto[:10000],
                "metodoExtracao": metodo,
                "secoes": secoes,
                "secoesNLP": secoes_nlp,
                "assuntos": assuntos,
                "partesRepresentantes": partes_representantes,
                "informacoesAdicionais": informacoes_adicionais,
                "tabelasPagina2Raw": tables_p2_raw,
                "imagemPagina2": imagem_pagina2_path,
                "prompt": prompt
            }
        preIA = await run_in_threadpool(pipeline)
        return {"preIA": preIA}
    finally:
        os.remove(tmp_path)
# Endpoint para servir a imagem da página 2
@app.get("/api/pagina2-img/")
def get_pagina2_img(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    return FileResponse(path, media_type="image/jpeg", filename="pagina2.jpg")

# Novo endpoint: processamento IA

import base64
import mimetypes
from openai import OpenAI

@app.post("/api/process-ia/")
async def process_ia(payload: dict):
    # Suporte multimodal: se imagemPagina2 estiver presente, envia para OpenAI Vision
    prompt = payload.get("prompt", "")
    secoes = payload.get("secoes", {})
    imagem_pagina2 = payload.get("imagemPagina2")
    multimodal_result = None
    custos_ia = {}
    custos_texto = {}
    if imagem_pagina2 and os.path.exists(imagem_pagina2):
        # Tamanho da imagem em bytes e KB
        img_size_bytes = os.path.getsize(imagem_pagina2)
        img_size_kb = round(img_size_bytes / 1024, 2)
        # Lê a imagem como base64
        with open(imagem_pagina2, "rb") as img_file:
            img_bytes = img_file.read()
            img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        mime_type = mimetypes.guess_type(imagem_pagina2)[0] or "image/jpeg"
        # Prompt fixo para multimodal
        vision_prompt = [
            {"type": "text", "text": "IA, você deve agir como um estagiário de direito, e extrair de forma organizada e lógica toda a informação presente na imagem."},
            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{img_b64}"}}
        ]
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY não encontrada. Verifique seu arquivo .env")
        client = OpenAI(api_key=api_key)
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": vision_prompt}],
                max_tokens=2048
            )
            multimodal_result = response.choices[0].message.content.strip()
            # Estimativa de tokens e custos
            usage = getattr(response, 'usage', None)
            if usage:
                prompt_tokens = usage.prompt_tokens
                completion_tokens = usage.completion_tokens
                total_tokens = usage.total_tokens
            else:
                # fallback: estimativa
                prompt_tokens = 1000  # estimativa média para imagem
                completion_tokens = 1000
                total_tokens = 2000
            # Preços fictícios (ajuste conforme OpenAI)
            preco_entrada = 0.005  # $/mil tokens
            preco_saida = 0.015    # $/mil tokens
            custo_entrada = (prompt_tokens / 1000) * preco_entrada
            custo_saida = (completion_tokens / 1000) * preco_saida
            custo_total = round(custo_entrada + custo_saida, 4)
            custos_ia = {
                "tipo": "imagem",
                "imagem_kb": img_size_kb,
                "imagem_bytes": img_size_bytes,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "custo_entrada_usd": round(custo_entrada, 4),
                "custo_saida_usd": round(custo_saida, 4),
                "custo_total_usd": custo_total
            }
        except Exception as e:
            import logging
            logging.error(f"Erro ao analisar imagem com IA: {e}")
            multimodal_result = f"Erro ao analisar imagem com IA: {e}"
            custos_ia = {"erro": str(e)}
    else:
        multimodal_result = "Imagem não enviada ou não encontrada."
        custos_ia = {}

    # Também executa o resumo tradicional dos fatos (texto)
    from resumo_ai import resumir_texto
    fatos = secoes.get("fatos", "")
    # Chamada OpenAI para resumo de texto, capturando usage
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)
    prompt_resumo = f"Resuma o texto jurídico a seguir de forma objetiva, numerada e clara:\n\n{fatos}"
    try:
        resposta = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt_resumo}],
            temperature=0.3,
            max_tokens=2048
        )
        resumo_fatos = resposta.choices[0].message.content.strip()
        usage = getattr(resposta, 'usage', None)
        if usage:
            prompt_tokens = usage.prompt_tokens
            completion_tokens = usage.completion_tokens
            total_tokens = usage.total_tokens
        else:
            prompt_tokens = 500
            completion_tokens = 500
            total_tokens = 1000
        preco_entrada = 0.005
        preco_saida = 0.015
        custo_entrada = (prompt_tokens / 1000) * preco_entrada
        custo_saida = (completion_tokens / 1000) * preco_saida
        custo_total = round(custo_entrada + custo_saida, 4)
        custos_texto = {
            "tipo": "texto",
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "custo_entrada_usd": round(custo_entrada, 4),
            "custo_saida_usd": round(custo_saida, 4),
            "custo_total_usd": custo_total
        }
    except Exception as e:
        resumo_fatos = f"Erro ao resumir: {e}"
        custos_texto = {"erro": str(e)}

    # Custo total do processamento IA
    custo_total_ia = 0.0
    if custos_ia.get("custo_total_usd"): custo_total_ia += custos_ia["custo_total_usd"]
    if custos_texto.get("custo_total_usd"): custo_total_ia += custos_texto["custo_total_usd"]

    custos_geral = {
        "texto": custos_texto,
        "imagem": custos_ia,
        "custo_total_ia_usd": round(custo_total_ia, 4)
    }
    dados = {**secoes, "resumo_fatos": resumo_fatos, "analise_imagem_pagina2": multimodal_result, "custos_ia": custos_geral}
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
