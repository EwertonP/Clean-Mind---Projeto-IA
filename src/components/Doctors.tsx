import React, { useState, useEffect, useRef } from 'react';
import { User, Plus, CheckCircle2, Shield, Phone, Mail, Stethoscope, Trash2, X, Edit3, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Doctor, dataManager, compressImage } from '../data';
import { maskPhone, maskCPF } from '../utils/masks';

import { useStore } from '../store';

interface DoctorsProps {}

export default function Doctors({}: DoctorsProps) {
  const doctorsStore = useStore(state => state.doctors);
  const doctors = doctorsStore.filter(d => d.role === 'doctor' || (d.role !== 'admin' && d.crp_crm && d.crp_crm !== ''));
  const sessionId = localStorage.getItem('cm_doctor_session');
  const myDoctor = doctorsStore.find(d => d.id === sessionId) || dataManager.getDoctor();
  
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Form state
  const [docId, setDocId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [crp_crm, setCrpCrm] = useState('');
  const [rqe, setRqe] = useState('');
  const [cpf, setCpf] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [consultationPrice, setConsultationPrice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Automatically using useStore hook for re-renders

  const confirmDeleteDoctor = () => {
    if (selectedDoctor) {
      dataManager.deleteDoctor(selectedDoctor.id);
      setSelectedDoctor(null);
      setShowDeleteConfirm(false);
      setToastMessage('Médico removido com sucesso');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleEditDoctor = (doc: Doctor) => {
    setDocId(doc.id);
    setName(doc.name);
    setEmail(doc.email);
    setPhone(doc.phone || '');
    setCrpCrm(doc.crp_crm);
    setRqe(doc.rqe || '');
    setCpf(doc.cpf || '');
    setSpecialty(doc.specialty || '');
    setPhotoUrl(doc.photo_url || '');
    setConsultationPrice(doc.consultation_price ? doc.consultation_price.toString() : '');
    setIsEditing(true);
    setSelectedDoctor(null);
    setShowDoctorForm(true);
  };

  const handleCreateDoctor = () => {
    setDocId('');
    setName('');
    setEmail('');
    setPhone('');
    setCrpCrm('');
    setRqe('');
    setCpf('');
    setSpecialty('');
    setPhotoUrl('');
    setConsultationPrice('');
    setIsEditing(false);
    setSelectedDoctor(null);
    setShowDoctorForm(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setPhotoUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !crp_crm || !cpf) return;

    dataManager.saveDoctor({
      id: isEditing ? docId : `doc_${Date.now()}`,
      name,
      email,
      phone,
      crp_crm,
      rqe,
      cpf,
      specialty,
      admin_id: myDoctor?.id || '',
      role: 'doctor',
      plan_type: 'free',
      photo_url: photoUrl,
      consultation_price: consultationPrice ? parseFloat(consultationPrice.replace(',', '.')) : undefined
    });

    setShowDoctorForm(false);
    
    // Reset form
    setDocId('');
    setName('');
    setEmail('');
    setPhone('');
    setCrpCrm('');
    setRqe('');
    setCpf('');
    setSpecialty('');
    setPhotoUrl('');
    setIsEditing(false);

    setToastMessage(isEditing ? 'Médico atualizado com sucesso' : 'Médico cadastrado com sucesso');
    setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 font-sans"
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 z-50 max-w-xs bg-slate-800 text-white p-3 rounded-lg shadow-lg flex items-center space-x-2"
          >
            <CheckCircle2 className="h-4 w-4 text-[#C1E2A4] shrink-0" />
            <p className="text-xs font-medium">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Médicos da Clínica</h1>
          <p className="text-[15px] font-medium text-slate-500 mt-1">Gerencie o corpo clínico da sua instituição.</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowDoctorForm(true)}
            className="px-5 py-2 text-[14px] font-bold rounded-full border border-transparent bg-[#192F28] hover:bg-slate-800 text-[#C1E2A4] transition flex items-center shadow-md h-10 cursor-pointer"
          >
            <span className="mr-1.5 text-lg leading-none mb-[2px]">+</span> Novo Médico
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doctors.map(doc => (
          <div key={doc.id} onClick={() => setSelectedDoctor(doc)} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-md hover:ring-2 hover:ring-[#C1E2A4] transition-all cursor-pointer">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-full bg-[#C1E2A4]/20 flex items-center justify-center shrink-0 overflow-hidden border border-[#C1E2A4]/30">
                {doc.photo_url ? (
                  <img src={doc.photo_url} alt={doc.name} className="w-full h-full object-cover" />
                ) : (
                  <Stethoscope className="h-6 w-6 text-[#192F28]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 truncate">{doc.name}</h3>
                <p className="text-sm text-slate-500 font-medium truncate">{doc.specialty || 'Clínico Geral'}</p>
              </div>
            </div>

            <div className="mt-6 flex-1 space-y-3">
              <div className="flex flex-col space-y-2 text-sm text-slate-600">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{doc.crp_crm} {doc.rqe ? `- ${doc.rqe}` : ''}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{doc.email}</span>
                </div>
                {doc.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{doc.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 text-left">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedDoctor(null)}
          ></motion.div>
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200"
          >
             <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
               <h3 className="font-bold text-xl text-slate-900 truncate pr-4">
                 Dr(a). {selectedDoctor.name.split(' ')[0]}
               </h3>
               <button 
                 onClick={() => setSelectedDoctor(null)}
                 className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0 p-2 -mr-2 rounded-full hover:bg-slate-100 transition-colors"
               >
                 <X className="h-5 w-5" />
               </button>
             </div>
             
             <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-[#C1E2A4]/20 flex items-center justify-center shrink-0 overflow-hidden border border-[#C1E2A4]/30 shadow-sm">
                    {selectedDoctor.photo_url ? (
                      <img src={selectedDoctor.photo_url} alt={selectedDoctor.name} className="w-full h-full object-cover" />
                    ) : (
                      <Stethoscope className="h-8 w-8 text-[#192F28]" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">{selectedDoctor.name}</h4>
                    <p className="text-sm text-[#192F28] font-semibold bg-[#C1E2A4]/20 inline-block px-2.5 py-1 rounded-full">{selectedDoctor.specialty || 'Clínico Geral'}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                   <div className="flex items-center text-sm">
                      <Shield className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
                      <div>
                        <p className="text-slate-500 font-medium text-xs">Documento Médico</p>
                        <p className="font-semibold text-slate-900">{selectedDoctor.crp_crm} {selectedDoctor.rqe ? `/ RQE: ${selectedDoctor.rqe}` : ''}</p>
                      </div>
                   </div>
                   {selectedDoctor.cpf && (
                     <div className="flex items-center text-sm">
                        <User className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
                        <div>
                          <p className="text-slate-500 font-medium text-xs">CPF</p>
                          <p className="font-semibold text-slate-900">{selectedDoctor.cpf}</p>
                        </div>
                     </div>
                   )}
                   <div className="flex items-center text-sm">
                      <Mail className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
                      <div>
                        <p className="text-slate-500 font-medium text-xs">Email</p>
                        <p className="font-semibold text-slate-900">{selectedDoctor.email}</p>
                      </div>
                   </div>
                   {selectedDoctor.phone && (
                   <div className="flex items-center text-sm">
                      <Phone className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
                      <div>
                        <p className="text-slate-500 font-medium text-xs">Telefone</p>
                        <p className="font-semibold text-slate-900">{selectedDoctor.phone}</p>
                      </div>
                   </div>
                   )}
                </div>
             </div>
             
             <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 mt-auto">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium text-sm px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Excluir Médico</span>
                </button>
                <button
                  onClick={() => handleEditDoctor(selectedDoctor)}
                  className="flex items-center space-x-2 text-slate-700 hover:text-slate-900 font-medium text-sm px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors bg-white border border-slate-300 shadow-sm"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Editar</span>
                </button>
             </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in text-left">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Médico?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Tem certeza que deseja remover este médico? Esta ação não pode ser desfeita.
            </p>
            <div className="flex w-full space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 px-4 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteDoctor}
                className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
      {showDoctorForm && (
        <div className="fixed inset-0 z-50 text-left">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowDoctorForm(false)}
          ></motion.div>
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200"
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-lg text-slate-900">
                {isEditing ? 'Editar Especialista' : 'Cadastrar Novo Médico'}
              </h3>
              <button 
                onClick={() => setShowDoctorForm(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-2 -mr-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 bg-white flex-1">
              <form id="doctor-form" onSubmit={handleSaveDoctor} className="space-y-5">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
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
                      className="text-sm font-semibold text-[#86EFAC] bg-[#C1E2A4]/20 px-3 py-1.5 rounded-lg border border-[#C1E2A4]/30 hover:bg-[#C1E2A4]/40 transition-colors"
                    >
                      Escolher Foto
                    </button>
                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, max 2MB</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Nome Completo *</label>
                  <input
                    type="text" required value={name} onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                    placeholder="Ex: Dr. João da Silva"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Email *</label>
                    <input
                      type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                      placeholder="joao@clinica.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Telefone/WhatsApp</label>
                    <input
                      type="text" value={phone} onChange={e => setPhone(maskPhone(e.target.value))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                      placeholder="(11) 90000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Especialidade</label>
                    <input
                      type="text" value={specialty} onChange={e => setSpecialty(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                      placeholder="Ex: Psiquiatria"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Valor da Consulta (R$)</label>
                    <input
                      type="number" step="0.01" value={consultationPrice} onChange={e => setConsultationPrice(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                      placeholder="Ex: 350.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">CPF *</label>
                    <input
                      type="text" required value={cpf} onChange={e => setCpf(maskCPF(e.target.value))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">CRM/CRP *</label>
                    <input
                      type="text" required value={crp_crm} onChange={e => setCrpCrm(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                      placeholder="CRM-SP 123456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">RQE</label>
                    <input
                      type="text" value={rqe} onChange={e => setRqe(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                      placeholder="RQE 12345"
                    />
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Integrações</h4>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { connectGoogleCalendar } = await import('../googleCalendar');
                          const result = await connectGoogleCalendar();
                          if (result) {
                            // Automatically save the token to this doctor
                            const updatedDoc = {
                              ...selectedDoctor!,
                              google_access_token: result.accessToken,
                              google_connected_email: result.user.email || undefined
                            };
                            dataManager.saveDoctor(updatedDoc);
                            setSelectedDoctor(updatedDoc); // update local state
                            setToastMessage('Google Calendar conectado com sucesso!');
                            setTimeout(() => setToastMessage(''), 3000);
                          }
                        } catch (err) {
                          console.error('Failed to connect google calendar', err);
                          alert('Erro ao conectar Google Calendar.');
                        }
                      }}
                      className="flex items-center space-x-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span>
                        {selectedDoctor?.google_connected_email 
                          ? `Conectado: ${selectedDoctor.google_connected_email}`
                          : 'Conectar Google Calendar'}
                      </span>
                    </button>
                  </div>
                )}
              </form>
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex items-center justify-end space-x-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowDoctorForm(false)}
                className="py-2.5 px-4 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="doctor-form"
                className="py-2.5 px-4 text-sm font-semibold text-white bg-[#86EFAC] hover:bg-[#6EE7B7] rounded-xl transition-colors border border-transparent cursor-pointer shadow-sm"
              >
                {isEditing ? 'Salvar Alterações' : 'Cadastrar Médico'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
