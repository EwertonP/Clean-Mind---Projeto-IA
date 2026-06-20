import React, { useState, useEffect } from 'react';
import { User, Search, Mail, Phone, Plus, MessageCircle, Send, CheckCircle2, Clock, TrendingUp, TrendingDown, Minus, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, Appointment, dataManager, compressImage } from '../data';
import PatientDetailModal from './PatientDetailModal';
import { maskPhone } from '../utils/masks';

interface PatientDiaryAppProps {
  onRefreshDashboard: () => void;
  triggerRefresh: number;
}

// Fabricated extra data to match the visual mockup precisely
const MOCK_EXTRA_DATA: Record<string, any> = {
  'Ana Beatriz': { diag: 'Transtorno de Ansiedade', since: 'Desde Jan 2024', sessions: 12, nextAppt: '16 JUL 09:00', trend: 'up' },
  'Carlos Albuquerque': { diag: 'Depressão', since: 'Desde Mar 2024', sessions: 8, nextAppt: '16 JUL 10:30', trend: 'down' },
  'Marina Prado': { diag: 'Terapia de Casal', since: 'Desde Set 2023', sessions: 24, nextAppt: '-', status: 'Inativo', trend: 'down' },
  'Guilherme Soares': { diag: 'Síndrome do Pânico', since: 'Desde Mai 2024', sessions: 6, nextAppt: '16 JUL 16:00', trend: 'up' },
  'Juliana Martins': { diag: 'TOC', since: 'Desde Fev 2024', sessions: 15, nextAppt: '17 JUL 14:00', trend: 'neutral' },
  'Rafael Costa': { diag: 'Ansiedade Social', since: 'Desde Jun 2024', sessions: 3, nextAppt: '17 JUL 15:30', trend: 'up' },
  'Sofia Monteiro': { diag: 'Depressão Pós-Parto', since: 'Desde Dez 2023', sessions: 18, nextAppt: '18 JUL 11:00', trend: 'neutral' },
};

export default function PatientDiaryApp({ onRefreshDashboard, triggerRefresh }: PatientDiaryAppProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const doctors = dataManager.getDoctors().filter(d => d.role === 'doctor' || (d.role !== 'admin' && d.crp_crm && d.crp_crm !== ''));
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientEmail, setNewPatientEmail] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientDiag, setNewPatientDiag] = useState('');
  const [newPatientTags, setNewPatientTags] = useState('');
  const [newPatientInsurance, setNewPatientInsurance] = useState('Particular');
  const [newPatientDoctorId, setNewPatientDoctorId] = useState(doctors[0]?.id || '');
  const [newPatientPhotoUrl, setNewPatientPhotoUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'Todos' | 'Ativos' | 'Inativos'>('Todos');
  const [selectedPatientForDetail, setSelectedPatientForDetail] = useState<Patient | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [formErrors, setFormErrors] = useState<{name?: string, email?: string, phone?: string}>({});

  useEffect(() => {
    const list = dataManager.getPatients();
    // Add mock tags to initial patients for presentation purposes if they don't have any
    const listWithMockTags = list.map(p => {
      if (p.tags && p.tags.length > 0) return p;
      if (p.name === 'Bruno Alencar') return { ...p, tags: ['Risco'] };
      if (p.name === 'Elisa Souza') return { ...p, tags: ['Acompanhamento', 'Financeiro Pendente'] };
      if (p.name === 'Daniel Rocha') return { ...p, tags: ['Alta programada'] };
      return p;
    });
    setPatients(listWithMockTags);
    setAppointments(dataManager.getAppointments());
  }, [triggerRefresh]);

  const validateForm = () => {
    const errors: {name?: string, email?: string, phone?: string} = {};
    if (!newPatientName.trim()) errors.name = 'O nome é obrigatório';
    if (!newPatientEmail.trim()) errors.email = 'O email é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPatientEmail)) errors.email = 'Email em formato inválido';
    
    if (!newPatientPhone.trim()) errors.phone = 'O telefone é obrigatório';
    else if (newPatientPhone.replace(/\D/g, '').length < 10) errors.phone = 'Telefone inválido';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setNewPatientPhotoUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !newPatientDoctorId) return;
    
    // Add logic to save the new fields
    const list = dataManager.getPatients();
    
    const parsedTags = newPatientTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const newPat = dataManager.addPatient({
      name: newPatientName,
      email: newPatientEmail,
      phone: newPatientPhone,
      health_insurance: newPatientInsurance,
      status: 'active',
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      photo_url: newPatientPhotoUrl || undefined
    });
    
    setPatients(dataManager.getPatients());
    setNewPatientName('');
    setNewPatientEmail('');
    setNewPatientPhone('');
    setNewPatientDiag('');
    setNewPatientTags('');
    setNewPatientInsurance('Particular');
    setNewPatientPhotoUrl('');
    setShowPatientForm(false);
    onRefreshDashboard();
    
    setToastMessage('Paciente cadastrado');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const activeCount = patients.filter(p => !MOCK_EXTRA_DATA[p.name] || MOCK_EXTRA_DATA[p.name].status !== 'Inativo').length;
  const inactiveCount = patients.filter(p => MOCK_EXTRA_DATA[p.name]?.status === 'Inativo').length;

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isInactive = MOCK_EXTRA_DATA[p.name]?.status === 'Inativo';
    const isActive = !isInactive;
    
    if (filterType === 'Ativos' && !isActive) return false;
    if (filterType === 'Inativos' && !isInactive) return false;
    
    return matchesSearch;
  });

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

      {showPatientForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between z-10 shrink-0">
              <h3 className="font-bold text-lg text-slate-900">
                Novo Paciente
              </h3>
              <button 
                onClick={() => setShowPatientForm(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreatePatient} className="p-6 bg-white space-y-5 overflow-y-auto w-full max-h-full">
              <div className="flex justify-center mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {newPatientPhotoUrl ? (
                      <img src={newPatientPhotoUrl} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-slate-400" />
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <ImageIcon className="h-6 w-6" />
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={newPatientName}
                  onChange={(e) => {
                    setNewPatientName(e.target.value);
                    if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                  }}
                  onBlur={() => {
                    if (!newPatientName.trim()) setFormErrors(prev => ({ ...prev, name: 'O nome é obrigatório' }));
                  }}
                  className={`w-full px-4 py-2.5 border ${formErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 focus:border-[#86EFAC] focus:ring-[#86EFAC]'} rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1`}
                  placeholder="Ex: Maria Silva Santos"
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={newPatientEmail}
                    onChange={(e) => {
                      setNewPatientEmail(e.target.value);
                      if (formErrors.email) setFormErrors(prev => ({ ...prev, email: undefined }));
                    }}
                    onBlur={() => {
                      if (!newPatientEmail.trim()) setFormErrors(prev => ({ ...prev, email: 'O email é obrigatório' }));
                      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPatientEmail)) setFormErrors(prev => ({ ...prev, email: 'Email em formato inválido' }));
                    }}
                    className={`w-full px-4 py-2.5 border ${formErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 focus:border-[#86EFAC] focus:ring-[#86EFAC]'} rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1`}
                    placeholder="email@exemplo.com"
                  />
                  {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Telefone/WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={newPatientPhone}
                    onChange={(e) => {
                      setNewPatientPhone(maskPhone(e.target.value));
                      if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: undefined }));
                    }}
                    onBlur={() => {
                      if (!newPatientPhone.trim()) setFormErrors(prev => ({ ...prev, phone: 'O telefone é obrigatório' }));
                      else if (newPatientPhone.replace(/\D/g, '').length < 10) setFormErrors(prev => ({ ...prev, phone: 'Telefone inválido' }));
                    }}
                    pattern="\(\d{2}\) \d{4,5}-\d{4}"
                    minLength={14}
                    maxLength={15}
                    className={`w-full px-4 py-2.5 border ${formErrors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 focus:border-[#86EFAC] focus:ring-[#86EFAC]'} rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1`}
                    placeholder="(11) 98765-4321"
                  />
                  {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Plano de Saúde *</label>
                  <select
                    required
                    value={newPatientInsurance}
                    onChange={(e) => setNewPatientInsurance(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                  >
                    <option value="Particular">Particular</option>
                    <option value="Amil">Amil</option>
                    <option value="Bradesco Saúde">Bradesco Saúde</option>
                    <option value="Unimed">Unimed</option>
                    <option value="SulAmérica">SulAmérica</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Médico Responsável *</label>
                  <select
                    required
                    value={newPatientDoctorId}
                    onChange={(e) => setNewPatientDoctorId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                  >
                    {doctors.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Diagnóstico Inicial</label>
                <input
                  type="text"
                  value={newPatientDiag}
                  onChange={(e) => setNewPatientDiag(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                  placeholder="Ex: Transtorno de Ansiedade Generalizada"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Tags (separadas por vírgula)</label>
                <input
                  type="text"
                  value={newPatientTags}
                  onChange={(e) => setNewPatientTags(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#86EFAC] focus:ring-1 focus:ring-[#86EFAC]"
                  placeholder="Ex: Risco, Acompanhamento, Financeiro Pendente"
                />
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPatientForm(false)}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#86EFAC] hover:bg-[#6EE7B7] rounded-xl transition-colors border border-transparent cursor-pointer flex items-center justify-center space-x-2 shadow-sm"
                >
                  <Send className="h-4 w-4" />
                  <span>Salvar e Enviar Convite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-slate-200 pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pacientes</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie a lista de pacientes ativos e inativos da clínica.</p>
        </div>
        <button
          onClick={() => setShowPatientForm(true)}
          className="bg-[#C1E2A4] text-slate-900 text-sm border border-[#b0d292] font-semibold px-4 py-2 rounded-lg hover:bg-[#b0d292] transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Paciente</span>
        </button>
      </div>

      {/* Table Filters/Search */}
      <div className="w-full flex-col sm:flex-row flex gap-4 items-center mb-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou email" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2.5 w-full border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C1E2A4]/20 focus:border-[#C1E2A4] shadow-sm"
          />
        </div>
        <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm overflow-x-auto space-x-1">
          <button 
            onClick={() => setFilterType('Todos')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${filterType === 'Todos' ? 'bg-[#C1E2A4] text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            Todos ({patients.length})
          </button>
          <button 
            onClick={() => setFilterType('Ativos')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${filterType === 'Ativos' ? 'bg-[#C1E2A4] text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            Ativos ({activeCount})
          </button>
          <button 
            onClick={() => setFilterType('Inativos')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${filterType === 'Inativos' ? 'bg-[#C1E2A4] text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            Inativos ({inactiveCount})
          </button>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0 min-w-[750px]">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="py-4 px-8 text-sm font-semibold text-slate-500 rounded-tl-xl border-b border-slate-200">Paciente</th>
              <th className="py-4 px-8 text-sm font-semibold text-slate-500 border-b border-slate-200">Diagnóstico</th>
              <th className="py-4 px-8 text-sm font-semibold text-slate-500 border-b border-slate-200">Plano de Saúde</th>
              <th className="py-4 px-8 text-sm font-semibold text-slate-500 border-b border-slate-200">Contato</th>
              <th className="py-4 px-8 text-sm font-semibold text-slate-500 text-center border-b border-slate-200">Sessões</th>
              <th className="py-4 px-8 text-sm font-semibold text-slate-500 border-b border-slate-200">Próximo<br/>Atendimento</th>
              <th className="py-4 px-8 text-sm font-semibold text-slate-500 border-b border-slate-200">Status</th>
              <th className="py-4 px-8 text-sm font-semibold text-slate-500 text-center rounded-tr-xl border-b border-slate-200">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPatients.map((patient) => {
              const fakeData = MOCK_EXTRA_DATA[patient.name] || {};
              const isInactive = fakeData.status === 'Inativo' || patient.status === 'inactive';
              
              let emailMock = patient.email;
              if (!emailMock || emailMock === '') {
                emailMock = patient.name.toLowerCase().replace(' ', '.') + '@email.com';
              }
              
              // REAL DATA CALCULATION:
              const patientAppts = appointments.filter(a => a.patient_id === patient.id);
              const completedSessions = patientAppts.filter(a => a.status === 'completed').length + (fakeData.sessions || 0);

              let nextApptDisplay = '-';
              const now = new Date();
              const upcomingAppts = patientAppts
                .filter(a => (a.status === 'confirmed' || a.status === 'pending') && new Date(`${a.date}T${a.start_time}`) > now)
                .sort((a, b) => new Date(`${a.date}T${a.start_time}`).getTime() - new Date(`${b.date}T${b.start_time}`).getTime());

              if (upcomingAppts.length > 0) {
                const next = upcomingAppts[0];
                const nextDate = new Date(`${next.date}T${next.start_time}`);
                const day = String(nextDate.getDate()).padStart(2, '0');
                const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                nextApptDisplay = `${day} ${monthNames[nextDate.getMonth()].toUpperCase()} ${next.start_time}`;
              } else if (fakeData.nextAppt && fakeData.nextAppt !== '-') {
                 nextApptDisplay = fakeData.nextAppt;
              }

              let hasNoRecentAppt = false;
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              
              if (patientAppts.length > 0) {
                const latestDateStr = patientAppts.map(a => a.date).sort().reverse()[0];
                if (new Date(latestDateStr) < thirtyDaysAgo) {
                  hasNoRecentAppt = true;
                }
              } else {
                const createdDate = new Date(patient.created_at);
                if (createdDate < thirtyDaysAgo) {
                  hasNoRecentAppt = true;
                }
              }
              
              return (
                <tr 
                  key={patient.id} 
                  className="hover:bg-slate-50 transition-colors bg-white group cursor-pointer"
                  onClick={() => setSelectedPatientForDetail(patient)}
                >
                  <td className="py-4 px-8">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 font-bold text-sm tracking-wide overflow-hidden border border-slate-200">
                        {patient.photo_url ? (
                          <img src={patient.photo_url} alt={patient.name} className="w-full h-full object-cover" />
                        ) : (
                          patient.name.trim().split(' ').filter(Boolean).length === 1 
                            ? patient.name.trim().substring(0, 2).toUpperCase() 
                            : patient.name.trim().split(' ').filter(Boolean).length > 0 
                              ? (patient.name.trim().split(' ').filter(Boolean)[0][0] + patient.name.trim().split(' ').filter(Boolean)[patient.name.trim().split(' ').filter(Boolean).length - 1][0]).toUpperCase()
                              : '?'
                        )}
                      </div>
                      <div className="flex flex-col justify-center">
                       <div className="font-bold text-slate-900 text-sm whitespace-nowrap leading-tight flex items-center space-x-2">
                          <span className="group-hover:text-emerald-700 transition-colors">{patient.name}</span>
                          {!isInactive && hasNoRecentAppt && (
                            <div title="Sem agendamento há mais de 30 dias" className="flex items-center justify-center text-amber-500 bg-amber-50/80 p-1 rounded-md border border-amber-100/50">
                              <Clock className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                        {patient.tags && patient.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {patient.tags.map((tag, idx) => {
                              const norm = tag.toLowerCase().trim();
                              let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
                              if (norm.includes('risco')) colorClass = 'bg-rose-100 text-rose-700 border-rose-200';
                              else if (norm.includes('acompanhamento')) colorClass = 'bg-sky-100 text-sky-700 border-sky-200';
                              else if (norm.includes('financeiro') || norm.includes('pendente')) colorClass = 'bg-amber-100 text-amber-700 border-amber-200';
                              else if (norm.includes('alta')) colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                              else colorClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';
                              
                              return (
                                <span key={idx} className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${colorClass} tracking-wide whitespace-nowrap leading-none`}>
                                  {tag}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-8">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 whitespace-nowrap">
                      {fakeData.diag || 'Avaliação Inicial'}
                    </span>
                  </td>
                  <td className="py-4 px-8">
                    <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                      {patient.health_insurance || 'Particular'}
                    </span>
                  </td>
                  <td className="py-4 px-8">
                    <div className="flex flex-col space-y-1.5 justify-center">
                      <div className="flex items-center space-x-2 text-slate-500 text-xs">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[140px] leading-none">{emailMock}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-500 text-xs">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="leading-none">{patient.phone}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-8 text-center text-sm font-bold text-slate-900">
                    <div className="flex items-center justify-center space-x-1.5">
                      <span>{completedSessions}</span>
                      {fakeData.trend === 'up' && <span title="Alta frequência recente"><TrendingUp className="w-4 h-4 text-emerald-500" /></span>}
                      {fakeData.trend === 'down' && <span title="Baixa frequência recente"><TrendingDown className="w-4 h-4 text-rose-500" /></span>}
                      {fakeData.trend === 'neutral' && <span title="Frequência estável"><Minus className="w-4 h-4 text-slate-300" /></span>}
                    </div>
                  </td>
                  <td className="py-4 px-8 text-sm font-medium text-slate-700 whitespace-nowrap">
                    {nextApptDisplay}
                  </td>
                  <td className="py-4 px-8">
                    {isInactive ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600">
                        Inativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#C1E2A4] text-slate-800">
                        Ativo
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-8 text-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedPatientForDetail(patient); }}
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors uppercase tracking-wider title-case cursor-pointer"
                    >
                      Perfil
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {filteredPatients.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12">
                   <div className="flex flex-col items-center justify-center text-slate-500">
                     <User className="w-10 h-10 mb-3 text-slate-300" />
                     <p className="font-semibold text-slate-600">Nenhum paciente encontrado</p>
                     <p className="text-sm mt-1">Tente ajustar seus filtros ou realizar uma nova busca.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {selectedPatientForDetail && (
        <PatientDetailModal
          patient={selectedPatientForDetail}
          onClose={() => setSelectedPatientForDetail(null)}
          onDelete={() => {
            dataManager.deletePatient(selectedPatientForDetail.id);
            onRefreshDashboard();
            setSelectedPatientForDetail(null);
            setToastMessage('Paciente excluído com sucesso!');
            setTimeout(() => setToastMessage(''), 3000);
          }}
          extraData={MOCK_EXTRA_DATA[selectedPatientForDetail.name]}
        />
      )}

    </div>
  );
}

