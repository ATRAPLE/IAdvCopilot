from typing import Dict, Any

def montar_json_modelo(dados: Dict[str, Any]) -> Dict[str, Any]:
    # Adapte conforme o modelo desejado
    return {
        "partes": dados.get("partes", []),
        "assuntos": dados.get("assuntos", []),
        "resumo_fatos": dados.get("resumo_fatos", "")
    }
