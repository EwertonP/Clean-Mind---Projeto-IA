import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

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
