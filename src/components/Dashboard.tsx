import { useState, useEffect } from 'react';
import { AlertCircle, Calendar, DollarSign, Users, ArrowRight, MessageSquare, Phone, BrainCircuit, Heart, RefreshCw, Layers } from 'lucide-react';
import { Appointment, Patient, Billing, DiaryEntry, dataManager } from '../data';

interface DashboardProps {
  onNavigate: (tab: string, param?: string) => void;
  triggerRefresh: number;
}

export default function Dashboard({ onNavigate, triggerRefresh }: DashboardProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [billing, setBilling] = useState<Billing[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  
  const [showSessaoForm, setShowSessaoForm] = useState(false);
  const [selectedSessaoPatientId, setSelectedSessaoPatientId] = useState('');
  const [sessaoDate, setSessaoDate] = useState('2026-06-09');
  const [sessaoTime, setSessaoTime] = useState('14:00');

  // Load state values
  useEffect(() => {
    const listPats = dataManager.getPatients();
    setPatients(listPats);
    setAppointments(dataManager.getAppointments());
    setBilling(dataManager.getBilling());
    setDiaryEntries(dataManager.getDiaryEntries());
    if (!selectedSessaoPatientId && listPats.length > 0) {
      setSelectedSessaoPatientId(listPats[0].id);
    }
  }, [triggerRefresh]);

  const handleCreateSessao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessaoPatientId) return;
    dataManager.addAppointment({
      patient_id: selectedSessaoPatientId,
      date: sessaoDate,
      start_time: sessaoTime,
      duration: 50,
      type: 'online',
      status: 'confirmed'
    });
    setAppointments(dataManager.getAppointments());
    setShowSessaoForm(false);
  };

  // Calculations for KPIs
  const todayStr = '2026-06-09';
  const appointmentsToday = appointments.filter(app => app.date === todayStr);
  const activePatientsCount = patients.filter(p => p.status === 'active').length;

  // Monthly revenue for June 2026
  const monthlyRevenue = billing
    .filter(bill => bill.status === 'paid')
    .reduce((acc, bill) => acc + bill.amount, 0);

  // Filter diary alerts where crisis_flag is true
  const crisisAlerts = diaryEntries.filter(entry => entry.crisis_flag);
  
  // Filter other entries for the 24h recap list
  const stableEntries = diaryEntries.filter(entry => !entry.crisis_flag);

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || 'Paciente Não Identificado';
  };

  const getPatientPhone = (id: string) => {
    return patients.find(p => p.id === id)?.phone || '';
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 border-b border-slate-200 pb-4 md:pb-6 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Bem-vinda de volta! Aqui está o resumo do seu dia.
          </p>
        </div>
        <div className="flex items-center space-x-2 md:space-x-3">
          <button className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors shadow-sm text-slate-700 cursor-pointer">
            Ver Relatórios
          </button>
          <button 
            onClick={() => setShowSessaoForm(true)}
            className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-lg bg-[#C1E2A4] text-slate-900 hover:bg-[#b0d292] transition-colors shadow-sm cursor-pointer border border-[#b0d292]"
          >
            Nova Sessão
          </button>
        </div>
      </div>

      {showSessaoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-bg-primary rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-emerald-500" />
                <span>Nova Sessão / Agendamento</span>
              </h3>
              <button 
                onClick={() => setShowSessaoForm(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateSessao} className="p-6 bg-white space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Paciente</label>
                <select
                  required
                  value={selectedSessaoPatientId}
                  onChange={(e) => setSelectedSessaoPatientId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#C1E2A4] focus:ring-2 focus:ring-[#C1E2A4]/20"
                >
                  <option value="">Selecione um Paciente</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={sessaoDate}
                    onChange={(e) => setSessaoDate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#C1E2A4] focus:ring-2 focus:ring-[#C1E2A4]/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={sessaoTime}
                    onChange={(e) => setSessaoTime(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#C1E2A4] focus:ring-2 focus:ring-[#C1E2A4]/20"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSessaoForm(false)}
                  className="flex-1 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm font-semibold text-slate-900 bg-[#C1E2A4] hover:bg-[#b0d292] rounded-lg transition-colors border border-[#b0d292] cursor-pointer"
                >
                  Agendar Sessão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Central de Alertas */}
      <div className="border border-red-500 rounded-2xl bg-white overflow-hidden shadow-sm flex flex-col mb-8 p-6 text-center">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shadow-sm">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">Central de Alertas Clínicos</h2>
            <p className="text-sm md:text-base text-slate-600 mt-2 max-w-lg mx-auto">
              Você possui <span className="font-bold text-red-600">{crisisAlerts.length} alertas</span> de risco pendentes. Por favor, revise as ocorrências ou entre em contato com os pacientes imediatamente.
            </p>
          </div>
          <button 
             onClick={() => onNavigate('alertas')}
             className="mt-2 text-sm md:text-base font-semibold bg-red-500 text-white hover:bg-red-600 px-6 py-3 rounded-xl flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
          >
            <span>Ver todos os alertas</span>
            <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        
        {/* KPI 1: Monthly billing */}
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
            </div>
            <ArrowRight className="h-3 w-3 md:h-4 md:w-4 text-emerald-500 -rotate-45" />
          </div>
          <div>
            <span className="text-[10px] md:text-sm text-slate-500 block mb-0.5 md:mb-1">Faturamento</span>
            <span className="text-lg md:text-2xl font-bold text-slate-900 block truncate">R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* KPI 2: Active patients */}
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
            </div>
            <ArrowRight className="h-3 w-3 md:h-4 md:w-4 text-blue-500 -rotate-45" />
          </div>
          <div>
            <span className="text-[10px] md:text-sm text-slate-500 block mb-0.5 md:mb-1">Pacientes</span>
            <span className="text-lg md:text-2xl font-bold text-slate-900 block">{activePatientsCount}</span>
          </div>
        </div>

        {/* KPI 3: Appointments today */}
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Calendar className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
            </div>
          </div>
          <div>
            <span className="text-[10px] md:text-sm text-slate-500 block mb-0.5 md:mb-1">Sessões Hoje</span>
            <span className="text-lg md:text-2xl font-bold text-slate-900 block">{appointmentsToday.length}</span>
          </div>
        </div>
        
        {/* KPI 4: Active Alerts */}
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-pink-50 flex items-center justify-center">
              <Heart className="h-4 w-4 md:h-5 md:w-5 text-pink-500" />
            </div>
          </div>
          <div>
            <span className="text-[10px] md:text-sm text-slate-500 block mb-0.5 md:mb-1">Alertas Ativos</span>
            <span className="text-lg md:text-2xl font-bold text-slate-900 block">{crisisAlerts.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
