import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMT1nBshxFoQgHL_u9y3khFovs9J5musUEAlzHJbj3rd5vpLFb9tMsAF_S3B2cUZIF/exec';
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || 'fc7a049d22afc785b615ecde51392119';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ImgBB Upload Proxy
  app.post('/api/upload-logo', async (req, res) => {
    try {
      const { image } = req.body; // base64 string
      if (!image) return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });

      const formData = new URLSearchParams();
      formData.append('image', image.replace(/^data:image\/\w+;base64,/, ''));

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
      });

      const data: any = await response.json();
      if (data.status === 200) {
        res.json({ success: true, url: data.data.url });
      } else {
        res.status(500).json({ success: false, message: 'Erro no ImgBB.' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // API Proxy Route
  app.all('/api/apps-script', async (req, res) => {
    try {
      const isPost = req.method === 'POST';
      const query = new URLSearchParams(req.query as any).toString();
      let targetUrl = `${APPS_SCRIPT_URL}?${query}`;
      
      let options: RequestInit = {
        method: isPost ? 'POST' : 'GET',
        redirect: 'follow',
        headers: {
          'Accept': 'application/json',
        }
      };

      if (isPost) {
        options.headers = {
          ...options.headers,
          'Content-Type': 'application/json',
        };
        options.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, options);
      const text = await response.text();
      
      // Attempt to parse JSON
      try {
        const data = JSON.parse(text);
        res.status(response.ok ? 200 : response.status || 502).json(data);
      } catch (e) {
        // If not JSON, it might be an error or HTML
        if (text.trim().startsWith('<')) {
          res.status(502).json({ 
            success: false, 
            message: 'A resposta do script foi HTML em vez de JSON. Verifique a implantação do Apps Script.',
            raw: text.substring(0, 500)
          });
        } else {
          res.status(502).json({ success: false, message: 'Resposta inválida do Apps Script.', raw: text });
        }
      }
    } catch (error: any) {
      console.error('Proxy Error:', error);
      res.status(500).json({ success: false, message: error.message || 'Falha ao conectar no Apps Script.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
