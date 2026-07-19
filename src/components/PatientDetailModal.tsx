import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, FileText, BookOpen, Clock, Phone, Mail, User, Shield, StickyNote, Edit3, Check, Download, Image as ImageIcon, Trash2, TrendingUp, TrendingDown, Minus, Filter, AlertTriangle, Sparkles } from 'lucide-react';
import { Patient, dataManager, compressImage } from '../data';
import Markdown from 'react-markdown';
import jsPDF from 'jspdf';
import { maskPhone } from '../utils/masks';
import { useStore } from '../store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

interface PatientDetailModalProps {
  patient: Patient;
  onClose: () => void;
  onDelete?: () => void;
  extraData?: any;
}

export default function PatientDetailModal({ patient, onClose, onDelete, extraData }: PatientDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'clinicos' | 'consultas' | 'prontuarios' | 'diario'>('clinicos');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [quickNote, setQuickNote] = useState(() => localStorage.getItem(`quick_note_${patient.id}`) || '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [medicalHistory, setMedicalHistory] = useState(patient.medical_history || '');
  const [isEditingMedicalHistory, setIsEditingMedicalHistory] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [diaryFilter, setDiaryFilter] = useState<'all' | 'crises'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [editProfileForm, setEditProfileForm] = useState({
    name: patient.name,
    email: patient.email || '',
    phone: patient.phone,
    health_insurance: patient.health_insurance || '',
    medical_history: patient.medical_history || '',
    tags: patient.tags ? patient.tags.join(', ') : '',
    photo_url: patient.photo_url || ''
  });

  const getEmail = () => {
    if (patient.email) return patient.email;
    return patient.name.toLowerCase().replace(' ', '.') + '@email.com';
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setEditProfileForm({ ...editProfileForm, photo_url: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  const appointmentsStore = useStore(state => state.appointments);
  const diaryStore = useStore(state => state.diary);
  
  const handleSaveProfile = () => {
    const parsedTags = editProfileForm.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload: Partial<Patient> = {
      name: editProfileForm.name,
      email: editProfileForm.email,
      phone: editProfileForm.phone,
      health_insurance: editProfileForm.health_insurance,
      medical_history: editProfileForm.medical_history,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      photo_url: editProfileForm.photo_url
    };
    dataManager.updatePatient(patient.id, payload);
    // Update local medical history state to reflect changes if edited here
    setMedicalHistory(editProfileForm.medical_history);
    // Force modal to use new data (in a real app, patient context/prop would update)
    patient.name = editProfileForm.name;
    patient.email = editProfileForm.email;
    patient.phone = editProfileForm.phone;
    patient.health_insurance = editProfileForm.health_insurance;
    patient.medical_history = editProfileForm.medical_history;
    patient.tags = parsedTags.length > 0 ? parsedTags : undefined;
    patient.photo_url = editProfileForm.photo_url;
    setIsEditingProfile(false);
  };

  const appointments = appointmentsStore.filter(a => a && a.date && a.patient_id === patient.id);
  const diaryEntries = diaryStore.filter(d => d && d.patient_id === patient.id).reverse();

  const [aiSummary, setAiSummary] = useState(() => localStorage.getItem(`diary_summary_${patient.id}`) || '');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    setSummaryError(null);
    try {
      const response = await fetch('/api/summarize-diary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientName: patient.name,
          entries: diaryEntries.slice(0, 15)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar o resumo do diário.');
      }

      const data = await response.json();
      setAiSummary(data.result);
      localStorage.setItem(`diary_summary_${patient.id}`, data.result);
    } catch (err: any) {
      console.error(err);
      setSummaryError(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const fakeData = extraData || {
    diag: 'Avaliação',
    since: 'Novo paciente',
    sessions: 0,
    nextAppt: '-',
    status: 'Ativo'
  };


  const handleExportAllRecordsPDF = () => {
    const doc = new jsPDF();
    const doctor = useStore.getState().doctors[0]; // fallback, preferably passed down but store is accessible
    const records = useStore.getState().medicalRecords
      .filter(r => r.patient_id === patient.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    doc.setFontSize(16);
    doc.text('Relatório Completo de Prontuários', 105, 20, { align: 'center' });
    
    if (doctor.clinic_name) {
      doc.setFontSize(12);
      doc.text(doctor.clinic_name, 105, 28, { align: 'center' });
    }
    
    doc.setFontSize(10);
    doc.text(`Paciente: ${patient.name}`, 20, 35);
    doc.text(`Médico(a): ${doctor.name} (${doctor.crp_crm})`, 20, 42);
    doc.text(`Data da Exportação: ${new Date().toLocaleString('pt-BR')}`, 20, 49);
    doc.text(`Total de Registros: ${records.length}`, 20, 56);
    
    let currentY = 70;

    records.forEach((record, index) => {
      // Check if we need a new page
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(12);
      doc.text(`Registro #${records.length - index}`, 20, currentY);
      doc.setFontSize(9);
      doc.text(`Data: ${new Date(record.created_at).toLocaleString('pt-BR')}`, 20, currentY + 5);
      doc.text(`Status: ${record.signature_status === 'signed_icp' ? 'Assinado Digitalmente' : 'Rascunho Não Assinado'}`, 20, currentY + 10);
      
      currentY += 20;

      if (record.evolution_text) {
        doc.setFontSize(11);
        doc.text('Evolução Clínica:', 20, currentY);
        doc.setFontSize(9);
        const splitText = doc.splitTextToSize(record.evolution_text, 170);
        doc.text(splitText, 20, currentY + 5);
        currentY += 5 + (splitText.length * 5);
      }

      if (record.prontuario_text) {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        doc.setFontSize(11);
        doc.text('Prontuário Médico:', 20, currentY + 5);
        doc.setFontSize(9);
        const splitProntuario = doc.splitTextToSize(record.prontuario_text, 170);
        doc.text(splitProntuario, 20, currentY + 10);
        currentY += 10 + (splitProntuario.length * 5);
      }

      doc.setDrawColor(200);
      doc.line(20, currentY + 5, 190, currentY + 5);
      currentY += 15;
    });

    if (records.length === 0) {
      doc.setFontSize(12);
      doc.text('Nenhum registro clínico encontrado para este paciente.', 20, currentY);
    }

    // Custom Signature & Footer
    doc.setFontSize(9);
    doc.setTextColor(100);
    
    let footerY = currentY + 30; // Position below content
    if (footerY > 260) {
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

    doc.save(`Prontuarios_${patient.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <motion.div className="fixed inset-0 z-50">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      ></motion.div>
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 right-0 w-full max-w-5xl bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200"
      >
          {/* Header Profile Section */}
          <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex flex-col items-start justify-between gap-4 shrink-0 relative">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition-colors cursor-pointer border border-slate-200 shadow-sm"
            >
            <X className="h-5 w-5" />
          </button>

          {isEditingProfile ? (
            <div className="w-full mr-12 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 text-lg">Editar Dados do Paciente</h3>
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {editProfileForm.photo_url ? (
                    <img src={editProfileForm.photo_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors"
                  >
                    Escolher Foto
                  </button>
                  <p className="text-xs text-slate-500 mt-1">PNG, JPG, max 2MB</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nome Completo</label>
                  <input type="text" value={editProfileForm.name} onChange={e => setEditProfileForm({...editProfileForm, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-status-success focus:ring-1 focus:ring-status-success" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">E-mail</label>
                  <input type="email" value={editProfileForm.email} onChange={e => setEditProfileForm({...editProfileForm, email: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-status-success focus:ring-1 focus:ring-status-success" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Celular</label>
                  <input type="text" value={editProfileForm.phone} onChange={e => setEditProfileForm({...editProfileForm, phone: maskPhone(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-status-success focus:ring-1 focus:ring-status-success" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Plano de Saúde</label>
                  <input type="text" value={editProfileForm.health_insurance} onChange={e => setEditProfileForm({...editProfileForm, health_insurance: e.target.value})} placeholder="Ex: Unimed, Particular" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-status-success focus:ring-1 focus:ring-status-success" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tags (separadas por vírgula)</label>
                  <input type="text" value={editProfileForm.tags} onChange={e => setEditProfileForm({...editProfileForm, tags: e.target.value})} placeholder="Ex: Risco, Avaliação" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-status-success focus:ring-1 focus:ring-status-success" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Histórico Médico</label>
                  <textarea value={editProfileForm.medical_history} onChange={e => setEditProfileForm({...editProfileForm, medical_history: e.target.value})} rows={3} placeholder="Alergias, medicações, condições..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-status-success focus:ring-1 focus:ring-status-success"></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditingProfile(false)} className="px-5 py-2 text-sm text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">Cancelar</button>
                <button onClick={handleSaveProfile} className="bg-status-success text-brand-primary text-sm border border-[#b0d292] font-bold px-5 py-2 rounded-lg hover:bg-[#b0d292] transition-colors cursor-pointer shadow-sm flex items-center gap-2"><Check className="w-4 h-4" /> Salvar Alterações</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full">
              <div className="flex items-center space-x-5">
                <div className="w-20 h-20 rounded-full bg-status-success/30 border border-status-success flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  {patient.photo_url ? (
                    <img src={patient.photo_url} alt={patient.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-brand-primary">{patient.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    {patient.name}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${fakeData.status === 'Inativo' ? 'bg-slate-200 text-slate-600' : 'bg-status-success text-brand-primary'}`}>
                      {fakeData.status}
                    </span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-600 font-medium">
                    <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-slate-400" /> {getEmail()}</span>
                    <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-slate-400" /> {patient.phone}</span>
                    {patient.health_insurance && <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-slate-400" /> {patient.health_insurance}</span>}
                    <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" /> {fakeData.since}</span>
                  </div>
                  {patient.tags && patient.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {patient.tags.map((tag, idx) => {
                        const norm = tag.toLowerCase().trim();
                        let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (norm.includes('risco')) colorClass = 'bg-rose-100 text-rose-700 border-rose-200';
                        else if (norm.includes('acompanhamento')) colorClass = 'bg-status-success/20 text-brand-primary border-status-success/40';
                        else if (norm.includes('financeiro') || norm.includes('pendente')) colorClass = 'bg-amber-100 text-amber-700 border-amber-200';
                        else if (norm.includes('alta')) colorClass = 'bg-status-success/40 text-brand-primary border-status-success/50';
                        else colorClass = 'bg-status-success/20 text-brand-primary border-status-success/40';
                        
                        return (
                          <span key={idx} className={`text-xs uppercase font-bold px-2 py-0.5 rounded border ${colorClass} tracking-wide whitespace-nowrap leading-none`}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 md:mt-0 mr-12 md:mr-10 flex flex-wrap gap-2">
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="bg-white text-slate-700 text-sm border border-slate-300 font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Editar Dados</span>
                </button>
                <button
                  onClick={handleExportAllRecordsPDF}
                  className="bg-white text-slate-700 text-sm border border-slate-300 font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar Prontuário</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-white text-red-600 hover:text-red-700 text-sm border border-red-200 hover:border-red-300 font-semibold px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in text-left">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Paciente?</h3>
              <p className="text-sm text-slate-500 mb-6">
                Tem certeza que deseja remover este paciente? Esta ação não pode ser desfeita.
              </p>
              <div className="flex w-full space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 px-4 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    if (onDelete) onDelete();
                  }}
                  className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-8 border-b border-slate-200 bg-white shrink-0">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('clinicos')}
              className={`py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${activeTab === 'clinicos' ? 'border-status-success text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Dados Clínicos
            </button>
            <button
              onClick={() => setActiveTab('consultas')}
              className={`py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'consultas' ? 'border-status-success text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Histórico de Consultas
              <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{appointments.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('prontuarios')}
              className={`py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${activeTab === 'prontuarios' ? 'border-status-success text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Prontuários NGS2
            </button>
            <button
              onClick={() => setActiveTab('diario')}
              className={`py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'diario' ? 'border-status-success text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Diário do Paciente
              <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{diaryEntries.length}</span>
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-50/50">
          <div key={activeTab} className="animate-fade-in">
            {activeTab === 'clinicos' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-brand-primary/70" /> Diagnóstico e Tratamento
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="block text-slate-500 mb-1">Diagnóstico Inicial</span>
                          <span className="font-semibold text-slate-900 px-2 py-1 bg-status-success/20 text-brand-primary rounded-md inline-block">{fakeData.diag}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 mb-1">Total de Sessões</span>
                          <span className="font-semibold text-slate-900">{fakeData.sessions} sessões realizadas</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <User className="h-5 w-5 text-status-success" /> Informações Pessoais
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="block text-slate-500 mb-1">Status de Cadastro</span>
                          <span className={`font-semibold ${fakeData.status === 'Inativo' ? 'text-slate-600' : 'text-brand-primary'}`}>{fakeData.status}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 mb-1">Paciente Desde</span>
                          <span className="font-semibold text-slate-900">{fakeData.since.replace('Desde ', '')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Histórico Médico Section */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
                    <div className="bg-slate-50 px-6 py-3 flex items-center justify-between border-b border-slate-200">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                        <BookOpen className="h-4 w-4 text-brand-primary" /> Histórico Médico e Antecedentes
                      </h3>
                      <button 
                        onClick={() => {
                          if (isEditingMedicalHistory) {
                            dataManager.updatePatient(patient.id, { medical_history: medicalHistory });
                          }
                          setIsEditingMedicalHistory(!isEditingMedicalHistory);
                        }}
                        className="text-slate-500 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                      >
                        {isEditingMedicalHistory ? <Check className="h-4 w-4 text-brand-primary" /> : <Edit3 className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="p-6">
                      {isEditingMedicalHistory ? (
                        <textarea 
                          value={medicalHistory}
                          onChange={(e) => setMedicalHistory(e.target.value)}
                          placeholder="Adicione alergias, doenças crônicas, cirurgias ou histórico familiar..."
                          className="w-full bg-slate-50 rounded-lg border border-slate-200 focus:border-status-success focus:ring-4 focus:ring-status-success/10 resize-y min-h-[120px] text-slate-900 placeholder:text-slate-400 p-4 text-sm leading-relaxed outline-none transition-all"
                          autoFocus
                        />
                      ) : (
                        <div className="min-h-[120px] w-full text-sm leading-relaxed">
                          {medicalHistory ? (
                            <div className="markdown-body text-slate-900 prose prose-sm max-w-none">
                              <Markdown
                                components={{
                                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 last:mb-0" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 last:mb-0" {...props} />,
                                  h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 text-slate-800" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 text-slate-800" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1 text-slate-800" {...props} />,
                                  a: ({node, ...props}) => <a className="underline text-brand-primary hover:text-brand-primary/70" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-bold text-slate-800" {...props} />
                                }}
                              >
                                {medicalHistory}
                              </Markdown>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Nenhum antecedente ou dado médico registrado. Clique no ícone de lápis para adicionar alergias, cirurgias prévias ou condições crônicas.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Notes Section */}
                  <div className="bg-[#FEF9C3] rounded-2xl border border-[#FDE047] shadow-sm overflow-hidden relative">
                    <div className="bg-[#FEF08A] px-6 py-3 flex items-center justify-between border-b border-[#FDE047]">
                      <h3 className="font-bold text-yellow-900 flex items-center gap-2 text-sm">
                        <StickyNote className="h-4 w-4" /> Quick Notes (Privado)
                      </h3>
                      <button 
                        onClick={() => {
                          if (isEditingNote) {
                            localStorage.setItem(`quick_note_${patient.id}`, quickNote);
                          }
                          setIsEditingNote(!isEditingNote);
                        }}
                        className="text-yellow-700 hover:text-yellow-900 transition-colors p-1 cursor-pointer"
                      >
                        {isEditingNote ? <Check className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="p-6">
                      {isEditingNote ? (
                        <textarea 
                          value={quickNote}
                          onChange={(e) => setQuickNote(e.target.value)}
                          placeholder="Adicione anotações rápidas e privadas aqui..."
                          className="w-full bg-transparent border-0 focus:ring-0 resize-none h-32 text-yellow-900 placeholder:text-yellow-700/50 p-0 text-sm leading-relaxed outline-none"
                          autoFocus
                        />
                      ) : (
                        <div className="h-32 overflow-y-auto w-full text-sm leading-relaxed">
                          {quickNote ? (
                            <div className="markdown-body text-yellow-900 prose prose-sm prose-yellow max-w-none">
                              <Markdown
                                components={{
                                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 last:mb-0" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 last:mb-0" {...props} />,
                                  h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 text-yellow-950" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 text-yellow-950" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1 text-yellow-950" {...props} />,
                                  a: ({node, ...props}) => <a className="underline text-yellow-700 hover:text-yellow-900" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-bold text-yellow-950" {...props} />
                                }}
                              >
                                {quickNote}
                              </Markdown>
                            </div>
                          ) : (
                            <span className="text-yellow-700/50 italic whitespace-pre-wrap">Nenhuma anotação rápida. Clique no ícone para editar.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Col 3: Próximos Agendamentos Widget */}
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                      <Calendar className="h-4 w-4 text-status-success" /> Próximos Agendamentos
                    </h3>
                    <div className="space-y-3">
                      {appointments
                        .filter(a => ['pending', 'confirmed'].includes(a.status))
                        .sort((a, b) => new Date(`${a.date.split('/').reverse().join('-')}T${a.start_time}`).getTime() - new Date(`${b.date.split('/').reverse().join('-')}T${b.start_time}`).getTime())
                        .slice(0, 3)
                        .map((appt, idx) => (
                        <div key={appt.id || idx} className="bg-status-success/10 border border-brand-primary/20 rounded-xl p-3 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-brand-primary">{appt.date}</span>
                            <span className="text-[10px] uppercase tracking-wider font-bold bg-status-success/20 text-brand-primary px-2 py-0.5 rounded-full">{appt.start_time}</span>
                          </div>
                          <span className="text-xs text-brand-primary/80 capitalize font-medium">{appt.type}</span>
                        </div>
                      ))}
                      {appointments.filter(a => ['pending', 'confirmed'].includes(a.status)).length === 0 && (
                        <div className="text-center py-4 px-2">
                          <p className="text-xs text-slate-500 italic">Nenhum agendamento futuro encontrado para este paciente.</p>
                        </div>
                      )}
                    </div>
                    {appointments.filter(a => ['pending', 'confirmed'].includes(a.status)).length > 0 && (
                      <button onClick={() => setActiveTab('consultas')} className="mt-4 w-full py-2 text-xs font-bold text-brand-primary bg-status-success/20 hover:bg-status-success/30 rounded-lg transition-colors cursor-pointer text-center">
                        Ver histórico completo
                      </button>
                    )}
                  </div>
                </div>
              </div>
          )}

          {activeTab === 'consultas' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-600">Data</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">Horário</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">Tipo</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.length > 0 ? appointments.map(app => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{app.date}</td>
                      <td className="px-6 py-4 text-slate-600">{app.start_time}</td>
                      <td className="px-6 py-4 capitalize text-slate-600">{app.type}</td>
                      <td className="px-6 py-4">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            app.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                            app.status === 'canceled' ? 'bg-red-50 text-red-600' :
                            'bg-status-success/20 text-brand-primary'
                          }`}>
                            {app.status}
                          </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Nenhuma consulta encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'prontuarios' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="font-bold text-slate-900 mb-2">Prontuários Eletrônicos</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto">
                  Acesse os registros clínicos, evoluções terapêuticas e documentos assinados via ICP-Brasil na aba principal de Prontuários do sistema.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'diario' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* Left Side: Chart & Summary */}
                {diaryEntries.length > 0 && (
                  <div className="w-full md:w-1/3 flex flex-col gap-6 shrink-0">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-status-success" /> Evolução de Humor
                      </h3>
                      <div className="h-[180px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={[...diaryEntries].reverse().map(e => ({
                            data: new Date(e.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                            humor: e.sentiment_score
                          }))} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorHumor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#76A34A" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#76A34A" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[-1, 1]} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                              itemStyle={{ color: '#1e293b', fontSize: '12px', fontWeight: 'bold' }}
                              labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px' }}
                            />
                            <Area type="monotone" dataKey="humor" stroke="#76A34A" strokeWidth={2} fillOpacity={1} fill="url(#colorHumor)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                       <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-400" /> Filtros
                      </h3>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-3 p-2 hover:bg-slate-50 border border-transparent rounded-lg cursor-pointer transition-colors">
                          <input 
                            type="radio" 
                            checked={diaryFilter === 'all'} 
                            onChange={() => setDiaryFilter('all')}
                            className="text-brand-primary focus:ring-brand-primary h-4 w-4"
                          />
                          <span className="text-sm font-medium text-slate-700">Todos os registros ({diaryEntries.length})</span>
                        </label>
                        <label className="flex items-center space-x-3 p-2 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg cursor-pointer transition-colors">
                          <input 
                            type="radio" 
                            checked={diaryFilter === 'crises'} 
                            onChange={() => setDiaryFilter('crises')}
                            className="text-red-500 focus:ring-red-500 h-4 w-4"
                          />
                          <span className="text-sm font-medium text-red-700">Apenas Crises ({diaryEntries.filter(e => e.crisis_flag).length})</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Right Side: Entries List */}
                <div className="flex-1">
                  <div className="bg-status-success/10 border border-brand-primary/20 p-4 rounded-xl mb-6 text-sm text-brand-primary flex items-start gap-3">
                    <Check className="h-5 w-5 text-status-success shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-1">WhatsApp Integrado</strong>
                      Resumo das reflexões e sentimentos capturados via mensagens do paciente com o bot da clínica.
                    </div>
                  </div>

                  {/* AI Summary Section */}
                  {diaryEntries.length > 0 && (
                    <div className="bg-gradient-to-br from-brand-primary/5 to-status-success/5 border border-brand-primary/15 rounded-2xl p-6 mb-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-status-success/20 text-brand-primary">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-[15px]">Resumo Clínico Inteligente</h3>
                            <p className="text-xs text-slate-500 font-medium">Síntese automatizada dos sentimentos e relatos do paciente</p>
                          </div>
                        </div>
                        <button
                          onClick={handleGenerateSummary}
                          disabled={isGeneratingSummary}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                            isGeneratingSummary 
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : aiSummary
                                ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
                                : 'bg-status-success hover:bg-status-success/90 text-brand-primary border border-status-success/30'
                          }`}
                        >
                          {isGeneratingSummary ? (
                            <>
                              <div className="h-3.5 w-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                              <span>Sintetizando...</span>
                            </>
                          ) : aiSummary ? (
                            <>
                              <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
                              <span>Regerar Resumo</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Gerar Resumo por IA</span>
                            </>
                          )}
                        </button>
                      </div>

                      {summaryError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs flex items-center gap-2.5 mb-4">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{summaryError}</span>
                        </div>
                      )}

                      {isGeneratingSummary && !aiSummary && (
                        <div className="space-y-3 animate-pulse py-2">
                          <div className="h-4 bg-slate-200/60 rounded w-1/4"></div>
                          <div className="h-3 bg-slate-200/60 rounded w-full"></div>
                          <div className="h-3 bg-slate-200/60 rounded w-5/6"></div>
                          <div className="h-3 bg-slate-200/60 rounded w-4/5"></div>
                        </div>
                      )}

                      {aiSummary && (
                        <div className={`relative bg-white border border-slate-200 rounded-xl p-5 text-sm leading-relaxed transition-all ${isGeneratingSummary ? 'opacity-50' : ''}`}>
                          <div className="markdown-body prose prose-sm max-w-none text-slate-800">
                            <Markdown
                              components={{
                                p: ({node, ...props}) => <p className="mb-3 last:mb-0 text-slate-700 leading-relaxed" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3 last:mb-0 space-y-1 pl-1 text-slate-700" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3 last:mb-0 space-y-1 pl-1 text-slate-700" {...props} />,
                                h1: ({node, ...props}) => <h1 className="text-base font-bold mb-3 text-slate-900 border-b border-slate-100 pb-1 mt-4 first:mt-0" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-[14px] font-bold mb-2 text-slate-900 mt-3 first:mt-0" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-xs font-bold mb-1.5 text-slate-900 mt-3 first:mt-0" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-semibold text-slate-900" {...props} />
                              }}
                            >
                              {aiSummary}
                            </Markdown>
                          </div>
                        </div>
                      )}

                      {!aiSummary && !isGeneratingSummary && (
                        <div className="text-center py-6 bg-slate-50/50 border border-slate-200 border-dashed rounded-xl">
                          <p className="text-xs text-slate-500 font-medium">Nenhum resumo clínico gerado ainda. Clique no botão acima para analisar as últimas {Math.min(diaryEntries.length, 15)} reflexões.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {diaryEntries.length > 0 ? (
                    <div className="space-y-4">
                      {diaryEntries
                        .filter(e => diaryFilter === 'all' || (diaryFilter === 'crises' && e.crisis_flag))
                        .map(entry => (
                        <div key={entry.id} className={`bg-white border p-5 rounded-2xl shadow-sm relative overflow-hidden transition-colors ${entry.crisis_flag ? 'border-red-200' : 'border-slate-200'}`}>
                          {entry.crisis_flag && (
                            <div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div>
                          )}
                          <div className="flex items-center justify-between mb-3 pb-3">
                            <span className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                               <Clock className="h-4 w-4 text-slate-400" />
                               {new Date(entry.created_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })} às {new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex items-center gap-2">
                              {entry.crisis_flag && (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-red-50 text-red-600 uppercase tracking-wide">
                                  <AlertTriangle className="h-3 w-3" /> Alerta
                                </span>
                              )}
                              <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wide border ${
                                entry.sentiment_score >= 0.5 ? 'bg-status-success/20 text-brand-primary border-status-success/40' :
                                entry.sentiment_score <= -0.5 ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                              }`}>
                                Mood {entry.sentiment_score > 0 ? '+' : ''}{entry.sentiment_score}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-700 leading-relaxed text-[15px] whitespace-pre-wrap">{entry.content}</p>
                        </div>
                      ))}
                      
                      {diaryEntries.filter(e => diaryFilter === 'all' || (diaryFilter === 'crises' && e.crisis_flag)).length === 0 && (
                        <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl border-dashed">
                          <p className="text-slate-500 font-medium">Nenhum registro encontrado para este filtro.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
                      <BookOpen className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                      <h4 className="font-bold text-slate-700 mb-2">Sem registros</h4>
                      <p className="text-slate-500 max-w-sm mx-auto text-sm">O paciente ainda não enviou reflexões para o seu diário clínico. Convide-o a interagir via WhatsApp.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
        </motion.div>
    </motion.div>
  );
}
