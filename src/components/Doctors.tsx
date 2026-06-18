import React, { useState, useEffect } from 'react';
import { User, Plus, CheckCircle2, Shield, Phone, Mail, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Doctor, dataManager } from '../data';

interface DoctorsProps {
  onRefreshDashboard: () => void;
  triggerRefresh: number;
}

export default function Doctors({ onRefreshDashboard, triggerRefresh }: DoctorsProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [crp_crm, setCrpCrm] = useState('');
  const [rqe, setRqe] = useState('');
  const [cpf, setCpf] = useState('');
  const [specialty, setSpecialty] = useState('');

  useEffect(() => {
    setDoctors(dataManager.getDoctors());
  }, [triggerRefresh]);

  const handleCreateDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !crp_crm || !cpf) return;

    dataManager.saveDoctor({
      id: `doc_${Date.now()}`,
      name,
      email,
      phone,
      crp_crm,
      rqe,
      cpf,
      specialty,
      plan_type: 'free'
    });

    setDoctors(dataManager.getDoctors());
    setShowDoctorForm(false);
    onRefreshDashboard();
    
    // Reset form
    setName('');
    setEmail('');
    setPhone('');
    setCrpCrm('');
    setRqe('');
    setCpf('');
    setSpecialty('');

    setToastMessage('Médico cadastrado com sucesso');
    setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <div className="space-y-6 font-sans">
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6 mb-2">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Médicos da Clínica</h1>
        <button
          onClick={() => setShowDoctorForm(true)}
          className="bg-[#C1E2A4] text-slate-900 text-sm border border-[#b0d292] font-semibold px-4 py-2 rounded-lg hover:bg-[#b0d292] transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Médico</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doctors.map(doc => (
          <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Stethoscope className="h-6 w-6 text-blue-600" />
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
                {doc.cpf && (
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="truncate">CPF: {doc.cpf}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Ativo na clínica</span>
            </div>
          </div>
        ))}
      </div>

      {showDoctorForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in text-left">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-lg text-slate-900">
                Cadastrar Novo Médico
              </h3>
              <button 
                onClick={() => setShowDoctorForm(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 bg-white">
              <form id="doctor-form" onSubmit={handleCreateDoctor} className="space-y-5">
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
                      type="text" value={phone} onChange={e => setPhone(e.target.value)}
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
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">CPF *</label>
                    <input
                      type="text" required value={cpf} onChange={e => setCpf(e.target.value)}
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
                Cadastrar Médico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
