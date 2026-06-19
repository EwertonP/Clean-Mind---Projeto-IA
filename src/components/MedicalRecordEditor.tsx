import React, { useState, useEffect, useRef } from 'react';
import { Brain, FileText, Lock, Sparkles, ShieldCheck, Heart, User, Send, ArrowRight, CornerDownRight, Check, AlertTriangle, CheckCircle2, Download, Hospital, Trash2, X, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, DiaryEntry, MedicalRecord, dataManager } from '../data';
import html2pdf from 'html2pdf.js';

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
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [formType, setFormType] = useState<'soap' | 'receita' | 'exame' | 'atestado' | 'livre'>('livre');
  
  // Toast Alert State
  const [toastMessage, setToastMessage] = useState('');

  // PDF Export States
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportRecord, setExportRecord] = useState<MedicalRecord | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Viewing State
  const [viewingRecord, setViewingRecord] = useState<MedicalRecord | null>(null);

  const getRecordTypeLabel = (record: MedicalRecord) => {
    const labels: string[] = [];
    if (record.evolution_text) {
      labels.push("Evolução Clínica");
    }
    if (record.prontuario_text) {
      if (record.prontuario_text.includes("SOLICITAÇÃO DE EXAMES")) labels.push("Solicitação de Exames");
      else if (record.prontuario_text.includes("RECEITUÁRIO MÉDICO")) labels.push("Receituário");
      else if (record.prontuario_text.includes("ATESTADO MÉDICO")) labels.push("Atestado");
      else labels.push("Prontuário Médico");
    }
    return labels.join(" e ") || "Registro Clínico";
  };

  // Templates
  const templates = {
    soap: `[S] Subjetivo:\n- Queixa principal:\n- Sintomas atuais:\n\n[O] Objetivo:\n- Sinais vitais:\n- Exame físico:\n\n[A] Avaliação:\n- Diagnóstico/Hipótese diagnóstica:\n\n[P] Plano:\n- Conduta terapêutica:\n- Prescrição médica:\n- Recomendações e retorno:`,
    receita: `RECEITUÁRIO MÉDICO\n\nUso Oral:\n1. [Nome do Medicamento] --- [Dosagem]\n   Tomar [quantidade] [forma], via oral, a cada [intervalo] horas, durante [duração].\n\nUso Tópico:\n2. [Medicamento]\n   Aplicar na área afetada [frequência].\n\nRecomendações extras:\n- `,
    exame: `SOLICITAÇÃO DE EXAMES\n\nExames Laboratoriais:\n1. Hemograma Completo\n2. Glicemia em Jejum\n3. [Exame adicional]\n\nExames de Imagem:\n1. [Raio-x / Ultrassom]\n\nJustificativa Clínica:\n- Avaliação de rotina / Investigação de quadro atual de [Sintoma].`,
    atestado: `ATESTADO MÉDICO\n\nAtesto para os devidos fins de direito que o(a) paciente encontra-se sob meus cuidados médicos, necessitando de ______ dia(s) de afastamento de suas atividades laborais e/ou escolares a partir de ___/___/___ por motivo de doença.\n\nCID-10: ______ (opcional caso autorizado pelo paciente)`
  };

  const applyTemplate = (type: 'soap' | 'receita' | 'exame' | 'atestado') => {
    if (type === 'soap') {
      setEvolutionText((prev) => prev ? prev + '\n\n' + templates.soap : templates.soap);
    } else {
      setProntuarioText((prev) => prev ? prev + '\n\n' + templates[type] : templates[type]);
    }
    setToastMessage('Modelo aplicado com sucesso.');
    setTimeout(() => setToastMessage(''), 3000);
  };

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
    setExportRecord(record);
    setIsExporting(true);
    setToastMessage('Gerando PDF do prontuário...');
  };

  const handleDeleteRecord = (id: string) => {
    dataManager.deleteMedicalRecord(id);
    
    const list = dataManager.getMedicalRecords().sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (filterPatientId) {
      setHistory(list.filter(r => r.patient_id === filterPatientId));
    } else {
      setHistory(list);
    }
    
    if (viewingRecord?.id === id) {
      setViewingRecord(null);
    }
    setToastMessage('Prontuário excluído com sucesso.');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleEditRecord = (record: MedicalRecord) => {
    const list = dataManager.getMedicalRecords();
    const recordIndex = list.findIndex(r => r.id === record.id);
    if (recordIndex !== -1) {
      list[recordIndex].signature_status = 'unsigned';
      delete list[recordIndex].signed_at;
      dataManager.saveMedicalRecords(list);
    }
    
    setSelectedFormPatientId(record.patient_id);
    setEvolutionText(record.evolution_text || '');
    setProntuarioText(record.prontuario_text || '');
    setAiSummary(record.ai_summary || '');
    setSignatureStatus('unsigned');
    setFormType('livre'); // Fallback form type to open form
    setFormStep(3);
    setShowForm(true);
    setViewingRecord(null);
    
    const updatedList = dataManager.getMedicalRecords().sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (filterPatientId) {
      setHistory(updatedList.filter(r => r.patient_id === filterPatientId));
    } else {
      setHistory(updatedList);
    }
  };

  useEffect(() => {
    if (exportRecord && isExporting && exportRef.current) {
      const patientName = getPatientName(exportRecord.patient_id);
      
      const opt = {
        margin:       10,
        filename:     `prontuario_${patientName.replace(/\s+/g, '_')}_${exportRecord.id.slice(0, 8)}.pdf`,
        image:        { type: 'jpeg' as "jpeg", quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, windowWidth: 800 },
        jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      // We use a small timeout to let React render the DOM completely before snapping
      setTimeout(() => {
        html2pdf().from(exportRef.current).set(opt).save().then(() => {
          setIsExporting(false);
          setExportRecord(null);
          setToastMessage('PDF baixado com sucesso.');
          setTimeout(() => setToastMessage(''), 3000);
        });
      }, 500);
    }
  }, [exportRecord, isExporting]);

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
              setFormStep(1);
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
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
               <h3 className="font-bold text-lg text-slate-900 flex items-center space-x-2">
                 <FileText className="h-5 w-5 text-emerald-500" />
                 <span>{formStep === 1 ? 'Selecione o Paciente' : formStep === 2 ? 'Tipo de Documento' : 'Nova Evolução e Prontuário'}</span>
               </h3>
               <div className="flex items-center space-x-4">
                 {formStep > 1 && selectedFormPatientId && (
                   <div className="flex bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 items-center space-x-2 text-sm">
                     <User className="h-4 w-4 text-emerald-600" />
                     <span className="font-semibold text-slate-700">{getPatientName(selectedFormPatientId)}</span>
                   </div>
                 )}
                 <button 
                   onClick={() => setShowForm(false)}
                   className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                 >
                   ×
                 </button>
               </div>
            </div>
            
            <div className="p-0 overflow-y-auto w-full flex-1 bg-slate-50/50">
              {formStep === 1 && (
                  <div className="max-w-5xl mx-auto w-full p-8 pb-16">
                    <h2 className="text-2xl font-serif font-bold text-[#192F28] mb-8 text-center mt-4">Para qual paciente é o registro?</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {patients.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => { setSelectedFormPatientId(p.id); setFormStep(2); }}
                          className="bg-white hover:bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4 cursor-pointer text-center transition-all hover:border-[#C1E2A4] hover:shadow-md h-full group"
                        >
                          <div className="bg-emerald-50 group-hover:bg-emerald-100 p-4 rounded-full transition-colors">
                            <User className="h-8 w-8 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-lg leading-tight">{p.name}</p>
                            <p className="text-sm text-slate-500 mt-1 font-mono">{p.phone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
              )}

              {formStep === 2 && (
                  <div className="max-w-4xl mx-auto w-full p-8 pb-16">
                     <div className="flex items-center space-x-4 mb-8">
                         <button onClick={() => setFormStep(1)} className="text-slate-400 hover:text-slate-900 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm transition-colors cursor-pointer">
                             <ArrowRight className="h-5 w-5 rotate-180" />
                         </button>
                         <h2 className="text-2xl font-serif font-bold text-[#192F28] mt-1">O que você deseja registrar hoje?</h2>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {[
                         { id: 'soap', label: 'Evolução (SOAP)', desc: 'Registro de evolução clínica de rotina e notas de progresso.', icon: FileText },
                         { id: 'receita', label: 'Receituário', desc: 'Prescrição de medicamentos comuns ou controlados.', icon: FileText },
                         { id: 'exame', label: 'Solicitação de Exames', desc: 'Guia de solicitação para laboratório ou imagem.', icon: FileText },
                         { id: 'atestado', label: 'Atestado Médico', desc: 'Declaração de dias de afastamento e CID-10.', icon: FileText },
                         { id: 'livre', label: 'Em Branco', desc: 'Inicia um rascunho de prontuário sem formatação.', icon: FileText }
                       ].map((type) => (
                         <button
                            key={type.id}
                            onClick={() => {
                               setFormType(type.id as any);
                               setEvolutionText('');
                               setProntuarioText('');
                               if (type.id !== 'livre') {
                                 applyTemplate(type.id as any);
                               }
                               setFormStep(3);
                            }}
                            className="bg-white border border-slate-200 p-6 rounded-2xl flex items-start space-x-5 cursor-pointer text-left transition-all hover:border-[#C1E2A4] hover:shadow-md group"
                         >
                            <div className="bg-slate-50 group-hover:bg-[#C1E2A4]/30 p-4 rounded-xl shrink-0 transition-colors">
                               <type.icon className="h-6 w-6 text-slate-700 group-hover:text-[#192F28] transition-colors" />
                            </div>
                            <div className="pt-1">
                               <h3 className="font-bold text-slate-900 text-lg pb-1">{type.label}</h3>
                               <p className="text-sm text-slate-500 leading-relaxed">{type.desc}</p>
                            </div>
                         </button>
                       ))}
                     </div>
                  </div>
              )}

              {formStep === 3 && (
                 <div className="p-6">
                    <div className="flex items-center space-x-4 mb-6">
                        <button onClick={() => setFormStep(2)} className="text-slate-400 hover:text-slate-900 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm transition-colors cursor-pointer">
                            <ArrowRight className="h-5 w-5 rotate-180" />
                        </button>
                    </div>
                   <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Hand: Evolution Editor */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-serif text-[#192F28] font-semibold flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-[#C1E2A4]" />
                      <span>Documento de Registro Formal</span>
                    </h2>
                    
                    {signatureStatus === 'unsigned' ? (
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-500 bg-[#C1E2A4]/35 px-2 py-0.5 rounded border border-[#C1E2A4]/35">
                        Rascunho Editável
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center space-x-1">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Assinado ICP-Brasil</span>
                      </span>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
                    
                    {/* Scribe Textareas with paper design */}
                    <div className="bg-[#fcfcfc] p-8 min-h-[500px] border-l-4 border-[#C1E2A4] space-y-8 font-sans shadow-inner">
                      
                      {/* Letterhead mock */}
                      <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200">
                        <div className="flex items-center space-x-3">
                          <div className="bg-[#192F28] p-2 rounded-lg">
                            <Hospital className="h-5 w-5 text-[#C1E2A4]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-serif font-bold text-[#192F28] uppercase tracking-wide leading-tight">{dataManager.getDoctor().clinic_name || 'Clínica Médica'}</h3>
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">Registro Clínico Oficial</p>
                          </div>
                        </div>
                      </div>

                      {/* Evolução Clínica Section */}
                      {(formType === 'livre' || formType === 'soap') && (
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-[#192F28] uppercase tracking-wider font-mono">
                          <FileText className="h-3.5 w-3.5 text-[#C1E2A4]" />
                          {formType === 'livre' ? 'Evolução Clínica' : 'Evolução (SOAP)'}
                        </label>
                        {signatureStatus === 'signed_icp' ? (
                          <div className="p-4 bg-white border border-slate-200 rounded text-slate-800 whitespace-pre-wrap font-sans text-sm leading-relaxed select-all">
                            {evolutionText || 'Sem registro.'}
                          </div>
                        ) : (
                          <div className="relative">
                            <textarea
                              value={evolutionText}
                              onChange={(e) => setEvolutionText(e.target.value)}
                              placeholder="Descreva a evolução aqui..."
                              className="w-full h-48 bg-transparent border-0 border-b border-dashed border-slate-300 focus:outline-none focus:border-[#192F28] focus:ring-0 p-0 text-sm leading-8 text-slate-800 placeholder:text-slate-300 font-sans resize-y shadow-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjMyIj48bGluZSB4MT0iMCIgeTE9IjMxIiB4Mj0iMTAwJSIgeTI9IjMxIiBzdHJva2U9IiNlMGUwZTAiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] bg-local"
                              disabled={!selectedFormPatientId}
                              style={{ lineHeight: '32px' }}
                            />
                          </div>
                        )}
                      </div>
                      )}

                      {/* Prontuário Médio Section */}
                      {(formType === 'livre' || formType === 'receita' || formType === 'exame' || formType === 'atestado') && (
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-[#192F28] uppercase tracking-wider font-mono">
                          <FileText className="h-3.5 w-3.5 text-[#C1E2A4]" />
                          {formType === 'receita' ? 'Receituário' : formType === 'exame' ? 'Solicitação de Exames' : formType === 'atestado' ? 'Atestado Médico' : 'Prontuário Médico (Conduta & Exames)'}
                        </label>
                        {signatureStatus === 'signed_icp' ? (
                          <div className="p-4 bg-white border border-slate-200 rounded text-slate-800 whitespace-pre-wrap font-sans text-sm leading-relaxed select-all">
                            {prontuarioText || 'Sem registro.'}
                          </div>
                        ) : (
                          <div className="relative">
                            <textarea
                              value={prontuarioText}
                              onChange={(e) => setProntuarioText(e.target.value)}
                              placeholder="Detalhes adicionais, exames e condutas..."
                              className="w-full h-40 bg-transparent border-0 border-b border-dashed border-slate-300 focus:outline-none focus:border-[#192F28] focus:ring-0 p-0 text-sm leading-8 text-slate-800 placeholder:text-slate-300 font-sans resize-y shadow-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjMyIj48bGluZSB4MT0iMCIgeTE9IjMxIiB4Mj0iMTAwJSIgeTI9IjMxIiBzdHJva2U9IiNlMGUwZTAiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] bg-local"
                              disabled={!selectedFormPatientId}
                              style={{ lineHeight: '32px' }}
                            />
                          </div>
                        )}
                      </div>
                      )}

                    </div>

                    {/* Signed block overlay */}
                    {signatureStatus === 'signed_icp' && (
                      <div className="bg-[#192F28] text-white p-5 border-t border-slate-200/30 space-y-1.5 rounded-b-xl">
                        <div className="flex items-center space-x-2">
                          <ShieldCheck className="h-5 w-5 text-[#C1E2A4]" />
                          <span className="font-serif font-bold text-sm tracking-tight text-white block">Documento Criptografado e Assinado Digitalmente</span>
                        </div>
                        <div className="font-mono text-[9px] text-zinc-300 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-white/10">
                          <div>
                            <strong>MÉDICO TITULAR:</strong> {dataManager.getDoctor().name}<br />
                            <strong>LICENÇA:</strong> {dataManager.getDoctor().crp_crm}
                          </div>
                          <div>
                            <strong>DATA ASSINATURA:</strong> {new Date(signedAt!).toLocaleString('pt-BR')}<br />
                            <strong>ALGORÍTMO HASH:</strong> <span className="text-[#C1E2A4]">{signatureHash}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Unsigned Action Panel */}
                    {signatureStatus === 'unsigned' && (
                      <div className="bg-slate-50 p-4.5 border-t border-slate-200 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => { handleSaveDraft(); setShowForm(false); }}
                          className="text-xs text-[#192F28] font-mono uppercase tracking-wider font-semibold border border-slate-300 px-4 py-2.5 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                        >
                          Salvar Rascunho e Fechar
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleSignDigitalICP(); setShowForm(false); }}
                          disabled={!evolutionText && !prontuarioText}
                          className="bg-[#192F28] text-white text-xs font-mono uppercase tracking-wider font-semibold px-4.5 py-2.5 rounded-lg hover:bg-[#192F28]/95 transition flex items-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                  <h2 className="text-lg font-serif text-[#192F28] font-semibold flex items-center space-x-2">
                    <Brain className="h-5 w-5 text-[#C1E2A4]" />
                    <span>Insights do Diário WhatsApp</span>
                  </h2>

                  {/* AI CDS Insight Block */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                      <Sparkles className="h-4.5 w-4.5 text-[#192F28]" />
                      <span className="font-mono text-[#192F28] font-bold text-xs uppercase tracking-wider">Clinical Decision Support</span>
                    </div>

                    <div className="space-y-4 text-xs font-medium">
                      <div className="bg-white p-4 border border-slate-200 rounded-lg text-[#192F28] leading-relaxed whitespace-pre-wrap">
                        {aiSummary}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono leading-normal pt-1 flex items-start space-x-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-[#192F28] mt-0.5 shrink-0" />
                        <span>O boletim de inteligência compila marcadores de humor coletados via WhatsApp. O profissional de saúde assume total responsabilidade pelas decisões prescritas.</span>
                      </div>
                    </div>

                    {/* Last diary logs */}
                    <div className="space-y-3 pt-4 border-t border-slate-200 text-[#192F28]">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block tracking-wider font-bold mb-3">Mensagens Recentes do Paciente (WhatsApp)</span>
                      
                      {patientDiaries.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Nenhuma mensagem registrada no diário.</p>
                      ) : (
                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                          {patientDiaries.map((entry) => (
                            <div 
                              key={entry.id} 
                              className={`p-3.5 rounded-xl border text-xs leading-normal relative ${entry.crisis_flag ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-2">
                                <span>{new Date(entry.created_at).toLocaleDateString('pt-BR')} {new Date(entry.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                <span className={`font-bold px-1.5 py-0.5 rounded ${entry.crisis_flag ? 'text-red-700 bg-red-100' : 'text-[#192F28] bg-slate-100'}`}>Score: {entry.sentiment_score}</span>
                              </div>
                              <p className="text-[#192F28] italic font-medium pt-1">
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
            )}
            </div>
          </div>
        </div>
      )}

      {/* History archives block */}
      <div className="space-y-4">
        <h3 className="text-lg font-serif text-[#192F28] font-semibold">
          Histórico de Prontuários Clinicos
          {filterPatientId ? ` (${getPatientName(filterPatientId)})` : ''}
        </h3>
        
        {history.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Nenhum prontuário fechado para este paciente.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((record) => (
              <div key={record.id} onClick={() => setViewingRecord(record)} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm hover:border-slate-300 transition group cursor-pointer hover:shadow-md">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-sm text-[#192F28]">{getPatientName(record.patient_id)}</span>
                    <div className="flex items-center space-x-1 font-mono text-[10px] text-slate-500 font-bold group-hover:text-[#192F28] transition-colors">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{getRecordTypeLabel(record)}</span>
                    </div>
                  </div>
                  <span className={`text-[8px] font-mono uppercase font-bold px-2 py-0.5 rounded mt-0.5 ${record.signature_status === 'signed_icp' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-[#C1E2A4]/20 text-[#192F28] border border-[#C1E2A4]/40'}`}>
                    {record.signature_status === 'signed_icp' ? 'Assinado' : 'Rascunho'}
                  </span>
                </div>
                
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-3">
                  {record.evolution_text || record.prontuario_text || "Documento vazio."}
                </p>

                {record.ai_summary && (
                  <div className="bg-slate-50 p-2.5 rounded-lg text-[10px] text-[#192F28] font-mono border border-slate-200">
                    <span className="font-bold block uppercase tracking-wider text-[8px] text-slate-500 mb-1">Sintético CDS:</span>
                    <span className="line-clamp-2">{record.ai_summary}</span>
                  </div>
                )}

                <div className="flex items-center justify-between font-mono text-slate-500 border-t border-slate-100 pt-3 mt-2 text-[9px]">
                  <span>Criado em: {new Date(record.created_at).toLocaleDateString('pt-BR')}</span>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExportPDF(record); }}
                      className="text-[#192F28] hover:text-emerald-600 flex items-center space-x-1 font-semibold transition-colors cursor-pointer"
                      title="Exportar PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Baixar PDF</span>
                    </button>
                    {record.signed_at && (
                      <span className="text-emerald-600 font-semibold flex items-center space-x-0.5 bg-emerald-50 px-1.5 py-0.5 rounded">
                        <Check className="h-3 w-3" />
                        <span>Selo ICP</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden Export Template */}
      {exportRecord && (
        <div className="absolute top-[9999px] left-[9999px] pointer-events-none opacity-0">
          <div ref={exportRef} className="w-[794px] min-h-[1122px] bg-[#ffffff] px-12 pt-8 pb-16 font-sans text-[#0f172a] border-t-8 border-[#192F28] relative box-border">
            
            {/* Clinic Logo */}
            {dataManager.getDoctor().clinic_logo && (
              <div className="w-40 mb-6 flex justify-start">
                <img src={dataManager.getDoctor().clinic_logo} alt="Logo da Clínica" className="max-w-full h-auto max-h-24 object-contain" />
              </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[#e2e8f0] pb-6 mb-6 w-full">
              <div className="bg-[#192F28] p-3 rounded-xl shrink-0">
                <Hospital className="h-8 w-8 text-[#C1E2A4]" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-[#192F28]">{dataManager.getDoctor().clinic_name || 'Clínica Médica'}</h1>
                <p className="text-sm font-medium text-[#64748b] mt-1">Prontuário Médico Eletrônico</p>
              </div>
            </div>

            {/* Patient Info & Signature Box */}
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-8 mb-8 relative overflow-hidden flex flex-col">
               <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full pointer-events-none" style={{ backgroundColor: 'rgba(193, 226, 164, 0.2)' }}></div>
               <div className="absolute bottom-0 left-0 w-24 h-24 rounded-tr-full pointer-events-none" style={{ backgroundColor: 'rgba(241, 245, 249, 0.8)' }}></div>
               
               <div className="flex items-stretch mb-6 relative z-10 w-full gap-8">
                 
                 {/* Patient */}
                 <div className="flex-1 flex flex-col justify-start">
                    <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#94a3b8] mb-1">Paciente</h3>
                    <p className="text-xl font-bold text-[#192F28]">{getPatientName(exportRecord.patient_id)}</p>
                 </div>

                 {/* Doctor Signature */}
                 <div className="flex-1 flex flex-col justify-start">
                    <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#94a3b8] mb-1">Médico Responsável</h3>
                    <div className="mt-8 border-t border-[#94a3b8] pt-2 max-w-[240px]">
                      <p className="text-sm font-bold text-[#192F28]">Dr(a). {dataManager.getDoctor().name.replace(/^Dr\(a\)\.\s*/, '').replace(/^Dr\.\s*/, '')}</p>
                      <p className="text-xs text-[#64748b] font-mono mt-0.5">CRM: {dataManager.getDoctor().crp_crm}</p>
                    </div>
                 </div>
               </div>
               
               <div className="flex flex-col items-start justify-center pt-6 border-t border-[#cbd5e1] w-full relative z-10">
                 <div className="flex items-center space-x-2">
                   {exportRecord.signature_status === 'signed_icp' ? (
                     <div className="flex items-center space-x-2 text-[#059669]">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-[11px] uppercase tracking-widest font-bold">Documento Assinado Digitalmente</span>
                     </div>
                   ) : (
                     <div className="flex items-center space-x-2 text-[#92400e]">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-[11px] uppercase tracking-widest font-bold">Rascunho Não Assinado</span>
                     </div>
                   )}
                 </div>
                 {exportRecord.signed_at && (
                    <span className="text-[10px] text-[#64748b] mt-1 font-mono">
                      Validado em {new Date(exportRecord.signed_at).toLocaleDateString('pt-BR')} às {new Date(exportRecord.signed_at).toLocaleTimeString('pt-BR')}
                    </span>
                 )}
               </div>
            </div>

            {/* Date and Context */}
            <div className="mb-6 flex justify-between items-end border-b-2 border-[#f1f5f9] pb-2">
              <h3 className="text-sm font-bold text-[#192F28] uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#059669]" />
                Registros Clínicos
              </h3>
              <div className="text-right flex items-baseline gap-1">
                <span className="text-sm font-bold text-[#334155]">{new Date(exportRecord.created_at).toLocaleDateString('pt-BR')}</span>
                <span className="text-[9px] font-mono text-[#94a3b8] uppercase">às {new Date(exportRecord.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>

            {/* Evolução */}
            {(exportRecord.evolution_text || (!exportRecord.evolution_text && !exportRecord.prontuario_text)) && (
              <div className="mb-8 pl-6 border-l-2" style={{ borderColor: 'rgba(193, 226, 164, 0.5)' }}>
                 <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Evolução Clínica / SOAP</h4>
                 <div className="text-sm text-[#1e293b] leading-relaxed whitespace-pre-wrap">
                   {exportRecord.evolution_text || 'Sem evolução registrada.'}
                 </div>
              </div>
            )}

            {/* Prontuário */}
            {exportRecord.prontuario_text && (
              <div className="mb-8 pl-6 border-l-2" style={{ borderColor: 'rgba(193, 226, 164, 0.5)' }}>
                 <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Prontuário Médico</h4>
                 <div className="text-sm text-[#1e293b] leading-relaxed whitespace-pre-wrap">
                   {exportRecord.prontuario_text}
                 </div>
              </div>
            )}

            {/* Insights */}
            {exportRecord.ai_summary && (
              <div className="mb-12 bg-[#f8fafc] p-6 rounded-xl border border-[#e2e8f0]">
                 <h3 className="text-sm font-bold text-[#192F28] uppercase tracking-wider mb-4 flex items-center gap-2">
                   <Sparkles className="h-4 w-4 text-[#3b82f6]" />
                   Observações Auxiliares (CDS)
                 </h3>
                 <div className="text-sm text-[#334155] leading-relaxed whitespace-pre-wrap">
                   {exportRecord.ai_summary}
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Record Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="bg-white max-w-4xl w-full h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="bg-[#192F28] px-8 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 text-white">
                <FileText className="h-5 w-5 text-[#C1E2A4]" />
                <div>
                  <h2 className="text-lg font-bold font-serif">{getPatientName(viewingRecord.patient_id)}</h2>
                  <p className="text-xs font-mono text-[#C1E2A4]/80">{getRecordTypeLabel(viewingRecord)} • validado em {new Date(viewingRecord.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <button onClick={() => setViewingRecord(null)} className="text-white/60 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-8 overflow-y-auto flex-1 space-y-8 bg-slate-50">
              {(viewingRecord.evolution_text || (!viewingRecord.evolution_text && !viewingRecord.prontuario_text)) && (
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span>Evolução Clínica / SOAP</span>
                  </h4>
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                    {viewingRecord.evolution_text || 'Sem evolução registrada.'}
                  </div>
                </div>
              )}

              {viewingRecord.prontuario_text && (
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span>Prontuário Médico</span>
                  </h4>
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                    {viewingRecord.prontuario_text}
                  </div>
                </div>
              )}

              {viewingRecord.ai_summary && (
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center space-x-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Observações Auxiliares (CDS)</span>
                  </h4>
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                    {viewingRecord.ai_summary}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="bg-white border-t border-slate-200 p-5 px-8 shrink-0 flex items-center justify-between">
              <div className="flex space-x-3">
                <button 
                  onClick={() => handleDeleteRecord(viewingRecord.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Excluir</span>
                </button>
                <button 
                  onClick={() => handleEditRecord(viewingRecord)}
                  className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center space-x-2 cursor-pointer border border-transparent"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Editar Prontuário</span>
                </button>
              </div>
              
              <div className="flex space-x-3">
                <button 
                  onClick={() => setViewingRecord(null)}
                  className="px-5 py-2 rounded-lg font-semibold text-sm text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                >
                  Fechar
                </button>
                <button 
                  onClick={() => handleExportPDF(viewingRecord)}
                  className="bg-[#192F28] hover:bg-[#192F28]/95 text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Baixar PDF Novamente</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
