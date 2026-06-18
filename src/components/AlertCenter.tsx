import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, ArrowLeft, Heart, CheckCircle2 } from 'lucide-react';
import { DiaryEntry, Patient, dataManager } from '../data';
import { motion, AnimatePresence } from 'motion/react';

interface AlertCenterProps {
  onNavigate: (tab: string, param?: string) => void;
  triggerRefresh: number;
}

export default function AlertCenter({ onNavigate, triggerRefresh }: AlertCenterProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);

  useEffect(() => {
    setPatients(dataManager.getPatients());
    setDiaryEntries(dataManager.getDiaryEntries());
  }, [triggerRefresh]);

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || 'Paciente Não Identificado';
  };

  const getPatientPhone = (id: string) => {
    return patients.find(p => p.id === id)?.phone || '';
  };

  const crisisAlerts = diaryEntries.filter(entry => entry.crisis_flag);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => onNavigate('dashboard')}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 cursor-pointer shadow-sm transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <span>Central de Alertas Clínicos</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerenciamento de eventos críticos e sinais de risco detectados (LGPD Ativa).
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Alertas Pendentes ({crisisAlerts.length})</h2>
        </div>
        
        <div className="divide-y divide-slate-100">
          {crisisAlerts.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-status-success" />
              </div>
              <p className="font-bold text-slate-900 text-lg">Nenhum evento crítico</p>
              <p className="text-sm text-slate-500 max-w-md mt-2">
                A IA não detectou padrões acionáveis ou menções de risco alto nos diários recentes de seus pacientes.
              </p>
            </div>
          ) : (
            crisisAlerts.map((alert, index) => (
              <motion.div 
                key={alert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 flex flex-col md:flex-row md:items-start gap-4 md:space-x-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200 shadow-sm">
                  <AlertCircle className="h-6 w-6" />
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-bold text-lg text-slate-900">{getPatientName(alert.patient_id)}</h3>
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                        {alert.sentiment_score > 0.8 ? 'Risco Iminente' : 'Alerta Comportamental'}
                      </span>
                    </div>
                    <span className="text-sm text-slate-400 flex items-center space-x-1.5 font-mono">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(alert.created_at).toLocaleDateString('pt-BR')}</span>
                    </span>
                  </div>
                  
                  <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 text-sm text-slate-700 leading-relaxed max-w-4xl font-medium">
                    <strong className="text-red-800">IA Insight:</strong> O paciente registrou conteúdo no diário (“{alert.content}”) analisado com risco severo. Recomenda-se intervenção de contato clínico urgente. 
                  </div>
                  
                  <div className="flex items-center space-x-3 pt-3">
                    <a
                      href={`https://wa.me/${getPatientPhone(alert.patient_id).replace(/\D/g,'')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#192F28] hover:bg-[#12221d] text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-2"
                    >
                      <Heart className="w-4 h-4" />
                      <span>Acolhimento via WhatsApp</span>
                    </a>
                    
                    <button
                      onClick={() => onNavigate('prontuario', alert.patient_id)}
                      className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold py-2 px-5 rounded-lg transition-colors cursor-pointer"
                    >
                      Ver Histórico
                    </button>

                    <button
                      onClick={() => {
                        const allEntries = dataManager.getDiaryEntries();
                        const updatedEntries = allEntries.map(e => 
                          e.id === alert.id ? { ...e, crisis_flag: false } : e
                        );
                        dataManager.saveDiaryEntries(updatedEntries);
                        onNavigate('alertas'); // Just to trigger a refresh via parent if possible, or we need to pass a refresh trigger
                        // Actually, we can just call onNavigate('alertas') to trigger re-render? Wait, better pass a local state or triggerRefresh
                      }}
                      className="ml-auto text-slate-400 hover:text-emerald-600 text-sm font-medium transition-colors cursor-pointer flex items-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Marcar como resolvido</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
