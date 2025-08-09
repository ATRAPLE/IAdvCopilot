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

  const handleTabChange = (_: any, newValue: number) => setTab(newValue);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(
        "http://localhost:8000/api/process-pdf/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setData(res.data.data);
      setDownloadUrl(res.data.download_url);
      setTab(0);
    } catch (err: any) {
      setError("Erro ao processar o PDF.");
    } finally {
      setLoading(false);
    }
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
          <Button
            variant="contained"
            color="success"
            onClick={handleUpload}
            disabled={!file || loading}
          >
            Enviar e Processar
          </Button>
          {loading && <CircularProgress size={28} />}
        </Box>
        {error && <Typography color="error">{error}</Typography>}
        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Visualização Estruturada" />
          <Tab label="JSON Bruto" />
        </Tabs>
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
      </Paper>
    </Container>
  );
}
