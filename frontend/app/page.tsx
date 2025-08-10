"use client";

import * as React from "react";
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  CircularProgress,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import axios from "axios";

function TabPanel(props: any) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = React.useState(0);
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any>(null);
  const [downloadUrl, setDownloadUrl] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");
  const [preIA, setPreIA] = React.useState<any>(null);
  const [showPreIA, setShowPreIA] = React.useState(false);
  const cancelTokenSource = React.useRef<any>(null);

  const handleTabChange = (_: any, newValue: number) => setTab(newValue);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setStatus("Enviando arquivo...");
    const formData = new FormData();
    formData.append("file", file);
    cancelTokenSource.current = axios.CancelToken.source();
    try {
      setStatus("Extraindo texto do PDF...");
      // Novo endpoint para pré-processamento (sem IA)
      const res = await axios.post(
        "http://localhost:8000/api/process-pdf/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          cancelToken: cancelTokenSource.current.token,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setStatus(
                `Enviando arquivo... (${Math.round(
                  (progressEvent.loaded / progressEvent.total) * 100
                )}%)`
              );
            }
          },
        }
      );
      // Espera resposta com texto extraído, seções e prompt
      setPreIA(res.data.preIA);
      setShowPreIA(true);
      setStatus(
        "Pré-processamento concluído. Confira as informações antes de enviar à IA."
      );
    } catch (err: any) {
      if (axios.isCancel(err)) {
        setError("Processamento cancelado pelo usuário.");
        setStatus("");
      } else {
        setError("Erro ao processar o PDF.");
        setStatus("");
      }
    } finally {
      setLoading(false);
    }
  };

  // Nova função para enviar à IA após confirmação
  // Função de polling para buscar atualização do JSON
  const pollForImageAnalysis = async (downloadUrl: string, maxTries = 20, interval = 3000) => {
    let tries = 0;
    while (tries < maxTries) {
      try {
        const res = await axios.get(downloadUrl);
        if (res.data && res.data.analise_imagem_pagina2) {
          setData(res.data);
          setStatus("Processamento concluído! Análise de imagem disponível.");
          return;
        } else {
          setData(res.data); // Atualiza o JSON bruto mesmo sem a análise
        }
      } catch (e) {
        // Ignora erros de polling
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
      tries++;
    }
    setStatus("Processamento concluído! (Análise de imagem não retornou a tempo)");
  };

  const handleSendToIA = async () => {
    if (!preIA) return;
    setLoading(true);
    setError("");
    setStatus("Enviando para IA...");
    try {
      const res = await axios.post(
        "http://localhost:8000/api/process-ia/",
        {
          prompt: preIA.prompt,
          secoes: preIA.secoes,
          imagemPagina2: preIA.imagemPagina2 || null,
        },
        { headers: { "Content-Type": "application/json" } }
      );
      setData(res.data.data);
      setDownloadUrl(res.data.download_url);
      setTab(0);
      setStatus("Processamento concluído! (Aguardando análise de imagem...)");
      setShowPreIA(false);
      // Inicia polling se houver download_url
      if (res.data.download_url) {
        pollForImageAnalysis(res.data.download_url);
      }
    } catch (err: any) {
      setError("Erro ao processar com IA.");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (cancelTokenSource.current) {
      cancelTokenSource.current.cancel("Operação cancelada pelo usuário.");
    }
    setLoading(false);
    setStatus("");
  };

  return (
    <Container maxWidth="md" sx={{ mt: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Processador de PDFs Jurídicos
        </Typography>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Button
            variant="contained"
            component="label"
            startIcon={<UploadFileIcon />}
            disabled={loading}
          >
            Selecionar PDF
            <input
              type="file"
              hidden
              accept="application/pdf"
              onChange={handleFileChange}
            />
          </Button>
          {file && (
            <Typography
              variant="body2"
              sx={{
                ml: 1,
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {file.name}
            </Typography>
          )}
          <Button
            variant="contained"
            color="success"
            onClick={handleUpload}
            disabled={!file || loading}
          >
            Enviar e Processar
          </Button>
          {loading && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleCancel}
              sx={{ ml: 1 }}
            >
              Parar
            </Button>
          )}
          {loading && <CircularProgress size={28} />}
        </Box>
        {status && (
          <Typography
            variant="body2"
            color={loading ? "text.secondary" : "success.main"}
            sx={{ mb: 2 }}
          >
            {status}
          </Typography>
        )}
        {error && <Typography color="error">{error}</Typography>}
        {/* Exibir informações pré-IA para conferência */}
        {showPreIA && preIA && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              border: "1px solid #ccc",
              borderRadius: 2,
              background: "#fafafa",
            }}
          >
            <Typography variant="h6">Texto extraído do PDF</Typography>
            <Box
              component="pre"
              sx={{
                maxHeight: 200,
                overflow: "auto",
                background: "#f5f5f5",
                p: 1,
                borderRadius: 1,
              }}
            >
              {preIA.textoExtraido}
            </Box>
            <Typography variant="h6" sx={{ mt: 2 }}>
              Seções identificadas (Heurística)
            </Typography>
            <Box
              component="pre"
              sx={{
                maxHeight: 120,
                overflow: "auto",
                background: "#f5f5f5",
                p: 1,
                borderRadius: 1,
              }}
            >
              {JSON.stringify(preIA.secoes, null, 2)}
            </Box>
            <Typography variant="h6" sx={{ mt: 2 }}>
              Seções identificadas (NLP)
            </Typography>
            <Box
              component="pre"
              sx={{
                maxHeight: 120,
                overflow: "auto",
                background: "#e3f2fd",
                p: 1,
                borderRadius: 1,
              }}
            >
              {JSON.stringify(preIA.secoesNLP, null, 2)}
            </Box>
            {/* Bloco: Assuntos */}
            {preIA.assuntos && preIA.assuntos.length > 0 && (
              <>
                <Typography variant="h6" sx={{ mt: 2 }}>
                  Assuntos
                </Typography>
                <Box sx={{ maxHeight: 160, overflow: "auto" }}>
                  <table style={{ width: "100%", background: "#fffde7" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Código</th>
                        <th style={{ textAlign: "left" }}>Descrição</th>
                        <th style={{ textAlign: "left" }}>Principal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preIA.assuntos.map((a: any, i: number) => (
                        <tr key={i}>
                          <td>{a.codigo}</td>
                          <td>{a.descricao}</td>
                          <td>{a.principal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </>
            )}
            {/* Bloco: Partes e Representantes */}
            {preIA.partesRepresentantes && (
              <>
                <Typography variant="h6" sx={{ mt: 2 }}>
                  Partes e Representantes
                </Typography>
                <Box
                  sx={{ background: "#f1f8e9", p: 1, borderRadius: 1, mb: 1 }}
                >
                  <strong>Autor:</strong>
                  <ul>
                    {preIA.partesRepresentantes.autor &&
                    preIA.partesRepresentantes.autor.length > 0 ? (
                      preIA.partesRepresentantes.autor.map(
                        (a: string, i: number) => <li key={i}>{a}</li>
                      )
                    ) : (
                      <li>-</li>
                    )}
                  </ul>
                  <strong>Acusado:</strong>
                  <ul>
                    {preIA.partesRepresentantes.acusado &&
                    preIA.partesRepresentantes.acusado.length > 0 ? (
                      preIA.partesRepresentantes.acusado.map(
                        (a: string, i: number) => <li key={i}>{a}</li>
                      )
                    ) : (
                      <li>-</li>
                    )}
                  </ul>
                  <strong>MP:</strong>
                  <ul>
                    {preIA.partesRepresentantes.mp &&
                    preIA.partesRepresentantes.mp.length > 0 ? (
                      preIA.partesRepresentantes.mp.map(
                        (a: string, i: number) => <li key={i}>{a}</li>
                      )
                    ) : (
                      <li>-</li>
                    )}
                  </ul>
                </Box>
              </>
            )}
            {/* Bloco: Informações Adicionais */}
            {preIA.informacoesAdicionais &&
              Object.keys(preIA.informacoesAdicionais).length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 2 }}>
                    Informações Adicionais
                  </Typography>
                  <Box
                    sx={{ background: "#e3e3e3", p: 1, borderRadius: 1, mb: 1 }}
                  >
                    <table style={{ width: "100%" }}>
                      <tbody>
                        {Object.entries(preIA.informacoesAdicionais).map(
                          ([k, v]: [string, any], i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{k}</td>
                              <td>{v}</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </Box>
                </>
              )}
            {/* Bloco: Tabelas brutas (debug) */}
            {preIA.tabelasPagina2Raw && preIA.tabelasPagina2Raw.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2 }}>
                  Tabelas brutas extraídas (debug)
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    maxHeight: 80,
                    overflow: "auto",
                    background: "#f5f5f5",
                    p: 1,
                    borderRadius: 1,
                  }}
                >
                  {JSON.stringify(preIA.tabelasPagina2Raw, null, 2)}
                </Box>
              </>
            )}
            <Typography variant="h6" sx={{ mt: 2 }}>
              Prompt para IA
            </Typography>
            <Box
              component="pre"
              sx={{ background: "#f5f5f5", p: 1, borderRadius: 1 }}
            >
              {preIA.prompt}
            </Box>
            <Button
              variant="contained"
              color="success"
              sx={{ mt: 2 }}
              onClick={handleSendToIA}
              disabled={loading}
            >
              Enviar para IA
            </Button>
          </Box>
        )}
        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Visualização" />
          <Tab label="JSON" />
          <Tab label="Página 2 (Imagem)" />
          <Tab label="Imagem->texto via IA" />
          <Tab label="Custos IA" />
        </Tabs>
        <TabPanel value={tab} index={3}>
          {data && data.analise_imagem_pagina2 ? (
            <Box sx={{ p: 2, background: "#f3e5f5", borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Resultado da Análise de Imagem via IA</Typography>
              <Typography sx={{ whiteSpace: "pre-line" }}>{data.analise_imagem_pagina2}</Typography>
            </Box>
          ) : (
            <Typography>Nenhum resultado de análise de imagem disponível.</Typography>
          )}
        </TabPanel>
        <TabPanel value={tab} index={4}>
          {data && data.custos_ia ? (
            <Box sx={{ p: 2, background: '#e3f2fd', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Custos do Processamento IA</Typography>
              {/* Custos do resumo de texto */}
              <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>Resumo de Texto (IA)</Typography>
              {data.custos_ia.texto && !data.custos_ia.texto.erro ? (
                <>
                  <Typography><b>Tokens de entrada (prompt):</b> {data.custos_ia.texto.prompt_tokens}</Typography>
                  <Typography><b>Tokens de saída (resposta):</b> {data.custos_ia.texto.completion_tokens}</Typography>
                  <Typography><b>Total de tokens:</b> {data.custos_ia.texto.total_tokens}</Typography>
                  <Typography><b>Custo entrada (USD):</b> ${data.custos_ia.texto.custo_entrada_usd}</Typography>
                  <Typography><b>Custo saída (USD):</b> ${data.custos_ia.texto.custo_saida_usd}</Typography>
                  <Typography><b>Custo total (USD):</b> <b>${data.custos_ia.texto.custo_total_usd}</b></Typography>
                </>
              ) : (
                <Typography color="error">{data.custos_ia.texto?.erro || 'Não disponível.'}</Typography>
              )}
              {/* Custos da análise de imagem */}
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Imagem-&gt;Texto (IA Multimodal)</Typography>
              {data.custos_ia.imagem && !data.custos_ia.imagem.erro ? (
                <>
                  <Typography><b>Tamanho da imagem:</b> {data.custos_ia.imagem.imagem_kb} KB ({data.custos_ia.imagem.imagem_bytes} bytes)</Typography>
                  <Typography><b>Tokens de entrada (prompt):</b> {data.custos_ia.imagem.prompt_tokens}</Typography>
                  <Typography><b>Tokens de saída (resposta):</b> {data.custos_ia.imagem.completion_tokens}</Typography>
                  <Typography><b>Total de tokens:</b> {data.custos_ia.imagem.total_tokens}</Typography>
                  <Typography><b>Custo entrada (USD):</b> ${data.custos_ia.imagem.custo_entrada_usd}</Typography>
                  <Typography><b>Custo saída (USD):</b> ${data.custos_ia.imagem.custo_saida_usd}</Typography>
                  <Typography><b>Custo total (USD):</b> <b>${data.custos_ia.imagem.custo_total_usd}</b></Typography>
                </>
              ) : (
                <Typography color="error">{data.custos_ia.imagem?.erro || 'Não disponível.'}</Typography>
              )}
              {/* Custo total geral */}
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}><b>Custo Total IA</b></Typography>
              <Typography><b>Total (USD):</b> <b>${data.custos_ia.custo_total_ia_usd || data.custos_ia.custo_total_usd || '-'}</b></Typography>
            </Box>
          ) : (
            <Typography>Nenhuma informação de custo disponível.</Typography>
          )}
        </TabPanel>
        <TabPanel value={tab} index={0}>
          {data ? (
            <Box>
              {/* Exemplo de visualização lógica dos dados extraídos */}
              <Typography variant="h6">Resumo dos Fatos</Typography>
              <Typography>{data.resumo_fatos || "-"}</Typography>
              <Typography variant="h6" sx={{ mt: 2 }}>
                Partes
              </Typography>
              <ul>
                {data.partes && data.partes.length > 0 ? (
                  data.partes.map((p: any, i: number) => (
                    <li key={i}>
                      {p.name} ({p.role})
                    </li>
                  ))
                ) : (
                  <li>-</li>
                )}
              </ul>
              <Typography variant="h6" sx={{ mt: 2 }}>
                Assuntos
              </Typography>
              <ul>
                {data.assuntos && data.assuntos.length > 0 ? (
                  data.assuntos.map((a: any, i: number) => (
                    <li key={i}>{a.description}</li>
                  ))
                ) : (
                  <li>-</li>
                )}
              </ul>
              {/* Exibir resultado da análise multimodal da imagem */}
              {data.analise_imagem_pagina2 && (
                <Box sx={{ mt: 3, p: 2, background: "#f3e5f5", borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Análise da Imagem da Página 2 (IA Multimodal)</Typography>
                  <Typography sx={{ whiteSpace: "pre-line" }}>{data.analise_imagem_pagina2}</Typography>
                </Box>
              )}
              {downloadUrl && (
                <Button
                  sx={{ mt: 2 }}
                  variant="outlined"
                  href={downloadUrl}
                  target="_blank"
                >
                  Baixar JSON
                </Button>
              )}
            </Box>
          ) : (
            <Typography>
              Envie um PDF para visualizar os dados extraídos.
            </Typography>
          )}
        </TabPanel>
        <TabPanel value={tab} index={1}>
          {data ? (
            <Box
              component="pre"
              sx={{
                background: "#f5f5f5",
                p: 2,
                borderRadius: 2,
                overflow: "auto",
              }}
            >
              {JSON.stringify(data, null, 2)}
            </Box>
          ) : (
            <Typography>
              Envie um PDF para visualizar o JSON extraído.
            </Typography>
          )}
        </TabPanel>
        <TabPanel value={tab} index={2}>
          {((preIA && preIA.imagemPagina2) || (data && data.imagemPagina2)) ? (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center">
              <Typography variant="h6" sx={{ mb: 2 }}>Página 2 do PDF (Imagem)</Typography>
              <img
                src={`http://localhost:8000/api/pagina2-img/?path=${encodeURIComponent(preIA?.imagemPagina2 || data?.imagemPagina2)}`}
                alt="Página 2 do PDF"
                style={{ maxWidth: "100%", border: "1px solid #ccc" }}
              />
            </Box>
          ) : (
            <Typography>Imagem da página 2 não disponível.</Typography>
          )}
        </TabPanel>
      </Paper>
    </Container>
  );
}
