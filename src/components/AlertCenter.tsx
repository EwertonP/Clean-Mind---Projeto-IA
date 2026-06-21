import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, ArrowLeft, Heart, CheckCircle2 } from 'lucide-react';
import { DiaryEntry, Patient, dataManager } from '../data';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store';

interface AlertCenterProps {
  onNavigate: (tab: string, param?: string) => void;
}

export default function AlertCenter({ onNavigate }: AlertCenterProps) {
  const patients = useStore(state => state.patients);
  const diaryEntries = useStore(state => state.diary);

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || 'Paciente Não Identificado';
  };

  const getPatientPhone = (id: string) => {
    return patients.find(p => p.id === id)?.phone || '';
  };

  const crisisAlerts = diaryEntries.filter(entry => entry.crisis_flag);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 font-sans"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center space-x-3">
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
              <div className="w-16 h-16 rounded-full bg-[#C1E2A4]/20 flex items-center justify-center mb-4 border border-[#C1E2A4]/50">
                <CheckCircle2 className="h-8 w-8 text-[#192F28]" />
              </div>
              <p className="font-bold text-[#192F28] text-lg">Nenhum evento crítico</p>
              <p className="text-sm text-[#192F28]/70 max-w-md mt-2">
                A IA não detectou padrões acionáveis ou menções de risco alto nos diários recentes de seus pacientes.
              </p>
            </div>
          ) : (
            crisisAlerts.map((alert, index) => (
              <motion.div 
                key={alert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                whileHover={{ scale: 1.01 }}
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
                      onClick={() => dataManager.addAuditLog('Iniciou Acolhimento', `Contato via WhatsApp a partir do alerta: ${alert.id}`, alert.patient_id)}
                      className="bg-[#192F28] hover:bg-[#12221d] text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-2"
                    >
                      <Heart className="w-4 h-4" />
                      <span>Acolhimento via WhatsApp</span>
                    </a>
                    
                    <button
                      onClick={() => {
                        dataManager.addAuditLog('Visualizou Alerta / Histórico', `Acessou prontuário a partir do alerta: ${alert.id}`, alert.patient_id);
                        onNavigate('prontuario', alert.patient_id);
                      }}
                      className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold py-2 px-5 rounded-lg transition-colors cursor-pointer"
                    >
                      Ver Histórico
                    </button>

                    <button
                      onClick={() => {
                        dataManager.addAuditLog('Resolveu Alerta', `Marcou alerta comportamental como resolvido: ${alert.id}`, alert.patient_id);
                        dataManager.updateDiaryEntry(alert.id, { crisis_flag: false });
                      }}
                      className="ml-auto text-slate-400 hover:text-[#192F28]/70 text-sm font-medium transition-colors cursor-pointer flex items-center space-x-1.5"
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
    </motion.div>
  );
}
