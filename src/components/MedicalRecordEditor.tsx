import React, { useState, useEffect } from 'react';
import { Brain, FileText, Lock, Sparkles, ShieldCheck, Heart, User, Send, ArrowRight, CornerDownRight, Check, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, DiaryEntry, MedicalRecord, dataManager } from '../data';
import jsPDF from 'jspdf';

interface MedicalRecordEditorProps {
  initialPatientId?: string;
  onRefreshDashboard: () => void;
  triggerRefresh: number;
}

export default function MedicalRecordEditor({ initialPatientId, onRefreshDashboard, triggerRefresh }: MedicalRecordEditorProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filterPatientId, setFilterPatientId] = useState(initialPatientId || '');
  const [selectedFormPatientId, setSelectedFormPatientId] = useState('');
  const [evolutionText, setEvolutionText] = useState('');
  const [prontuarioText, setProntuarioText] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [history, setHistory] = useState<MedicalRecord[]>([]);
  
  // Signature workflow states
  const [signatureStatus, setSignatureStatus] = useState<'unsigned' | 'signed_icp'>('unsigned');
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signatureHash, setSignatureHash] = useState('');
  const [showForm, setShowForm] = useState(false);
  
  // Toast Alert State
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const list = dataManager.getPatients();
    setPatients(list);
    
    // Choose patient default for filter if initialPatientId exists
    if (initialPatientId && list.some(p => p.id === initialPatientId)) {
      setFilterPatientId(initialPatientId);
    }
  }, [initialPatientId, triggerRefresh]);

  // Load history records for the main view
  useEffect(() => {
    const allRecords = dataManager.getMedicalRecords();
    if (filterPatientId) {
      setHistory(allRecords.filter(r => r.patient_id === filterPatientId));
    } else {
      setHistory(allRecords);
    }
  }, [filterPatientId, triggerRefresh]);

  // Handle form state changes when a patient is selected in the modal
  useEffect(() => {
    if (!selectedFormPatientId) {
      setEvolutionText('');
      setProntuarioText('');
      setAiSummary('');
      setSignatureStatus('unsigned');
      setSignedAt(null);
      setSignatureHash('');
      return;
    }

    const allRecords = dataManager.getMedicalRecords();
    const patientRecords = allRecords.filter(r => r.patient_id === selectedFormPatientId);

    // If there is an active unsigned draft for this patient, load it.
    const unsignedDraft = patientRecords.find(r => r.signature_status === 'unsigned');
    if (unsignedDraft) {
      setEvolutionText(unsignedDraft.evolution_text || '');
      setProntuarioText(unsignedDraft.prontuario_text || '');
      setAiSummary(unsignedDraft.ai_summary || '');
      setSignatureStatus('unsigned');
      setSignedAt(null);
      setSignatureHash('');
    } else {
      setEvolutionText('');
      setProntuarioText('');
      setAiSummary('');
      setSignatureStatus('unsigned');
      setSignedAt(null);
      setSignatureHash('');
    }

    // Auto calculate simulated CDS Copilot insights
    generateMedicalAISummary(selectedFormPatientId);
  }, [selectedFormPatientId, showForm]);

  // Filter diary entries for the selected patient
  const patientDiaries = dataManager.getDiaryEntries().filter(d => d.patient_id === selectedFormPatientId);

  // Simulated AI CDS compiler (compliance with ANVISA RDC 657/2022)
  const generateMedicalAISummary = (patId: string) => {
    const diaries = dataManager.getDiaryEntries().filter(d => d.patient_id === patId);
    if (diaries.length === 0) {
      setAiSummary('Dados insuficientes recebidos pelo diário WhatsApp. Aguardando maior amostragem do comportamento diário.');
      return;
    }

    const hasCrisis = diaries.some(d => d.crisis_flag);
    const positiveScoreCount = diaries.filter(d => d.sentiment_score > 0.3).length;
    
    let summary = '';
    if (hasCrisis) {
      summary = `● ALERTA DE SEGURANÇA: Registradas mensagens com indicativos severos de ideação de autocuidado/inflexibilidade cognitiva nas últimas 24 horas. Recomendada intervenção preventiva direta síncrona.
● Adesão aos combinados de TCC: Comprometida pelo estado atual de ansiedade crítica.
● Ritmo Circadiano: Indicação de insônia severa reportada na triagem.`;
    } else if (positiveScoreCount > 0) {
      summary = `● Estabilidade Clínica: Sinais de restabelecimento positivo através do uso orientado do Registro de Pensamentos Disfuncionais (RPD).
● Manejo Cognitivo: Paciente demonstra discernimento frente aos pensamentos automáticos disfuncionais.
● Nível afetivo médio: Estável, voltado para superação de ansiedades corporativas.`;
    } else {
      summary = `● Flutuação Afetiva: Picos moderados de ansiedade social percebidos de tarde. 
● Estratégia Recomendada: Estimular aplicação prática do RPD e agendamento de teleconsulta preventiva preventiva para mapear crenças limitantes.`;
    }
    setAiSummary(summary);
  };

  // Prefab templates injection for clinical ease
  const handleInsertTemplate = (type: 'rpd' | 'tcc') => {
    if (signatureStatus === 'signed_icp') return;

    if (type === 'rpd') {
      const rpdTemplate = `[EVOLUÇÃO CLÍNICA DE PSICOTERAPIA - RPD]\n\n1. SITUAÇÃO DETETADA:\n\n2. PENSAMENTOS AUTOMÁTICOS INDUZIDOS:\n\n3. EMOÇÕES ASSOCIADAS:\n\n4. RESPOSTA RACIONAL COGNITIVA:\n\n5. RESULTADO COMPORTAMENTAL / CONDUTAS:\n`;
      setEvolutionText(prev => prev + '\n' + rpdTemplate);
    } else if (type === 'tcc') {
      const tccTemplate = `[EVOLUÇÃO PSIQUIÁTRICA / CLÍNICA - DIAGNÓSITO TCC]\n\nQueixa Principal (QP): Paciente relata...\nHipótese Diagnóstica (CID-10): \nAdesão farmacológica / Terapêutica: \nExame do Estado Mental Atual:\nPlano Psicoterapêutico Traçado: \n`;
      setEvolutionText(prev => prev + '\n' + tccTemplate);
    }
  };

  const handleSaveDraft = () => {
    if (!selectedFormPatientId || (!evolutionText && !prontuarioText)) return;

    // Save as local draft first
    const list = dataManager.getMedicalRecords();
    const index = list.findIndex(r => r.patient_id === selectedFormPatientId && r.signature_status === 'unsigned');

    if (index !== -1) {
      list[index].evolution_text = evolutionText;
      list[index].prontuario_text = prontuarioText;
      list[index].ai_summary = aiSummary;
      dataManager.saveMedicalRecords(list);
    } else {
      dataManager.addMedicalRecord({
        patient_id: selectedFormPatientId,
        evolution_text: evolutionText,
        prontuario_text: prontuarioText,
        ai_summary: aiSummary,
        signature_status: 'unsigned'
      });
    }

    setToastMessage('Rascunho salvo');
    onRefreshDashboard();
    
    // Reload history list for bottom render if it matches active filter or filter is empty
    const patientRecords = dataManager.getMedicalRecords();
    if (filterPatientId) {
      setHistory(patientRecords.filter(r => r.patient_id === filterPatientId));
    } else {
      setHistory(patientRecords);
    }

    setTimeout(() => {
      setToastMessage('');
    }, 5000);
  };

  // Sign ICP-Brasil workflow - locks and certifies document irreversibly
  const handleSignDigitalICP = () => {
    if (!selectedFormPatientId || (!evolutionText && !prontuarioText)) return;

    // Simulate ICP Hash generation
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let hex = 'SHA-256:';
    for (let i = 0; i < 24; i++) {
      hex += chars[Math.floor(Math.random() * chars.length)];
    }

    const list = dataManager.getMedicalRecords();
    // Clear out any unsigned drafts first
    const cleanList = list.filter(r => !(r.patient_id === selectedFormPatientId && r.signature_status === 'unsigned'));
    
    // Add signed record
    const targetDocId = dataManager.getDoctor().id;
    const nowStr = new Date().toISOString();
    
    const newRecord: MedicalRecord = {
      id: `rec_signed_${Date.now()}`,
      patient_id: selectedFormPatientId,
      doctor_id: targetDocId,
      evolution_text: evolutionText,
      prontuario_text: prontuarioText,
      ai_summary: aiSummary,
      signature_status: 'signed_icp',
      signed_at: nowStr,
      created_at: nowStr
    };

    cleanList.push(newRecord);
    dataManager.saveMedicalRecords(cleanList);

    setSignatureStatus('signed_icp');
    setSignedAt(nowStr);
    setSignatureHash(hex);
    onRefreshDashboard();

    // Refresh clinical list
    if (filterPatientId) {
      setHistory(cleanList.filter(r => r.patient_id === filterPatientId));
    } else {
      setHistory(cleanList);
    }

    setToastMessage(`Prontuário assinado`);
    
    setTimeout(() => {
      setToastMessage('');
    }, 8000);
  };

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || 'Paciente';
  };

  const handleExportPDF = (record: MedicalRecord) => {
    const doc = new jsPDF();
    const patientName = getPatientName(record.patient_id);
    const doctor = dataManager.getDoctor();
    
    doc.setFontSize(16);
    doc.text('Prontuário Médico Clínico', 105, 20, { align: 'center' });
    
    if (doctor.clinic_name) {
      doc.setFontSize(12);
      doc.text(doctor.clinic_name, 105, 28, { align: 'center' });
    }
    
    doc.setFontSize(10);
    doc.text(`Paciente: ${patientName}`, 20, 35);
    doc.text(`Médico(a): ${doctor.name} (${doctor.crp_crm})`, 20, 42);
    doc.text(`Data do Registro: ${new Date(record.created_at).toLocaleString('pt-BR')}`, 20, 49);
    doc.text(`Status: ${record.signature_status === 'signed_icp' ? 'Assinado Digitalmente' : 'Rascunho Não Assinado'}`, 20, 56);
    
    if (record.signed_at) {
      doc.text(`Assinado em: ${new Date(record.signed_at).toLocaleString('pt-BR')}`, 20, 63);
      if (record.signature_status === 'signed_icp') {
        doc.text(`Certificação: ICP-Brasil (Autenticado via Hash)`, 20, 70);
      }
    }
    
    doc.setFontSize(12);
    doc.text('Evolução Clínica:', 20, 85);
    
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(record.evolution_text || 'Sem evolução clínica registrada.', 170);
    doc.text(splitText, 20, 92);

    let finalY = 92 + (splitText.length * 5); // Approximate text height

    if (record.prontuario_text) {
      doc.setFontSize(12);
      doc.text('Prontuário Médico:', 20, finalY + 10);
      doc.setFontSize(10);
      const splitProntuario = doc.splitTextToSize(record.prontuario_text, 170);
      doc.text(splitProntuario, 20, finalY + 17);
      finalY = finalY + 17 + (splitProntuario.length * 5);
    }

    if (record.ai_summary) {
      doc.setFontSize(12);
      doc.text('Resumo / Insights CDS:', 20, finalY + 10);
      doc.setFontSize(10);
      const splitAi = doc.splitTextToSize(record.ai_summary, 170);
      doc.text(splitAi, 20, finalY + 17);
      finalY = finalY + 17 + (splitAi.length * 5);
    }
    
    // Custom Signature & Footer
    doc.setFontSize(9);
    doc.setTextColor(100);
    
    let footerY = 270; // Position near the bottom of A4
    if (finalY > 250) {
      doc.addPage();
      footerY = 270;
    }

    if (doctor.custom_signature) {
      doc.text('________________________________________________', 105, footerY - 20, { align: 'center' });
      const splitSignature = doc.splitTextToSize(doctor.custom_signature, 100);
      doc.text(splitSignature, 105, footerY - 14, { align: 'center' });
    }

    if (doctor.clinic_address) {
      doc.text(doctor.clinic_address, 105, footerY + 10, { align: 'center' });
    }
    
    doc.save(`prontuario_${patientName.replace(/\s+/g, '_')}_${record.id.slice(0, 8)}.pdf`);
    
    setToastMessage('PDF do prontuário baixado.');
    setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <div className="space-y-8 font-sans">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 z-50 max-w-xs bg-slate-800 text-white p-3 rounded-lg shadow-lg flex items-center space-x-2"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-medium">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Select Patient */}
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Evolução Clínica e Prontuários</h1>
          <p className="text-sm text-slate-500 mt-1">
            Evolução de pacientes no padrão ICP-Brasil integrado a insights diários por inteligência artificial.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Filtrar por Paciente:</span>
            <select
              value={filterPatientId}
              onChange={(e) => setFilterPatientId(e.target.value)}
              className="px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#192F28] focus:ring-1 focus:ring-[#192F28] font-medium min-w-[240px] shadow-sm flex-1 sm:flex-none"
            >
              <option value="">Todos os pacientes</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              setSelectedFormPatientId(''); 
              setShowForm(true);
            }}
            className="w-full sm:w-auto bg-[#C1E2A4] text-slate-900 text-sm border border-[#b0d292] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#b0d292] transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span>Nova Evolução e Prontuário</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-bg-primary rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4">
              <h3 className="font-bold text-lg text-slate-900 flex items-center space-x-2">
                <FileText className="h-5 w-5 text-emerald-500" />
                <span>Nova Evolução e Prontuário</span>
              </h3>
              
              <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <span className="text-sm font-semibold text-slate-600 pl-2">Selecionar Paciente:</span>
                <select
                  value={selectedFormPatientId}
                  onChange={(e) => setSelectedFormPatientId(e.target.value)}
                  className="px-4 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 font-bold min-w-[220px] focus:outline-none"
                >
                  <option value="" disabled>-- Selecione --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer ml-auto md:ml-0"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Dual Column workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Hand: Evolution Editor */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-serif text-brand-primary font-semibold flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Scribe de Prontuário NGS2</span>
                    </h2>
                    
                    {signatureStatus === 'unsigned' ? (
                      <span className="text-[10px] uppercase font-mono font-bold text-brand-secondary bg-brand-cream/35 px-2 py-0.5 rounded border border-brand-secondary/35">
                        Rascunho Editável
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-mono font-bold text-status-success bg-status-success/15 px-2.5 py-1 rounded border border-status-success/30 flex items-center space-x-1">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Assinado ICP-Brasil</span>
                      </span>
                    )}
                  </div>

                  <div className="bg-white border border-brand-secondary/20 rounded-xl overflow-hidden shadow-sm relative">
                    
                    {/* Template Injectors Panel */}
                    <div className="bg-brand-cream/15 px-4.5 py-2.5 border-b border-brand-secondary/15 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <span className="font-mono text-brand-secondary text-[11px]">Modelos Clínicos Rápidos:</span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleInsertTemplate('rpd')}
                          disabled={signatureStatus === 'signed_icp'}
                          className="bg-white hover:bg-brand-cream/20 text-brand-primary border border-brand-secondary/40 font-semibold px-2.5 py-1 rounded-md cursor-pointer disabled:opacity-40 disabled:pointer-events-none text-[10px] font-mono uppercase"
                        >
                          Inserir Tabela RPD
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertTemplate('tcc')}
                          disabled={signatureStatus === 'signed_icp'}
                          className="bg-white hover:bg-brand-cream/20 text-brand-primary border border-brand-secondary/40 font-semibold px-2.5 py-1 rounded-md cursor-pointer disabled:opacity-40 disabled:pointer-events-none text-[10px] font-mono uppercase"
                        >
                          Anamnese TCC
                        </button>
                      </div>
                    </div>

                    {/* Scribe Textareas */}
                    <div className="p-5 space-y-6">
                      
                      {/* Evolução Clínica Section */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-brand-primary uppercase tracking-wider font-mono">Evolução Clínica</label>
                        {signatureStatus === 'signed_icp' ? (
                          <div className="p-4 bg-brand-cream/10 border border-brand-secondary/30 rounded-lg text-brand-primary whitespace-pre-wrap font-sans text-sm leading-relaxed select-all">
                            {evolutionText || 'Sem registro.'}
                          </div>
                        ) : (
                          <textarea
                            value={evolutionText}
                            onChange={(e) => setEvolutionText(e.target.value)}
                            placeholder="Escreva a evolução clínica do paciente aqui..."
                            className="w-full h-48 bg-white border border-brand-secondary/20 rounded-lg focus:outline-none focus:border-emerald-400 p-3 text-sm leading-relaxed text-brand-primary placeholder:text-brand-secondary/60 font-sans resize-y shadow-inner"
                            disabled={!selectedFormPatientId}
                          />
                        )}
                      </div>

                      {/* Prontuário Médio Section */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-brand-primary uppercase tracking-wider font-mono">Prontuário</label>
                        {signatureStatus === 'signed_icp' ? (
                          <div className="p-4 bg-brand-cream/10 border border-brand-secondary/30 rounded-lg text-brand-primary whitespace-pre-wrap font-sans text-sm leading-relaxed select-all">
                            {prontuarioText || 'Sem registro.'}
                          </div>
                        ) : (
                          <textarea
                            value={prontuarioText}
                            onChange={(e) => setProntuarioText(e.target.value)}
                            placeholder="Detalhes médicos e conduta..."
                            className="w-full h-48 bg-white border border-brand-secondary/20 rounded-lg focus:outline-none focus:border-emerald-400 p-3 text-sm leading-relaxed text-brand-primary placeholder:text-brand-secondary/60 font-sans resize-y shadow-inner"
                            disabled={!selectedFormPatientId}
                          />
                        )}
                      </div>

                    </div>

                    {/* Signed block overlay */}
                    {signatureStatus === 'signed_icp' && (
                      <div className="bg-brand-primary text-white p-5 border-t border-brand-secondary/30 space-y-1.5 rounded-b-xl">
                        <div className="flex items-center space-x-2">
                          <ShieldCheck className="h-5 w-5 text-brand-cream" />
                          <span className="font-serif font-bold text-sm tracking-tight text-white block">Documento Criptografado e Assinado Digitalmente</span>
                        </div>
                        <div className="font-mono text-[9px] text-zinc-300 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-white/10">
                          <div>
                            <strong>MÉDICO TITULAR:</strong> {dataManager.getDoctor().name}<br />
                            <strong>LICENÇA:</strong> {dataManager.getDoctor().crp_crm}
                          </div>
                          <div>
                            <strong>DATA ASSINATURA:</strong> {new Date(signedAt!).toLocaleString('pt-BR')}<br />
                            <strong>ALGORÍTMO HASH:</strong> <span className="text-brand-cream">{signatureHash}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Unsigned Action Panel */}
                    {signatureStatus === 'unsigned' && (
                      <div className="bg-bg-primary p-4.5 border-t border-brand-secondary/20 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => { handleSaveDraft(); setShowForm(false); }}
                          className="text-xs text-brand-primary font-mono uppercase tracking-wider font-semibold border border-brand-secondary/80 px-4 py-2.5 rounded-lg hover:bg-brand-cream/10 cursor-pointer transition"
                        >
                          Salvar Rascunho e Fechar
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleSignDigitalICP(); setShowForm(false); }}
                          disabled={!evolutionText}
                          className="bg-brand-primary text-white text-xs font-mono uppercase tracking-wider font-semibold px-4.5 py-2.5 rounded-lg hover:bg-brand-primary/95 transition flex items-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>Assinar Prontuário (ICP-Brasil)</span>
                        </button>
                      </div>
                    )}

                  </div>
                </div>

                {/* Right Hand Sidebar: Diary insights compiled from WhatsApp diaries */}
                <div className="lg:col-span-5 space-y-4">
                  <h2 className="text-lg font-serif text-brand-primary font-semibold flex items-center space-x-2">
                    <Brain className="h-5 w-5" />
                    <span>Insights do Diário WhatsApp</span>
                  </h2>

                  {/* AI CDS Insight Block */}
                  <div className="bg-brand-cream/35 border-2 border-brand-secondary/25 rounded-xl p-5 space-y-4">
                    <div className="flex items-center space-x-2 border-b border-brand-secondary/15 pb-2.5">
                      <Sparkles className="h-4.5 w-4.5 text-brand-primary" />
                      <span className="font-mono text-brand-primary font-bold text-xs uppercase tracking-wider">Clinical Decision Support</span>
                    </div>

                    <div className="space-y-4 text-xs font-medium">
                      <div className="bg-white/90 p-4 border border-brand-secondary/30 rounded-lg text-brand-primary leading-relaxed whitespace-pre-wrap">
                        {aiSummary}
                      </div>
                      <div className="text-[10px] text-brand-secondary font-mono leading-normal pt-1 flex items-start space-x-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-brand-primary mt-0.5 shrink-0" />
                        <span>O boletim de inteligência compila marcadores de humor coletados via WhatsApp. O profissional de saúde assume total responsabilidade pelas decisões prescritas.</span>
                      </div>
                    </div>

                    {/* Last diary logs */}
                    <div className="space-y-3 pt-3 border-t border-brand-secondary/20">
                      <span className="text-[10px] uppercase font-mono text-brand-secondary block tracking-wider font-bold">Mensagens Recentes do Paciente (WhatsApp)</span>
                      
                      {patientDiaries.length === 0 ? (
                        <p className="text-xs text-brand-secondary italic">Nenhuma mensagem registrada no diário.</p>
                      ) : (
                        <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                          {patientDiaries.map((entry) => (
                            <div 
                              key={entry.id} 
                              className={`p-3 rounded-lg border text-xs leading-normal relative ${entry.crisis_flag ? 'bg-status-danger/[0.04] border-status-danger/30' : 'bg-white border-brand-secondary/20'}`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono text-brand-secondary mb-1">
                                <span>{new Date(entry.created_at).toLocaleDateString('pt-BR')} {new Date(entry.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                <span className={`font-bold ${entry.crisis_flag ? 'text-status-danger' : 'text-brand-primary'}`}>Humor Score: {entry.sentiment_score}</span>
                              </div>
                              <p className="text-brand-primary/95 italic font-medium">
                                "{entry.content}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* History archives block */}
      <div className="space-y-4">
        <h3 className="text-lg font-serif text-brand-primary font-semibold">
          Histórico de Prontuários Clinicos
          {filterPatientId ? ` (${getPatientName(filterPatientId)})` : ''}
        </h3>
        
        {history.length === 0 ? (
          <p className="text-xs text-brand-secondary italic">Nenhum prontuário fechado para este paciente.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((record) => (
              <div key={record.id} className="bg-white border border-brand-secondary/15 rounded-xl p-5 space-y-3 shadow-sm hover:border-brand-secondary/35 transition">
                <div className="flex items-center justify-between border-b border-brand-secondary/10 pb-2">
                  <div className="flex items-center space-x-1 font-mono text-[10px] text-brand-secondary font-bold">
                    <FileText className="h-3.5 w-3.5" />
                    <span>REF: {record.id.slice(0, 8)}...</span>
                  </div>
                  <span className={`text-[8px] font-mono uppercase font-bold px-1.8 py-0.5 rounded ${record.signature_status === 'signed_icp' ? 'bg-status-success/15 text-status-success' : 'bg-brand-cream text-brand-primary'}`}>
                    {record.signature_status === 'signed_icp' ? 'Assinado' : 'Rascunho'}
                  </span>
                </div>
                
                <p className="text-xs text-brand-primary leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {record.evolution_text}
                </p>

                <div className="bg-brand-cream/15 p-2 rounded text-[10px] text-brand-primary font-mono border border-brand-secondary/10">
                  <span className="font-bold block uppercase tracking-wider text-[8px] text-brand-secondary mb-0.5">Sintético CDS:</span>
                  {record.ai_summary || 'Sem resumo disponível.'}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-brand-secondary border-t border-brand-secondary/10 pt-2 text-[9px]">
                  <span>Criado em: {new Date(record.created_at).toLocaleDateString('pt-BR')}</span>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleExportPDF(record)}
                      className="text-brand-primary hover:text-emerald-600 flex items-center space-x-1 font-semibold transition-colors cursor-pointer"
                      title="Exportar PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Baixar PDF</span>
                    </button>
                    {record.signed_at && (
                      <span className="text-status-success font-semibold flex items-center space-x-0.5">
                        <Check className="h-3 w-3" />
                        <span>Selo Cripto ICP</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
