import os

from openai import OpenAI
from dotenv import load_dotenv


load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY não encontrada. Verifique seu arquivo .env")
client = OpenAI(api_key=api_key)

def resumir_texto(texto: str, max_tokens: int = 2048) -> str:
    if not texto:
        return "Texto não encontrado."
    prompt = f"Resuma o texto jurídico a seguir de forma objetiva, numerada e clara:\n\n{texto}"
    try:
        resposta = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=max_tokens
        )
        return resposta.choices[0].message.content.strip()
    except Exception as e:
        return f"Erro ao resumir: {e}"

def resumir_em_chunks(texto: str, chunk_size: int = 4000, max_tokens: int = 2048) -> str:
    chunks = [texto[i:i+chunk_size] for i in range(0, len(texto), chunk_size)]
    resumos = [resumir_texto(chunk, max_tokens) for chunk in chunks]
    return "\n".join(resumos)
