import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

import { GoogleGenAI } from '@google/genai';
import { initializeApp as initializeFirebaseApp } from 'firebase/app';
import { getFirestore as getFirebaseFirestore, doc as firestoreDoc, getDoc as getFirestoreDoc, updateDoc as updateFirestoreDoc, setDoc as setFirestoreDoc } from 'firebase/firestore';
import { encrypt, decrypt } from './server-encryption';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase on the server dynamically
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let db: any = null;
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
      const firebaseApp = initializeFirebaseApp(firebaseConfig);
      db = getFirebaseFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    } catch (e) {
      console.error('Failed to initialize Firestore on server:', e);
    }
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || 'fake-key-for-dev',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.post('/api/analyze-patient', async (req, res) => {
    try {
      const { patientName, anamnese, assessments, notes } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
      }

      const prompt = `Atue como um motor de análise clínica avançada e psiquiatra.
Você usará rigorosamente as regras do DSM-5-TR para analisar os seguintes dados de um paciente:

NOME: ${patientName}
ANAMNESE: ${anamnese}
NOTAS DE SESSÃO DO PACIENTE DESCRIÇÃO/HISTÓRICO: ${notes}
AVALIAÇÕES RECENTES: ${assessments}

Sua tarefa:
1. Formular Hipóteses Diagnósticas baseadas no DSM-5-TR.
2. Identificar possíveis Comorbidades.
3. Fornecer uma breve justificativa de acordo com os critérios do DSM-5-TR encontrados no relato (apontar quais sintomas preenchem quais critérios).
4. Sugerir próximos passos para acompanhamento ou avaliação adicional que o profissional pode tomar.

Retorne SOMENTE texto formatado de forma limpa com quebras de linha e marcadores. Use um tom profissional, técnico e neutro.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      res.json({ result: response.text });
    } catch (error) {
      console.error('Erro na análise com o Gemini:', error);
      res.status(500).json({ error: 'Falha na análise sintomática' });
    }
  });

  app.post('/api/transcribe-audio', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
      }
      
      if (!audioBase64) {
        return res.status(400).json({ error: 'Áudio não fornecido.' });
      }

      // Remove data URL prefix if present
      const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: 'user',
            parts: [
              { text: "Transcreva o áudio a seguir exatamente como foi dito, sem adicionar comentários ou formatações extras. Apenas o texto transcrito:" },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType || 'audio/webm'
                }
              }
            ]
          }
        ]
      });

      res.json({ text: response.text });
    } catch (error) {
      console.error('Erro na transcrição de áudio com o Gemini:', error);
      res.status(500).json({ error: 'Falha na transcrição do áudio.' });
    }
  });

  app.post('/api/send-verification', async (req, res) => {
    try {
      const { email, code, link, name } = req.body;
      const resendKey = process.env.RESEND_API_KEY;
      
      if (!resendKey) {
        return res.status(500).json({ error: 'RESEND_API_KEY não configurada no servidor.' });
      }

      const resend = new Resend(resendKey);
      
      let htmlTemplate = fs.readFileSync(path.join(process.cwd(), 'email-template.html'), 'utf-8');
      
      // Replace variables in template
      htmlTemplate = htmlTemplate.replace(/{{codigo}}/g, code).replace(/{{link_de_verificacao}}/g, link).replace(/{{nome}}/g, name || 'profissional');

      const data = await resend.emails.send({
        from: 'CleanMind <onboarding@resend.dev>',
        to: email,
        subject: 'Valide seu acesso - CleanMind',
        html: htmlTemplate,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      res.status(500).json({ error: 'Falha ao enviar email' });
    }
  });

  app.post('/api/send-appointment', async (req, res) => {
    try {
      const { email, patientName, date, time, type, meetLink, address, doctorName } = req.body;
      const resendKey = process.env.RESEND_API_KEY;
      
      if (!resendKey) {
        return res.status(500).json({ error: 'RESEND_API_KEY não configurada no servidor.' });
      }

      const resend = new Resend(resendKey);
      
      // Parse date to br format (it comes as YYYY-MM-DD usually)
      let formattedDate = date;
      try {
        const [year, month, day] = date.split('-');
        formattedDate = `${day}/${month}/${year}`;
      } catch (e) {}

      let appointmentDetails = '';
      if (type === 'online') {
         appointmentDetails = `
           <p style="color: #64748b; margin: 0 0 12px 0; font-size: 16px; line-height: 1.5;">
             <strong>Modalidade:</strong> Online<br>
             <strong>Link da Videochamada:</strong> <a href="${meetLink || '#'}" style="color: #047857; text-decoration: underline;">Acessar Google Meet</a>
           </p>
         `;
      } else {
         appointmentDetails = `
           <p style="color: #64748b; margin: 0 0 12px 0; font-size: 16px; line-height: 1.5;">
             <strong>Modalidade:</strong> Presencial<br>
             <strong>Endereço/Sala:</strong> ${address || 'Local a confirmar'}
           </p>
         `;
      }

      let htmlTemplate = fs.readFileSync(path.join(process.cwd(), 'email-template.html'), 'utf-8');
      
      // Replace variables in template to repurpose it
      htmlTemplate = htmlTemplate
        .replace(/Validação de Acesso <span style="color: #C1E2A4;">CleanMind<\/span>/g, 'Agendamento Confirmado <span style="color: #C1E2A4;">CleanMind</span>')
        .replace(/Valide seu acesso/g, 'Agendamento Confirmado')
        .replace(/{{nome}}/g, patientName || 'paciente')
        .replace(/Falta pouco para você começar a gerenciar sua clínica de forma eficiente. Para garantir a segurança dos seus dados, precisamos validar seu e-mail./g, `Seu agendamento foi realizado com sucesso. Aqui estão os detalhes da sua sessão com <strong>${doctorName || 'o profissional'}</strong>:<br><br>
           <strong>Data:</strong> ${formattedDate}<br>
           <strong>Horário:</strong> ${time}<br>
           <br>
           ${appointmentDetails}
        `)
        .replace(/<span style="font-size: 24px.*/, '')
        .replace(/<p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px; font-weight: 500;">Código de Verificação<\/p>/, '')
        .replace(/<div style="margin: 32px 0; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1; text-align: center;">[\s\S]*?<\/div>/, '')
        .replace(/<a href="{{link_de_verificacao}}".*<\/a>/g, type === 'online' ? `<a href="${meetLink || '#'}" style="display: inline-block; background-color: #C1E2A4; color: #192F28; font-weight: 600; font-size: 16px; text-decoration: none; padding: 14px 28px; border-radius: 8px;">Acessar Videochamada</a>` : '');

      const data = await resend.emails.send({
        from: 'CleanMind <onboarding@resend.dev>',
        to: email,
        subject: 'Seu agendamento está confirmado - CleanMind',
        html: htmlTemplate,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao enviar email de agendamento:', error);
      res.status(500).json({ error: 'Falha ao enviar email' });
    }
  });

  app.post('/api/send-password-reset', async (req, res) => {
    try {
      const { email, code } = req.body;
      const resendKey = process.env.RESEND_API_KEY;
      
      if (!resendKey) {
        return res.status(500).json({ error: 'RESEND_API_KEY não configurada no servidor.' });
      }

      const resend = new Resend(resendKey);
      
      let htmlTemplate = fs.readFileSync(path.join(process.cwd(), 'email-template.html'), 'utf-8');
      
      // customize the template for password reset
      htmlTemplate = htmlTemplate
        .replace(/Validação de Acesso <span style="color: #C1E2A4;">CleanMind<\/span>/g, 'Recuperação de Senha <span style="color: #C1E2A4;">CleanMind</span>')
        .replace(/Valide seu acesso/g, 'Recupere sua senha')
        .replace(/Olá {{nome}} 👋,<br><br>\s*Falta pouco para você começar a gerenciar sua clínica de forma eficiente\. Para garantir a segurança dos seus dados, precisamos validar seu e-mail\./, `Detectamos uma solicitação para redefinir a senha da sua conta associada ao e-mail <strong>${email}</strong>.<br><br>Use o código de 6 dígitos abaixo para criar uma nova senha:`)
        .replace(/<a href="{{link_de_verificacao}}"[\s\S]*?<\/a>/, `<div style="background-color: #f1f5f9; padding: 16px 24px; border-radius: 8px; display: inline-block;"><span style="font-size: 32px; font-weight: 700; letter-spacing: 0.2em; color: #192F28; font-family: monospace;">${code}</span></div>`)
        .replace(/<hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 32px 0;">[\s\S]*?(?=<\/td>)/, '<p style="color: #64748b; margin-top: 32px; font-size: 13px;">Se você não solicitou a redefinição de senha, por favor ignore este e-mail. Sua conta permanecerá segura.</p>');

      const data = await resend.emails.send({
        from: 'CleanMind <onboarding@resend.dev>',
        to: email,
        subject: 'Código de Recuperação de Senha - CleanMind',
        html: htmlTemplate,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao enviar email de recuperação:', error);
      res.status(500).json({ error: 'Falha ao enviar email' });
    }
  });

  app.post('/api/summarize-diary', async (req, res) => {
    try {
      const { patientName, entries } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
      }

      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'Nenhum registro de diário fornecido.' });
      }

      // Format entries nicely for the model
      const formattedEntries = entries.map((e, idx) => {
        const dateStr = e.created_at ? new Date(e.created_at).toLocaleString('pt-BR') : 'Data desconhecida';
        const sentiment = e.sentiment_score !== undefined ? `Humor: ${e.sentiment_score}` : '';
        const crisis = e.crisis_flag ? 'ALERTA DE CRISE!' : '';
        return `Registro #${idx + 1} [${dateStr}] ${sentiment} ${crisis}\nConteúdo: ${e.content}`;
      }).join('\n\n');

      const prompt = `Atue como um analista de saúde mental e psicólogo clínico especializado.
Você receberá as últimas entradas do diário clínico do paciente "${patientName}" (registros de pensamentos, reflexões, sentimentos e crises coletados pelo bot de integração via WhatsApp).

Sua tarefa é ler atentamente estes relatos e fornecer um resumo executivo clínico estruturado para o psicólogo/médico responsável:

1. **Visão Geral Emocional**: Resuma o estado emocional e o tom predominante do paciente com base em suas palavras.
2. **Temas Recorrentes ou Gatilhos**: Identifique padrões de pensamento, comportamentos repetitivos ou eventos que parecem agir como gatilhos para ansiedade, estresse ou crises.
3. **Indicadores de Crise ou Alerta**: Se houver menção a episódios de crise ou ideações de risco, destaque-os com o devido cuidado e atenção clínica. Caso contrário, mencione que não foram observados alertas severos.
4. **Sugestões Terapêuticas**: Com base no que foi relatado, sugira caminhos ou tópicos para explorar nas próximas sessões de psicoterapia.

DIÁRIO DO PACIENTE:
${formattedEntries}

Retorne a resposta formatada de forma limpa em Markdown com títulos elegantes e marcadores claros. Use um tom profissional, técnico, empático e de suporte ao terapeuta. Seja direto e evite jargões excessivos não-clínicos.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ result: response.text });
    } catch (error) {
      console.error('Erro na geração de resumo com o Gemini:', error);
      res.status(500).json({ error: 'Falha ao gerar resumo do diário' });
    }
  });

  // Google OAuth: Generate Auth URL (supports Sandbox Fallback)
  app.get('/api/auth/google/url', (req, res) => {
    const { doctorId } = req.query;
    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId é obrigatório' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.APP_URL || (req.get('host') ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.get('host')}` : 'http://localhost:3000');

    // Fallback if not configured
    if (!clientId || !clientSecret) {
      console.warn('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured. Showing interactive configuration screen.');
      
      const devUrl = `https://ais-dev-dz2gvk575e2u3qgqhw7l2d-782701354004.us-east1.run.app`;
      const preUrl = `https://ais-pre-dz2gvk575e2u3qgqhw7l2d-782701354004.us-east1.run.app`;
      const devCallback = `${devUrl}/api/auth/google/callback`;
      const preCallback = `${preUrl}/api/auth/google/callback`;

      return res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Configuração de Integração do Google Calendar</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background-color: #f1f5f9;
              color: #1e293b;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              box-sizing: border-box;
            }
            .card {
              background: white;
              border-radius: 16px;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
              padding: 28px;
              max-width: 580px;
              width: 100%;
              border: 1px solid #e2e8f0;
            }
            .header {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
            }
            .logo-google {
              width: 24px;
              height: 24px;
            }
            h1 {
              font-size: 20px;
              font-weight: 700;
              color: #0f172a;
              margin: 0;
            }
            p {
              font-size: 13px;
              line-height: 1.5;
              color: #475569;
              margin-top: 0;
              margin-bottom: 14px;
            }
            .badge {
              display: inline-block;
              background: #fef3c7;
              color: #d97706;
              padding: 4px 8px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 600;
              margin-bottom: 14px;
            }
            .steps {
              background: #f8fafc;
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 20px;
              border: 1px solid #e2e8f0;
            }
            .step-title {
              font-weight: 600;
              color: #0f172a;
              margin-top: 12px;
              margin-bottom: 4px;
              font-size: 12px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .step-title:first-child {
              margin-top: 0;
            }
            .step-number {
              background: #192F28;
              color: #c1e2a4;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: bold;
            }
            .code-box {
              background: #0f172a;
              color: #38bdf8;
              padding: 6px 10px;
              border-radius: 6px;
              font-family: monospace;
              font-size: 11px;
              word-break: break-all;
              margin: 4px 0 8px 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .copy-btn {
              color: #94a3b8;
              font-size: 10px;
              cursor: pointer;
              background: #1e293b;
              padding: 2px 6px;
              border-radius: 4px;
              border: none;
            }
            .copy-btn:hover {
              color: white;
              background: #334155;
            }
            .buttons {
              display: flex;
              gap: 12px;
              margin-top: 16px;
            }
            .btn {
              flex: 1;
              padding: 10px 14px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              border: none;
              text-align: center;
              text-decoration: none;
              box-sizing: border-box;
            }
            .btn-primary {
              background: #192F28;
              color: #c1e2a4;
              border: 1px solid #192F28;
            }
            .btn-primary:hover {
              background: #233e35;
            }
            .btn-secondary {
              background: #e2e8f0;
              color: #334155;
            }
            .btn-secondary:hover {
              background: #cbd5e1;
            }
            a {
              color: #2563eb;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
          <script>
            function copyText(id, text) {
              navigator.clipboard.writeText(text);
              const btn = document.getElementById(id);
              btn.innerText = "Copiado!";
              setTimeout(() => { btn.innerText = "Copiar"; }, 2000);
            }
          </script>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <svg class="logo-google" viewBox="0 0 48 48" style="display: block;">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <h1>Conectar Google Calendar real</h1>
            </div>

            <span class="badge">Ação Requerida</span>

            <p>
              Para abrir a tela oficial do Google onde os médicos conectam suas agendas reais, você precisa configurar suas chaves de API nas variáveis de ambiente do AI Studio.
            </p>

            <div class="steps">
              <div class="step-title"><span class="step-number">1</span> Criar chaves de acesso no Google Cloud Console:</div>
              <p style="margin-bottom: 8px; font-size: 12px;">
                Acesse o <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a>, ative a <strong>Google Calendar API</strong> e crie uma credencial de <strong>ID do cliente OAuth (Aplicativo da Web)</strong>.
              </p>

              <div class="step-title"><span class="step-number">2</span> Configurar Origens JavaScript Autorizadas:</div>
              <div class="code-box">
                <span>${devUrl}</span>
                <button id="btn-orig-dev" class="copy-btn" onclick="copyText('btn-orig-dev', '${devUrl}')">Copiar</button>
              </div>
              <div class="code-box">
                <span>${preUrl}</span>
                <button id="btn-orig-pre" class="copy-btn" onclick="copyText('btn-orig-pre', '${preUrl}')">Copiar</button>
              </div>

              <div class="step-title"><span class="step-number">3</span> Configurar URIs de Redirecionamento Autorizados:</div>
              <div class="code-box">
                <span>${devCallback}</span>
                <button id="btn-cb-dev" class="copy-btn" onclick="copyText('btn-cb-dev', '${devCallback}')">Copiar</button>
              </div>
              <div class="code-box">
                <span>${preCallback}</span>
                <button id="btn-cb-pre" class="copy-btn" onclick="copyText('btn-cb-pre', '${preCallback}')">Copiar</button>
              </div>

              <div class="step-title"><span class="step-number">4</span> Adicionar no AI Studio:</div>
              <p style="margin-bottom: 0; font-size: 12px; color: #475569;">
                Copie o seu <strong>Client ID</strong> e <strong>Client Secret</strong> e cole-os nas Configurações do AI Studio (ícone de ⚙️ Engrenagem no topo direito > Secrets / Environment Variables) sob as seguintes chaves:
                <br>• <code>GOOGLE_CLIENT_ID</code>
                <br>• <code>GOOGLE_CLIENT_SECRET</code>
              </p>
            </div>

            <p style="font-size: 11px; color: #64748b; margin-bottom: 12px; line-height: 1.4;">
              💡 <em>Após adicionar as chaves no AI Studio, clique em "Já configurei, recarregar" abaixo.</em>
            </p>

            <div class="buttons">
              <button class="btn btn-secondary" onclick="window.location.reload()">🔄 Já configurei, recarregar</button>
              <a href="${appUrl}/api/auth/google/mock-callback?doctorId=${doctorId}" class="btn btn-primary" style="display: inline-flex; align-items: center; justify-content: center;">🧪 Usar Sandbox (Modo de Teste)</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', String(doctorId));

    res.redirect(authUrl.toString());
  });

  // Google OAuth: Callback Handler (exchange code for tokens and save to Firestore)
  app.get('/api/auth/google/callback', async (req, res) => {
    const { code, state: doctorId } = req.query;
    if (!code || !doctorId) {
      return res.status(400).send('Código de autorização ou ID do médico ausente.');
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const appUrl = process.env.APP_URL || (req.get('host') ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.get('host')}` : 'http://localhost:3000');
      const redirectUri = `${appUrl}/api/auth/google/callback`;

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          code: String(code),
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Google token exchange error:', errorText);
        return res.status(500).send(`Erro ao trocar código por token: ${errorText}`);
      }

      const tokens = await tokenResponse.json();
      const { access_token, refresh_token, expires_in } = tokens;

      // Get user email
      let email = 'clinica@cleanmind.com';
      try {
        const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        if (userinfoResponse.ok) {
          const userinfo = await userinfoResponse.json();
          email = userinfo.email || email;
        }
      } catch (err) {
        console.error('Failed to fetch Google userinfo:', err);
      }

      // Save to Firestore (encrypt the tokens first)
      if (db) {
        const encryptedAccessToken = encrypt(access_token);
        const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;
        const expiresInSecs = expires_in ? Number(expires_in) : 3600;
        const expiryTime = Date.now() + (expiresInSecs * 1000);

        const docRef = firestoreDoc(db, 'doctors', String(doctorId));
        await setFirestoreDoc(docRef, {
          google_access_token: encryptedAccessToken,
          google_refresh_token: encryptedRefreshToken,
          google_token_expiry: expiryTime,
          google_connected_email: email
        }, { merge: true });
      }

      // Return popup closer HTML
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8fafc; color: #1e293b;">
            <div style="max-width: 400px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-top: 50px;">
              <h2 style="color: #047857; margin-bottom: 10px;">Conexão Concluída!</h2>
              <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
                Sua conta do Google Calendar foi integrada com sucesso ao CleanMind de forma permanente.
              </p>
              <p style="font-size: 12px; color: #94a3b8;">Esta janela será fechada automaticamente.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', doctorId: '${doctorId}' }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                setTimeout(() => { window.location.href = '/'; }, 2000);
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Callback handling error:', error);
      res.status(500).send('Erro interno durante o processamento do callback Google.');
    }
  });

  // Google OAuth: Mock Callback Handler for Sandbox environment
  app.get('/api/auth/google/mock-callback', async (req, res) => {
    const { doctorId } = req.query;
    if (!doctorId) {
      return res.status(400).send('ID do médico ausente.');
    }

    try {
      // Save Mock Token to Firestore
      if (db) {
        const docRef = firestoreDoc(db, 'doctors', String(doctorId));
        await setFirestoreDoc(docRef, {
          google_access_token: `mock_access_token_${Date.now()}`,
          google_refresh_token: 'mock_refresh_token_xyz',
          google_token_expiry: Date.now() + (3600 * 1000),
          google_connected_email: 'clinica@cleanmind.com'
        }, { merge: true });
      }

      // Return popup closer HTML
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8fafc; color: #1e293b;">
            <div style="max-width: 400px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-top: 50px;">
              <h2 style="color: #047857; margin-bottom: 10px;">Modo Sandbox Ativo!</h2>
              <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
                Google Calendar conectado no modo de teste (Sandbox). Os agendamentos simularão a integração perfeitamente.
              </p>
              <p style="font-size: 12px; color: #94a3b8;">Esta janela será fechada automaticamente.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', doctorId: '${doctorId}' }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                setTimeout(() => { window.location.href = '/'; }, 2000);
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Mock Callback error:', error);
      res.status(500).send('Erro interno no modo Sandbox.');
    }
  });

  // Google OAuth: Get valid token for a doctor (automatically handles refreshing on the server)
  app.post('/api/auth/google/get-token', async (req, res) => {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId é obrigatório' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Firestore não inicializado no servidor' });
    }

    try {
      const docRef = firestoreDoc(db, 'doctors', String(doctorId));
      const docSnap = await getFirestoreDoc(docRef);
      if (!docSnap.exists()) {
        return res.status(404).json({ error: 'Médico não encontrado' });
      }

      const data = docSnap.data();
      const { google_access_token, google_refresh_token, google_token_expiry } = data;

      if (!google_access_token && !google_refresh_token) {
        return res.status(400).json({ error: 'Google Calendar não conectado para este médico' });
      }

      // Decrypt the tokens retrieved from Firestore
      const decryptedAccessToken = decrypt(google_access_token);
      const decryptedRefreshToken = decrypt(google_refresh_token);

      // Check if access token is still valid (with a 5-minute safety margin)
      const isTokenValid = decryptedAccessToken && google_token_expiry && (google_token_expiry > Date.now() + 5 * 60 * 1000);

      if (isTokenValid) {
        return res.json({ accessToken: decryptedAccessToken });
      }

      // If mock token, just re-issue a new mock token
      if (decryptedRefreshToken === 'mock_refresh_token_xyz') {
        const mockToken = `mock_access_token_${Date.now()}`;
        await setFirestoreDoc(docRef, {
          google_access_token: mockToken,
          google_token_expiry: Date.now() + (3600 * 1000)
        }, { merge: true });
        return res.json({ accessToken: mockToken });
      }

      // If no real refresh token to refresh a real expired access token, we can't refresh
      if (!decryptedRefreshToken) {
        return res.status(401).json({ error: 'Token do Google Calendar expirado e sem refresh token.' });
      }

      // Refresh the real Google token
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Credenciais GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ausentes no servidor.' });
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: decryptedRefreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error('Google token refresh error:', errorText);
        // If Google says the refresh token is revoked/invalid, clean up the invalid tokens in database
        if (refreshResponse.status === 400 || refreshResponse.status === 401) {
          await setFirestoreDoc(docRef, {
            google_access_token: null,
            google_refresh_token: null,
            google_token_expiry: null,
            google_connected_email: null
          }, { merge: true });
        }
        return res.status(401).json({ error: 'Falha ao renovar token com o Google.' });
      }

      const refreshTokens = await refreshResponse.json();
      const newAccessToken = refreshTokens.access_token;
      const expiresIn = refreshTokens.expires_in || 3600;

      // Encrypt the newly refreshed access token before persisting
      const encryptedNewAccessToken = encrypt(newAccessToken);

      await setFirestoreDoc(docRef, {
        google_access_token: encryptedNewAccessToken,
        google_token_expiry: Date.now() + (Number(expiresIn) * 1000)
      }, { merge: true });

      res.json({ accessToken: newAccessToken });
    } catch (error) {
      console.error('Error in get-token endpoint:', error);
      res.status(500).json({ error: 'Erro interno ao obter token do médico' });
    }
  });

  // Google OAuth: Test and diagnose token storage and validity
  app.post('/api/auth/google/test-token', async (req, res) => {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId é obrigatório' });
    }

    if (!db) {
      return res.status(500).json({ 
        success: false,
        error: 'Firestore não inicializado no servidor' 
      });
    }

    try {
      const docRef = firestoreDoc(db, 'doctors', String(doctorId));
      const docSnap = await getFirestoreDoc(docRef);
      if (!docSnap.exists()) {
        return res.status(404).json({ 
          success: false,
          error: 'Médico não encontrado no Firestore.' 
        });
      }

      const data = docSnap.data();
      const { 
        google_access_token, 
        google_refresh_token, 
        google_token_expiry, 
        google_connected_email 
      } = data;

      const diagnostics: any = {
        success: true,
        doctorId,
        email: google_connected_email || null,
        tokenExpiry: google_token_expiry || null,
        tokenExpiryFormatted: google_token_expiry ? new Date(google_token_expiry).toLocaleString('pt-BR') : null,
        rawAccessTokenLength: google_access_token ? google_access_token.length : 0,
        rawRefreshTokenLength: google_refresh_token ? google_refresh_token.length : 0,
        isEncrypted: google_access_token ? (google_access_token.includes(':') && google_access_token.split(':').length === 3) : false,
        isMock: false,
        decryptionSuccess: false,
        tokenValidNow: false,
        googleApiStatus: 'Não testado',
        log: []
      };

      diagnostics.log.push('Lendo dados do Firestore para o médico.');

      if (!google_access_token && !google_refresh_token) {
        diagnostics.success = false;
        diagnostics.log.push('Nenhum token encontrado no banco de dados para este médico.');
        return res.json(diagnostics);
      }

      diagnostics.log.push('Tokens localizados no Firestore.');

      // Try Decrypting
      let decryptedAccessToken = '';
      let decryptedRefreshToken = '';
      try {
        decryptedAccessToken = decrypt(google_access_token);
        decryptedRefreshToken = google_refresh_token ? decrypt(google_refresh_token) : '';
        diagnostics.decryptionSuccess = !!decryptedAccessToken;
        diagnostics.log.push('Decifragem de tokens executada com sucesso.');
      } catch (decErr: any) {
        diagnostics.decryptionSuccess = false;
        diagnostics.log.push(`Erro ao decifrar os tokens: ${decErr.message}`);
      }

      // Check if Mock/Sandbox
      if (decryptedAccessToken.startsWith('mock_') || decryptedRefreshToken === 'mock_refresh_token_xyz') {
        diagnostics.isMock = true;
        diagnostics.tokenValidNow = google_token_expiry ? google_token_expiry > Date.now() : false;
        diagnostics.googleApiStatus = 'Simulado (Modo Sandbox ativo)';
        diagnostics.log.push('Identificado como ambiente de teste Sandbox. Operação de autenticação simulada com sucesso!');
        return res.json(diagnostics);
      }

      // Test physical validity with Google APIs
      if (decryptedAccessToken) {
        const isExpired = google_token_expiry ? google_token_expiry < Date.now() : true;
        if (isExpired) {
          diagnostics.log.push('O Access Token atual está expirado de acordo com o timestamp local.');
        } else {
          diagnostics.log.push('O Access Token atual está dentro do prazo de validade local.');
        }

        diagnostics.log.push('Testando o token de acesso contra a API do Google Userinfo...');
        try {
          const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${decryptedAccessToken}` }
          });

          if (userinfoResponse.ok) {
            const userinfo = await userinfoResponse.json();
            diagnostics.tokenValidNow = true;
            diagnostics.googleApiStatus = 'Ativo e Autorizado (Google API aprovou o token!)';
            diagnostics.log.push(`Sucesso! Google confirmou o email da conexão: ${userinfo.email}`);
            return res.json(diagnostics);
          } else {
            const errBody = await userinfoResponse.text();
            diagnostics.log.push(`Google API rejeitou o token de acesso (Status ${userinfoResponse.status}): ${errBody}`);
          }
        } catch (apiErr: any) {
          diagnostics.log.push(`Erro de conexão ao tentar falar com o Google: ${apiErr.message}`);
        }
      }

      // If access token is invalid or expired, try a refresh test
      if (decryptedRefreshToken) {
        diagnostics.log.push('Access Token inválido ou expirado. Iniciando teste de renovação (refresh) utilizando o Refresh Token...');
        
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          diagnostics.log.push('Erro: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET ausentes no servidor. Não é possível renovar.');
          diagnostics.googleApiStatus = 'Não foi possível renovar (Faltam credenciais do app)';
          return res.json(diagnostics);
        }

        try {
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: decryptedRefreshToken,
              grant_type: 'refresh_token'
            })
          });

          if (refreshResponse.ok) {
            const refreshTokens = await refreshResponse.json();
            const newAccessToken = refreshTokens.access_token;
            const expiresIn = refreshTokens.expires_in || 3600;

            diagnostics.log.push('Sucesso! O Google renovou o token de acesso.');

            // Encrypt and save
            const encryptedNewAccessToken = encrypt(newAccessToken);
            await setFirestoreDoc(docRef, {
              google_access_token: encryptedNewAccessToken,
              google_token_expiry: Date.now() + (Number(expiresIn) * 1000)
            }, { merge: true });

            diagnostics.tokenValidNow = true;
            diagnostics.tokenExpiry = Date.now() + (expiresIn * 1000);
            diagnostics.tokenExpiryFormatted = new Date(diagnostics.tokenExpiry).toLocaleString('pt-BR');
            diagnostics.googleApiStatus = 'Renovado com Sucesso e Ativo!';
            diagnostics.log.push('Novo Access Token criptografado e salvo de volta no Firestore com sucesso.');
          } else {
            const errBody = await refreshResponse.text();
            diagnostics.log.push(`Google rejeitou a renovação do token (Status ${refreshResponse.status}): ${errBody}`);
            diagnostics.googleApiStatus = 'Refresh Token inválido ou revogado';
          }
        } catch (refErr: any) {
          diagnostics.log.push(`Erro ao se comunicar com o Google para renovação: ${refErr.message}`);
          diagnostics.googleApiStatus = 'Erro de rede na renovação';
        }
      } else {
        diagnostics.log.push('Não há Refresh Token disponível para tentar renovar o Access Token expirado.');
        diagnostics.googleApiStatus = 'Token expirado e sem Refresh Token';
      }

      res.json(diagnostics);
    } catch (error: any) {
      console.error('Error in test-token endpoint:', error);
      res.status(500).json({ 
        success: false, 
        error: `Erro interno no servidor: ${error.message}` 
      });
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
