import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Assessment, dataManager } from '../data';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, BarChart3, HelpCircle, CheckCircle2, ChevronRight, Download, Activity, FileText, Brain, Loader2, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import Markdown from 'react-markdown';

export default function PatientAssessments({ patientId }: { patientId: string }) {
  const rawAssessments = useStore(state => state.assessments);
  const storeAssessments = React.useMemo(() => rawAssessments.filter(a => a && a.date), [rawAssessments]);
  const patient = useStore(state => state.patients.find(p => p && p.id === patientId));
  const medicalRecordsStoreStore = useStore(state => state.medicalRecords); const medicalRecordsStore = useMemo(() => medicalRecordsStoreStore.filter(Boolean), [medicalRecordsStoreStore]);
  
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyType, setSurveyType] = useState<'PHQ-9' | 'GAD-7' | 'BDI-II' | 'BAI'>('PHQ-9');
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const assessments = storeAssessments
    .filter(a => a && a.patient_id === patientId && a.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleRunDSMAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysis('');
    
    try {
      const patientRecords = medicalRecords.filter(r => r.patient_id === patientId && r.signature_status === 'signed_icp');
      const notes = patientRecords.map(r => r.evolution_text || r.prontuario_text).join('\n---\n');
      const assessmentHistory = assessments.map(a => `${a.type} em ${new Date(a.date).toLocaleDateString()}: Pontuação ${a.score} (${a.severity})`).join('\n');
      
      const payload = {
        patientName: patient?.name || 'Paciente',
        anamnese: `Ocupação/Convênio: ${patient?.health_insurance || 'N/A'}, Histórico/Anamnese: ${patient?.medical_history || 'N/A'}, Tags: ${patient?.tags?.join(', ') || 'N/A'}`,
        notes: notes || 'Sem notas oficiais assinadas na evolução.',
        assessments: assessmentHistory || 'Sem avaliações realizadas.'
      };

      const res = await fetch('/api/analyze-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na análise');
      
      setAiAnalysis(data.result);
    } catch (e: any) {
      console.error(e);
      setAiAnalysis('Erro ao gerar análise: ' + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const phq9Data = assessments.filter(a => a.type === 'PHQ-9').map(a => ({
    date: new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    score: a.score
  }));

  const gad7Data = assessments.filter(a => a.type === 'GAD-7').map(a => ({
    date: new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    score: a.score
  }));

  const bdiData = assessments.filter(a => a.type === 'BDI-II').map(a => ({
    date: new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    score: a.score
  }));

  const baiData = assessments.filter(a => a.type === 'BAI').map(a => ({
    date: new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    score: a.score
  }));

  const PHQ9_QUESTRIONS = [
    "Pouco interesse ou pouco prazer em fazer as coisas?",
    "Se sentir para baixo, deprimido(a) ou sem esperança?",
    "Dificuldade de pegar no sono, ou continuar dormindo, ou dormir mais que o de costume?",
    "Se sentir cansado(a) ou com pouca energia?",
    "Falta de apetite ou comendo em excesso?",
    "Sentir-se mal consigo mesmo(a) — ou achar que é um fracasso ou que decepcionou você mesmo(a) ou a sua família?",
    "Dificuldade em se concentrar nas coisas, como ler o jornal ou assistir TV?",
    "Mover-se ou falar tão devagar que outras pessoas possam ter notado? Ou o oposto — estar tão agitado ou inquieto que você tem se movido mais que o normal?",
    "Pensamentos de que você estaria melhor morto(a) ou de se machucar de alguma maneira?"
  ];

  const GAD7_QUESTIONS = [
    "Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)?",
    "Não ser capaz de impedir ou controlar as preocupações?",
    "Preocupar-se muito com diversas coisas?",
    "Dificuldade em relaxar?",
    "Sentir-se tão inquieto(a) que é difícil ficar parado(a)?",
    "Ficar facilmente aborrecido(a) ou irritado(a)?",
    "Sentir medo como se algo horrível fosse acontecer?"
  ];

  const BDI_QUESTIONS = [
    "Tristeza", "Pessimismo", "Sentimentos de Falha/Fracasso", "Perda de Prazer", 
    "Sentimento de Culpa", "Sentimento de Punição", "Desgosto de Si Mesmo", 
    "Autocrítica", "Pensamentos/Desejos Suicidas", "Choro", "Agitação", 
    "Perda de Interesse", "Indecisão", "Desvalorização (Sentir-se Inútil)", 
    "Perda de Energia", "Alteração no Padrão de Sono", "Irritabilidade", 
    "Alteração no Apetite", "Dificuldade de Concentração", "Cansaço ou Fadiga", 
    "Perda de Interesse Sexual"
  ];

  const BAI_QUESTIONS = [
    "Formigamento ou dormência", "Sensação de calor", "Tremores nas pernas", 
    "Incapacidade de relaxar", "Medo de que o pior aconteça", "Tontura ou atordoamento", 
    "Palpitação ou aceleração do coração", "Sensação de instabilidade", "Terrores ou pânico", 
    "Nervosismo", "Sensação de sufocamento", "Tremores nas mãos", "Tremores no corpo (tremedeira)", 
    "Medo de perder o controle", "Dificuldade para respirar", "Medo de morrer", 
    "Assustado(a)", "Indigestão ou desconforto abdominal", "Sensação de desmaio", 
    "Rosto afogueado (rubor)", "Suore excessivo (não devido ao calor)"
  ];

  const OPTIONS_PHQ_GAD = [
    { label: "Nenhuma vez", value: 0 },
    { label: "Vários dias", value: 1 },
    { label: "Mais da metade dos dias", value: 2 },
    { label: "Quase todos os dias", value: 3 }
  ];

  const OPTIONS_BDI = [
    { label: "0 - Nenhuma (Ausente)", value: 0 },
    { label: "1 - Leve", value: 1 },
    { label: "2 - Moderada", value: 2 },
    { label: "3 - Grave/Severa", value: 3 }
  ];

  const OPTIONS_BAI = [
    { label: "0 - Absolutamente não", value: 0 },
    { label: "1 - Levemente (Não incomodou muito)", value: 1 },
    { label: "2 - Moderadamente (Foi desagradável, mas pude suportar)", value: 2 },
    { label: "3 - Gravemente (Dificilmente pude suportar)", value: 3 }
  ];

  const startSurvey = (type: 'PHQ-9' | 'GAD-7' | 'BDI-II' | 'BAI') => {
    setSurveyType(type);
    setAnswers([]);
    setCurrentQuestionIdx(0);
    setShowSurvey(true);
  };

  const handleAnswer = (val: number) => {
    const newAnswers = [...answers, val];
    setAnswers(newAnswers);
    
    let questions = PHQ9_QUESTRIONS;
    if (surveyType === 'GAD-7') questions = GAD7_QUESTIONS;
    if (surveyType === 'BDI-II') questions = BDI_QUESTIONS;
    if (surveyType === 'BAI') questions = BAI_QUESTIONS;
    
    if (newAnswers.length < questions.length) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      // Calculate results
      const score = newAnswers.reduce((a, b) => a + b, 0);
      let severity = '';
      if (surveyType === 'PHQ-9') {
        if (score <= 4) severity = 'Nenhuma/Mínima';
        else if (score <= 9) severity = 'Leve';
        else if (score <= 14) severity = 'Moderada';
        else if (score <= 19) severity = 'Moderadamente Grave';
        else severity = 'Grave';
      } else if (surveyType === 'GAD-7') {
        if (score <= 4) severity = 'Mínima';
        else if (score <= 9) severity = 'Leve';
        else if (score <= 14) severity = 'Moderada';
        else severity = 'Grave';
      } else if (surveyType === 'BDI-II') {
        if (score <= 13) severity = 'Mínima';
        else if (score <= 19) severity = 'Leve';
        else if (score <= 28) severity = 'Moderada';
        else severity = 'Grave';
      } else if (surveyType === 'BAI') {
        if (score <= 7) severity = 'Mínima';
        else if (score <= 15) severity = 'Leve';
        else if (score <= 25) severity = 'Moderada';
        else severity = 'Grave';
      }

      dataManager.addAssessment({
        patient_id: patientId,
        type: surveyType,
        score,
        severity,
        answers: newAnswers,
        date: new Date().toISOString()
      });

      setShowSurvey(false);
    }
  };

  const getActiveQuestions = () => {
    if (surveyType === 'GAD-7') return GAD7_QUESTIONS;
    if (surveyType === 'BDI-II') return BDI_QUESTIONS;
    if (surveyType === 'BAI') return BAI_QUESTIONS;
    return PHQ9_QUESTRIONS;
  };

  const getActiveOptions = () => {
    if (surveyType === 'BDI-II') return OPTIONS_BDI;
    if (surveyType === 'BAI') return OPTIONS_BAI;
    return OPTIONS_PHQ_GAD;
  };

  const activeQuestions = getActiveQuestions();
  const activeOptions = getActiveOptions();
  const progress = Math.round((answers.length / activeQuestions.length) * 100);

  return (
    <div className="space-y-8 pb-12 animate-fade-in custom-scroll">
      
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
         <div className="relative z-10 md:w-2/3 mb-6 md:mb-0">
            <h2 className="text-2xl font-serif font-bold text-white mb-2 flex items-center">
              <Brain className="w-6 h-6 mr-3 text-status-success" />
              Motor de Análise Clínica (DSM-5-TR)
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
              Cruzamento automático dos prontuários assinados pelo profissional, diários do paciente e resultados de testes psicométricos com os critérios de diagnóstico do DSM-5-TR.
            </p>
         </div>
         <div className="relative z-10 shrink-0">
           <button 
             onClick={handleRunDSMAnalysis} 
             disabled={isAnalyzing}
             className="bg-status-success hover:bg-[#a9cd8c] disabled:opacity-70 disabled:cursor-not-allowed text-brand-primary font-bold px-6 py-3.5 rounded-full flex items-center transition-all shadow-[0_0_20px_rgba(193,226,164,0.3)] hover:shadow-[0_0_30px_rgba(193,226,164,0.5)]"
           >
             {isAnalyzing ? (
               <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analisando Dados...</>
             ) : (
               <><Sparkles className="w-5 h-5 mr-2" /> Gerar Relatório Diagnóstico</>
             )}
           </button>
         </div>
      </div>

      <AnimatePresence>
        {aiAnalysis && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border-2 border-emerald-100 rounded-2xl p-8 shadow-sm">
               <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-slate-100">
                 <div className="bg-emerald-100 p-2.5 rounded-xl">
                   <Brain className="w-6 h-6 text-brand-primary" />
                 </div>
                 <div>
                   <h3 className="font-bold text-slate-800 text-lg">Parecer Analítico - DSM-5-TR</h3>
                   <p className="text-xs text-slate-500 font-medium">Gerado por Inteligência Artificial (CleanMind Copilot)</p>
                 </div>
               </div>
               <div className="prose prose-sm prose-slate max-w-none prose-headings:font-serif prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600">
                 <Markdown>{aiAnalysis}</Markdown>
               </div>
               <div className="mt-8 pt-4 border-t border-slate-100 flex items-center text-xs text-slate-400 font-mono">
                 <Activity className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                 Esta é uma ferramenta de apoio à decisão clínica e não substitui o julgamento profissional do médico psiquiatra ou terapeuta responsável.
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div whileHover={{ y: -2 }} className="bg-white border text-center border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between" onClick={() => startSurvey('PHQ-9')}>
          <div>
            <div className="w-12 h-12 bg-emerald-50 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">PHQ-9</h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">Questionário de Saúde do Paciente (Depressão)</p>
          </div>
          <div className="mt-4 flex items-center justify-center space-x-2 text-brand-primary font-semibold text-sm">
            <Plus className="w-4 h-4" />
            <span>Aplicar</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white border text-center border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between" onClick={() => startSurvey('GAD-7')}>
          <div>
            <div className="w-12 h-12 bg-emerald-50 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">GAD-7</h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">Transtorno de Ansiedade Generalizada</p>
          </div>
          <div className="mt-4 flex items-center justify-center space-x-2 text-brand-primary font-semibold text-sm">
            <Plus className="w-4 h-4" />
            <span>Aplicar</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white border text-center border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between" onClick={() => startSurvey('BDI-II')}>
          <div>
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">BDI-II</h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">Inventário de Depressão de Beck</p>
          </div>
          <div className="mt-4 flex items-center justify-center space-x-2 text-rose-600 font-semibold text-sm">
            <Plus className="w-4 h-4" />
            <span>Aplicar</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white border text-center border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between" onClick={() => startSurvey('BAI')}>
          <div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">BAI</h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">Inventário de Ansiedade de Beck</p>
          </div>
          <div className="mt-4 flex items-center justify-center space-x-2 text-amber-600 font-semibold text-sm">
            <Plus className="w-4 h-4" />
            <span>Aplicar</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* PHQ-9 Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-slate-800 flex items-center">
               <BarChart3 className="w-5 h-5 text-status-success mr-2" />
               Evolução PHQ-9 (Depressão)
             </h3>
             {phq9Data.length > 0 && <span className="font-mono bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md text-sm font-bold">Último: {phq9Data[phq9Data.length-1].score}</span>}
          </div>
          
          <div className="h-[250px] w-full">
            {phq9Data.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                 <FileText className="w-8 h-8 mb-2 opacity-50" />
                 <span className="text-sm font-medium">Nenhum registro ainda</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={phq9Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPhq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#76A34A" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#76A34A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 27]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine y={9} stroke="#ef4444" strokeDasharray="3 3" opacity={0.3} />
                  <ReferenceLine y={4} stroke="#10b981" strokeDasharray="3 3" opacity={0.3} />
                  <Area type="monotone" dataKey="score" stroke="#76A34A" strokeWidth={3} fillOpacity={1} fill="url(#colorPhq)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* GAD-7 Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-slate-800 flex items-center">
               <BarChart3 className="w-5 h-5 text-status-success mr-2" />
               Evolução GAD-7 (Ansiedade)
             </h3>
             {gad7Data.length > 0 && <span className="font-mono bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md text-sm font-bold">Último: {gad7Data[gad7Data.length-1].score}</span>}
          </div>
          
          <div className="h-[250px] w-full">
            {gad7Data.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                 <FileText className="w-8 h-8 mb-2 opacity-50" />
                 <span className="text-sm font-medium">Nenhum registro ainda</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={gad7Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 21]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine y={9} stroke="#ef4444" strokeDasharray="3 3" opacity={0.3} />
                  <ReferenceLine y={4} stroke="#10b981" strokeDasharray="3 3" opacity={0.3} />
                  <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorGad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* BDI-II Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-slate-800 flex items-center">
               <BarChart3 className="w-5 h-5 text-rose-500 mr-2" />
               Evolução BDI-II (Depressão)
             </h3>
             {bdiData.length > 0 && <span className="font-mono bg-rose-50 text-rose-700 px-3 py-1 rounded-md text-sm font-bold">Último: {bdiData[bdiData.length-1].score}</span>}
          </div>
          
          <div className="h-[250px] w-full">
            {bdiData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                 <FileText className="w-8 h-8 mb-2 opacity-50" />
                 <span className="text-sm font-medium">Nenhum registro ainda</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bdiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBdi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 63]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine y={28} stroke="#ef4444" strokeDasharray="3 3" opacity={0.3} />
                  <ReferenceLine y={13} stroke="#10b981" strokeDasharray="3 3" opacity={0.3} />
                  <Area type="monotone" dataKey="score" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorBdi)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* BAI Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-slate-800 flex items-center">
               <BarChart3 className="w-5 h-5 text-amber-500 mr-2" />
               Evolução BAI (Ansiedade)
             </h3>
             {baiData.length > 0 && <span className="font-mono bg-amber-50 text-amber-700 px-3 py-1 rounded-md text-sm font-bold">Último: {baiData[baiData.length-1].score}</span>}
          </div>
          
          <div className="h-[250px] w-full">
            {baiData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                 <FileText className="w-8 h-8 mb-2 opacity-50" />
                 <span className="text-sm font-medium">Nenhum registro ainda</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={baiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBai" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 63]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="3 3" opacity={0.3} />
                  <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" opacity={0.3} />
                  <Area type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorBai)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSurvey && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 p-safe">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowSurvey(false)}
               className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div>
                   <h2 className="text-xl font-bold text-slate-800">Avaliação {surveyType}</h2>
                   <p className="text-sm font-medium text-slate-500">Paciente: {patient?.name}</p>
                 </div>
                 <div className="h-10 w-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 font-bold text-slate-700">
                   {currentQuestionIdx + 1}/{activeQuestions.length}
                 </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-1.5">
                <div className="bg-brand-primary h-1.5 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
              </div>

              <div className="p-8 flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={currentQuestionIdx}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="max-w-xl mx-auto"
                  >
                    <h3 className="text-2xl font-serif font-bold text-brand-primary mb-8 leading-snug text-center">
                      "{activeQuestions[currentQuestionIdx]}"
                    </h3>

                    <div className="space-y-3">
                      {activeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleAnswer(opt.value)}
                          className="w-full px-6 py-4 text-left border-2 border-slate-100 hover:border-status-success rounded-2xl font-medium text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-between group"
                        >
                           <span className="text-[15px]">{opt.label}</span>
                           <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-status-success flex items-center justify-center transition-colors">
                             <div className="w-2.5 h-2.5 rounded-full bg-[#76A34A] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                           </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
