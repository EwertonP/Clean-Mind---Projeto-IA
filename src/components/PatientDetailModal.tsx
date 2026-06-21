import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, FileText, BookOpen, Clock, Phone, Mail, User, Shield, StickyNote, Edit3, Check, Download, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Patient, dataManager, compressImage } from '../data';
import Markdown from 'react-markdown';
import jsPDF from 'jspdf';
import { maskPhone } from '../utils/masks';
import { useStore } from '../store';

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

  const appointments = appointmentsStore.filter(a => a.patient_id === patient.id);
  const diaryEntries = diaryStore.filter(d => d.patient_id === patient.id).reverse();

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
    <AnimatePresence>
      <div className="fixed inset-0 z-50">
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
                  <input type="text" value={editProfileForm.name} onChange={e => setEditProfileForm({...editProfileForm, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C1E2A4] focus:ring-1 focus:ring-[#C1E2A4]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">E-mail</label>
                  <input type="email" value={editProfileForm.email} onChange={e => setEditProfileForm({...editProfileForm, email: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C1E2A4] focus:ring-1 focus:ring-[#C1E2A4]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Celular</label>
                  <input type="text" value={editProfileForm.phone} onChange={e => setEditProfileForm({...editProfileForm, phone: maskPhone(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C1E2A4] focus:ring-1 focus:ring-[#C1E2A4]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Plano de Saúde</label>
                  <input type="text" value={editProfileForm.health_insurance} onChange={e => setEditProfileForm({...editProfileForm, health_insurance: e.target.value})} placeholder="Ex: Unimed, Particular" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C1E2A4] focus:ring-1 focus:ring-[#C1E2A4]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tags (separadas por vírgula)</label>
                  <input type="text" value={editProfileForm.tags} onChange={e => setEditProfileForm({...editProfileForm, tags: e.target.value})} placeholder="Ex: Risco, Avaliação" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C1E2A4] focus:ring-1 focus:ring-[#C1E2A4]" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Histórico Médico</label>
                  <textarea value={editProfileForm.medical_history} onChange={e => setEditProfileForm({...editProfileForm, medical_history: e.target.value})} rows={3} placeholder="Alergias, medicações, condições..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C1E2A4] focus:ring-1 focus:ring-[#C1E2A4]"></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditingProfile(false)} className="px-5 py-2 text-sm text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">Cancelar</button>
                <button onClick={handleSaveProfile} className="bg-[#C1E2A4] text-[#192F28] text-sm border border-[#b0d292] font-bold px-5 py-2 rounded-lg hover:bg-[#b0d292] transition-colors cursor-pointer shadow-sm flex items-center gap-2"><Check className="w-4 h-4" /> Salvar Alterações</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full">
              <div className="flex items-center space-x-5">
                <div className="w-20 h-20 rounded-full bg-[#C1E2A4]/30 border border-[#C1E2A4] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  {patient.photo_url ? (
                    <img src={patient.photo_url} alt={patient.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-[#192F28]">{patient.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    {patient.name}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${fakeData.status === 'Inativo' ? 'bg-slate-200 text-slate-600' : 'bg-[#C1E2A4] text-[#192F28]'}`}>
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
                        else if (norm.includes('acompanhamento')) colorClass = 'bg-sky-100 text-sky-700 border-sky-200';
                        else if (norm.includes('financeiro') || norm.includes('pendente')) colorClass = 'bg-amber-100 text-amber-700 border-amber-200';
                        else if (norm.includes('alta')) colorClass = 'bg-[#C1E2A4]/40 text-[#192F28] border-[#C1E2A4]/50';
                        else colorClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';
                        
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
              className={`py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${activeTab === 'clinicos' ? 'border-[#C1E2A4] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Dados Clínicos
            </button>
            <button
              onClick={() => setActiveTab('consultas')}
              className={`py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'consultas' ? 'border-[#C1E2A4] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Histórico de Consultas
              <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{appointments.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('prontuarios')}
              className={`py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${activeTab === 'prontuarios' ? 'border-[#C1E2A4] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Prontuários NGS2
            </button>
            <button
              onClick={() => setActiveTab('diario')}
              className={`py-4 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'diario' ? 'border-[#C1E2A4] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
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
                        <Shield className="h-5 w-5 text-[#192F28]/70" /> Diagnóstico e Tratamento
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="block text-slate-500 mb-1">Diagnóstico Inicial</span>
                          <span className="font-semibold text-slate-900 px-2 py-1 bg-blue-50 text-blue-700 rounded-md inline-block">{fakeData.diag}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 mb-1">Total de Sessões</span>
                          <span className="font-semibold text-slate-900">{fakeData.sessions} sessões realizadas</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-500" /> Informações Pessoais
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="block text-slate-500 mb-1">Status de Cadastro</span>
                          <span className={`font-semibold ${fakeData.status === 'Inativo' ? 'text-slate-600' : 'text-[#192F28]'}`}>{fakeData.status}</span>
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
                        <BookOpen className="h-4 w-4 text-[#192F28]" /> Histórico Médico e Antecedentes
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
                        {isEditingMedicalHistory ? <Check className="h-4 w-4 text-[#192F28]" /> : <Edit3 className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="p-6">
                      {isEditingMedicalHistory ? (
                        <textarea 
                          value={medicalHistory}
                          onChange={(e) => setMedicalHistory(e.target.value)}
                          placeholder="Adicione alergias, doenças crônicas, cirurgias ou histórico familiar..."
                          className="w-full bg-slate-50 rounded-lg border border-slate-200 focus:border-[#C1E2A4] focus:ring-4 focus:ring-[#C1E2A4]/10 resize-y min-h-[120px] text-slate-900 placeholder:text-slate-400 p-4 text-sm leading-relaxed outline-none transition-all"
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
                                  a: ({node, ...props}) => <a className="underline text-[#192F28] hover:text-[#192F28]/70" {...props} />,
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
                      <Calendar className="h-4 w-4 text-indigo-500" /> Próximos Agendamentos
                    </h3>
                    <div className="space-y-3">
                      {appointments
                        .filter(a => ['pending', 'confirmed'].includes(a.status))
                        .sort((a, b) => new Date(`${a.date.split('/').reverse().join('-')}T${a.start_time}`).getTime() - new Date(`${b.date.split('/').reverse().join('-')}T${b.start_time}`).getTime())
                        .slice(0, 3)
                        .map((appt, idx) => (
                        <div key={appt.id || idx} className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-900">{appt.date}</span>
                            <span className="text-[10px] uppercase tracking-wider font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{appt.start_time}</span>
                          </div>
                          <span className="text-xs text-indigo-800 capitalize font-medium">{appt.type}</span>
                        </div>
                      ))}
                      {appointments.filter(a => ['pending', 'confirmed'].includes(a.status)).length === 0 && (
                        <div className="text-center py-4 px-2">
                          <p className="text-xs text-slate-500 italic">Nenhum agendamento futuro encontrado para este paciente.</p>
                        </div>
                      )}
                    </div>
                    {appointments.filter(a => ['pending', 'confirmed'].includes(a.status)).length > 0 && (
                      <button onClick={() => setActiveTab('consultas')} className="mt-4 w-full py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer text-center">
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
                            'bg-[#C1E2A4]/20 text-[#192F28]'
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
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 text-sm text-blue-800">
                Resumo das reflexões enviadas pelo paciente via WhatsApp integrado.
              </div>
              
              {diaryEntries.length > 0 ? (
                <div className="space-y-4">
                  {diaryEntries.map(entry => (
                    <div key={entry.id} className={`bg-white border p-5 rounded-2xl shadow-sm ${entry.crisis_flag ? 'border-red-200' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                        <span className="text-sm font-semibold text-slate-500 font-mono flex items-center gap-2">
                           <Clock className="h-4 w-4" />
                           {new Date(entry.created_at).toLocaleString('pt-BR')}
                        </span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide ${entry.crisis_flag ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                          Mood: {entry.sentiment_score}
                        </span>
                      </div>
                      <p className="text-slate-800 leading-relaxed">{entry.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">O paciente ainda não registrou entradas no diário.</p>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
