from typing import Dict, Any

def montar_json_modelo(dados: Dict[str, Any]) -> Dict[str, Any]:
    resultado = {
        "partes": dados.get("partes", []),
        "assuntos": dados.get("assuntos", []),
        "resumo_fatos": dados.get("resumo_fatos", "")
    }
    if "analise_imagem_pagina2" in dados:
        resultado["analise_imagem_pagina2"] = dados["analise_imagem_pagina2"]
    if "custos_ia" in dados:
        resultado["custos_ia"] = dados["custos_ia"]
    return resultado
