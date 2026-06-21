import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

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
