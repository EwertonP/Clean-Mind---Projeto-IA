import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Users, Globe, MapPin, Check, Sparkles, RefreshCw, MessageSquare, CheckCircle2, CalendarPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Appointment, Patient, dataManager } from '../data';
import { connectGoogleCalendar, isGoogleCalendarConnected, addToGoogleCalendar, sendAppointmentEmail } from '../googleCalendar';

interface AgendaProps {
  onRefreshDashboard: () => void;
  triggerRefresh: number;
}

export default function Agenda({ onRefreshDashboard, triggerRefresh }: AgendaProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [date, setDate] = useState('2026-06-09');
  const [startTime, setStartTime] = useState('14:30');
  const [duration, setDuration] = useState(50);
  const [type, setType] = useState<'online' | 'presencial'>('online');
  const [room, setRoom] = useState('Sala 1');
  const [appointmentType, setAppointmentType] = useState<'novo' | 'retorno'>('novo');
  const [recurrence, setRecurrence] = useState('none');
  
  // Tabs & Config State
  const [activeSubTab, setActiveSubTab] = useState<'calendario' | 'configuracoes'>('calendario');
  const [configDoctorId, setConfigDoctorId] = useState('');
  const [scheduleConfig, setScheduleConfig] = useState([
    { id: 'seg', label: 'Segunda-feira', active: true, start: '12:00', end: '15:00' },
    { id: 'ter', label: 'Terça-feira', active: true, start: '08:00', end: '18:00' },
    { id: 'qua', label: 'Quarta-feira', active: true, start: '08:00', end: '18:00' },
    { id: 'qui', label: 'Quinta-feira', active: true, start: '08:00', end: '18:00' },
    { id: 'sex', label: 'Sexta-feira', active: true, start: '08:00', end: '18:00' },
    { id: 'sab', label: 'Sábado', active: false, start: '08:00', end: '12:00' },
    { id: 'dom', label: 'Domingo', active: false, start: '08:00', end: '12:00' },
  ]);

  // Toast State
  const [toastMessage, setToastMessage] = useState('');

  const doctors = dataManager.getDoctors();

  useEffect(() => {
    const fetchedPatients = dataManager.getPatients();
    setPatients(fetchedPatients);
    setAppointments(dataManager.getAppointments());
    if (selectedPatientId === '' && fetchedPatients.length > 0) {
      setSelectedPatientId(fetchedPatients[0].id);
    }
    
    // Use dataManager.getDoctors() directly to avoid tracking a new array reference on every render
    const fetchedDoctors = dataManager.getDoctors();
    if (configDoctorId === '' && fetchedDoctors.length > 0) {
      setConfigDoctorId(fetchedDoctors[0].id);
    }
  }, [triggerRefresh]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !date || !startTime) return;

    const currentDoc = doctors.find(d => d.id === (configDoctorId || doctors[0].id));
    const busStart = currentDoc?.business_hours?.start || '08:00';
    const busEnd = currentDoc?.business_hours?.end || '18:00';
    if (startTime < busStart || startTime > busEnd) {
      setToastMessage(`Fora do horário de funcionamento (${busStart} às ${busEnd}).`);
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    if (type === 'presencial') {
      // Check for conflicts
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
      
      const hasConflict = dataManager.getAppointments().some((app) => {
        if (app.type !== 'presencial' || app.room !== room || app.date !== date || app.status === 'canceled') return false;
        if (editingAppointmentId && app.id === editingAppointmentId) return false;
        
        const appStart = new Date(`${app.date}T${app.start_time}`);
        const appEnd = new Date(appStart.getTime() + app.duration * 60000);
        
        // Conflict occurs if new start time is before existing end time AND new end time is after existing start time
        return startDateTime < appEnd && endDateTime > appStart;
      });

      if (hasConflict) {
        setToastMessage(`Conflito: A ${room} já está ocupada neste horário.`);
        setTimeout(() => setToastMessage(''), 3000);
        return;
      }
    }

    // Save to data manager
    let newApp;
    if (editingAppointmentId) {
      newApp = dataManager.updateAppointment(editingAppointmentId, {
        patient_id: selectedPatientId,
        date,
        start_time: startTime,
        duration,
        type,
        room: type === 'presencial' ? room : undefined
      });
      if (!newApp) return;
    } else {
      newApp = dataManager.addAppointment({
        patient_id: selectedPatientId,
        date,
        start_time: startTime,
        duration,
        type,
        room: type === 'presencial' ? room : undefined,
        status: 'confirmed'
      });
    }

    // Refresh clinical lists
    setAppointments(dataManager.getAppointments());
    
    if (isGoogleCalendarConnected()) {
      addToGoogleCalendar(newApp, getPatientName(selectedPatientId));
      
      const pat = patients.find(p => p.id === selectedPatientId);
      if (pat && pat.email) {
        const confirmed = window.confirm(`Deseja enviar um email de confirmação para ${pat.email}?`);
        if (confirmed) {
           sendAppointmentEmail(pat.email, pat.name, newApp.date, newApp.start_time).then(() => {
              console.log('Email sent request complete');
           });
        }
      }
    }
    
    // Simulate WhatsApp Dispatch
    setToastMessage('Agendamento realizado');
    
    // Reset Form
    setShowForm(false);
    onRefreshDashboard();

    // Auto dismiss Toast
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || 'Paciente';
  };

  // Time slots mapping based on doctor
  const timeSlots = useMemo(() => {
    const doc = doctors.find(d => d.id === (configDoctorId || doctors[0].id));
    const startHour = parseInt((doc?.business_hours?.start || '08:00').split(':')[0], 10);
    const endHour = parseInt((doc?.business_hours?.end || '18:00').split(':')[0], 10);
    
    const slots = [];
    for (let i = startHour; i <= endHour; i++) {
      slots.push(i.toString().padStart(2, '0') + ':00');
    }
    return slots.length > 0 ? slots : ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  }, [doctors, configDoctorId]);

  const [currentDate, setCurrentDate] = useState(() => new Date());

  const getWeekDays = (date: Date) => {
    const doc = doctors.find(d => d.id === (configDoctorId || doctors[0].id));
    const businessDaysStr = (doc?.business_hours?.days || 'Segunda a Sábado').toLowerCase();
    let numDays = 6; // Default to Saturday
    if (businessDaysStr.includes('sexta')) numDays = 5;
    if (businessDaysStr.includes('domingo')) numDays = 7;

    const curr = new Date(date);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    
    const firstDay = new Date(curr);
    firstDay.setDate(diff);

    const week = [];
    const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const today = new Date();

    for (let i = 0; i < numDays; i++) {
        const nextDay = new Date(firstDay);
        nextDay.setDate(firstDay.getDate() + i);
        const dayLabel = nextDay.getDate().toString().padStart(2, '0');
        const isActive = today.getDate() === nextDay.getDate() && 
                         today.getMonth() === nextDay.getMonth() && 
                         today.getFullYear() === nextDay.getFullYear();
                         
        const isoDate = nextDay.getFullYear() + '-' + String(nextDay.getMonth() + 1).padStart(2, '0') + '-' + String(nextDay.getDate()).padStart(2, '0');
        
        week.push({ name: dayNames[i], label: dayLabel, active: isActive, date: isoDate });
    }
    return week;
  };

  const weekDays = getWeekDays(currentDate);

  const formatMonthYear = (date: Date) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const nextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const prevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const goToday = () => {
    setCurrentDate(new Date());
  };

  const colors = ['bg-[#C1E2A4]', 'bg-blue-200', 'bg-orange-200', 'bg-purple-200', 'bg-pink-200'];
  const getAppointmentForSlot = (isoDate: string, time: string) => {
    return appointments.find(app => app.date === isoDate && app.start_time === time);
  };

  const getPatientColor = (patientId: string) => {
    const idx = patients.findIndex(p => p.id === patientId);
    return colors[Math.max(0, idx) % colors.length];
  };

  return (
    <div className="space-y-8 font-sans">
      
      {/* Toast Alert Simulation */}
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

      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Agenda</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={async () => {
              try {
                await connectGoogleCalendar();
                setToastMessage('Google Calendar sincronizado!');
                setTimeout(() => setToastMessage(''), 3000);
              } catch (e) {
                setToastMessage('Erro ao sincronizar Calendar');
                setTimeout(() => setToastMessage(''), 3000);
              }
            }}
            className="bg-white text-slate-700 border border-slate-300 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
          >
            <CalendarPlus className="h-4 w-4" />
            <span>Sincronizar Google Calendar</span>
          </button>
          
          <button
            onClick={() => {
              setEditingAppointmentId(null);
              setShowForm(!showForm);
              // Default select patient if empty
              if (!selectedPatientId && patients.length > 0) {
                setSelectedPatientId(patients[0].id);
              }
            }}
            className="bg-[#C1E2A4] text-slate-900 border border-[#b0d292] font-semibold text-sm px-4 py-2 rounded-lg hover:bg-[#b0d292] transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6 font-medium text-slate-500">
        <ul className="flex flex-wrap -mb-px text-sm">
          <li className="mr-8">
            <button 
              onClick={() => setActiveSubTab('calendario')}
              className={`inline-block pb-3 transition-colors cursor-pointer ${activeSubTab === 'calendario' ? 'text-slate-900 border-b-2 border-slate-900 font-semibold' : 'hover:text-slate-700 hover:border-slate-300 border-b-2 border-transparent'}`}
            >
              Calendário
            </button>
          </li>
          <li className="mr-8">
            <button 
              onClick={() => setActiveSubTab('configuracoes')}
              className={`inline-block pb-3 transition-colors cursor-pointer ${activeSubTab === 'configuracoes' ? 'text-slate-900 border-b-2 border-slate-900 font-semibold' : 'hover:text-slate-700 hover:border-slate-300 border-b-2 border-transparent'}`}
            >
              Configurações
            </button>
          </li>
        </ul>
      </div>

      {/* Modal / Overlay Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-screen">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900">
                <CalendarIcon className="h-5 w-5 text-emerald-500" />
                <h3 className="font-bold text-lg">{editingAppointmentId ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* WhatsApp Banner */}
              <div className="bg-emerald-50 border border-emerald-500/30 rounded-xl p-4 flex items-start space-x-3">
                <MessageSquare className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-emerald-800 font-bold text-sm">Integração WhatsApp Nativa</h4>
                  <p className="text-emerald-600/80 text-xs mt-0.5">Confirmação automática enviada ao paciente + Lembrete 24h antes + Link para reagendamento.</p>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Tipo de Atendimento *</label>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value as any)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
                  >
                    <option value="novo">Novo Atendimento</option>
                    <option value="retorno">Retorno</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Paciente *</label>
                  <select
                    required
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
                  >
                    {patients.length === 0 ? (
                      <option value="">Carregue pacientes...</option>
                    ) : (
                      patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name} {p.status === 'archived' ? '(Arquivado)' : ''}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Data *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Horário *</label>
                  <input
                    type="time"
                    required
                    min={doctors.find(d => d.id === (configDoctorId || doctors[0].id))?.business_hours?.start || "08:00"}
                    max={doctors.find(d => d.id === (configDoctorId || doctors[0].id))?.business_hours?.end || "18:00"}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
                  />
                </div>

                {appointmentType === 'novo' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Tipo de Sessão *</label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
                      >
                         <option value="online">Terapia Individual (Online)</option>
                         <option value="presencial">Terapia Individual (Presencial)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Duração (minutos) *</label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
                      >
                        <option value={30}>30 minutos</option>
                        <option value={45}>45 minutos</option>
                        <option value={50}>50 minutos</option>
                        <option value={60}>60 minutos</option>
                        <option value={90}>90 minutos</option>
                      </select>
                    </div>

                    {type === 'presencial' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Sala de Atendimento *</label>
                        <select
                          value={room}
                          onChange={(e) => setRoom(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
                        >
                          {(doctors.find(d => d.id === (configDoctorId || doctors[0].id))?.clinic_rooms || ['Sala 1']).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sync Banner */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start space-x-3">
                  <Sparkles className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-blue-900 font-bold text-sm">Sincronização Inteligente de Horários</h4>
                    <p className="text-blue-700/80 text-xs mt-0.5">O cleanmind verifica automaticamente conflitos, sugere horários disponíveis e sincroniza com Google Calendar.</p>
                  </div>
                </div>
                
                <div className="space-y-3 bg-white rounded-lg p-4 border border-blue-100">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="h-4 w-4 text-emerald-500" />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">Enviar confirmação via WhatsApp</span>
                        <span className="block text-xs text-slate-500">Mensagem automática com data, hora e link</span>
                      </div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500" />
                  </label>
                  <div className="border-t border-slate-100"></div>
                  <label className="flex items-center justify-between cursor-pointer pt-1">
                    <div className="flex items-center space-x-3">
                      <RefreshCw className="h-4 w-4 text-blue-500" />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">Sincronizar com Google Calendar</span>
                        <span className="block text-xs text-slate-500">Atualização automática em tempo real</span>
                      </div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-500 border-slate-300 rounded focus:ring-blue-500" />
                  </label>
                </div>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-3">
               <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-bold bg-[#C1E2A4] text-slate-900 rounded-lg hover:bg-[#b0d292] transition-colors cursor-pointer shadow-sm border border-[#b0d292]"
                >
                  {editingAppointmentId ? 'Salvar Alterações' : 'Finalizar Agendamento'}
                </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Calendar View Container */}
      {activeSubTab === 'calendario' && (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        
        {/* Calendar Nav */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-1 bg-white">
             <button className="px-4 py-1.5 text-sm font-medium text-slate-600 rounded-md transition-colors cursor-pointer hover:bg-slate-50">Dia</button>
             <button className="px-4 py-1.5 text-sm font-medium text-slate-900 bg-[#C1E2A4] rounded-md transition-colors cursor-pointer">Semana</button>
             <button className="px-4 py-1.5 text-sm font-medium text-slate-600 rounded-md transition-colors cursor-pointer hover:bg-slate-50">Mês</button>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-colors shadow-sm bg-white text-slate-600">
               &lt;
            </button>
            <button onClick={goToday} className="px-4 py-1.5 hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-colors text-sm font-medium shadow-sm bg-white text-slate-900">
               Hoje
            </button>
            <span className="font-semibold text-sm px-2 text-slate-900">{formatMonthYear(currentDate)}</span>
            <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-colors shadow-sm bg-white text-slate-600">
               &gt;
            </button>
          </div>
        </div>

        {/* Weekly Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="flex bg-white">
               <div className="w-16 sm:w-20 shrink-0 border-r border-slate-200"></div>
               {weekDays.map(day => (
                 <div key={day.name} className="flex-1 py-3 text-center border-r border-slate-100 last:border-0 border-b border-slate-200">
                    <span className="block text-xs sm:text-sm text-slate-500 mb-1">{day.name}</span>
                    <span className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 text-sm font-medium rounded-full ${day.active ? 'bg-[#C1E2A4] text-slate-900' : 'text-slate-900'}`}>
                      {day.label}
                    </span>
                 </div>
               ))}
            </div>

            {/* Time Grid Rows */}
            <div className="bg-white">
              {timeSlots.map((time, rowIdx) => (
                 <div key={time} className="flex border-b border-slate-100 last:border-0 min-h-[110px]">
                    <div className="w-16 sm:w-20 shrink-0 border-r border-slate-200 flex justify-center py-2 text-xs sm:text-sm text-slate-400 font-medium">
                      {time}
                    </div>
                    {weekDays.map((day, colIdx) => {
                      const event = getAppointmentForSlot(day.date, time);
                      return (
                        <div key={`${day.label}-${time}`} className="flex-1 border-r border-slate-100 last:border-0 relative p-1.5 align-top flex hover:bg-slate-50 transition-colors">
                           {event && (
                             <div 
                               onClick={() => {
                                 setEditingAppointmentId(event.id);
                                 setSelectedPatientId(event.patient_id);
                                 setDate(event.date);
                                 setStartTime(event.start_time);
                                 setDuration(event.duration);
                                 setType(event.type);
                                 if (event.room) setRoom(event.room);
                                 setShowForm(true);
                               }}
                               className={`${getPatientColor(event.patient_id)} w-full h-auto rounded-lg p-2 sm:p-2.5 flex flex-col text-slate-900 shadow-sm mx-auto overflow-hidden cursor-pointer hover:ring-2 hover:ring-slate-900/20 transition-all`}
                             >
                                <div className="flex items-center space-x-1 mb-1 pb-1 border-b border-slate-900/10">
                                   <Clock className="w-3 h-3 opacity-60 shrink-0" />
                                   <span className="block text-[10px] sm:text-xs font-semibold truncate">{event.start_time} - {event.duration}m</span>
                                </div>
                                <div className="flex items-center space-x-2 mt-1">
                                   <div className="w-5 h-5 rounded-full bg-slate-900/10 flex items-center justify-center shrink-0">
                                      <span className="text-[10px] font-bold text-slate-900">{getPatientName(event.patient_id).charAt(0)}</span>
                                   </div>
                                   <span className="block text-xs sm:text-sm font-bold leading-tight line-clamp-1">{getPatientName(event.patient_id)}</span>
                                </div>
                                {event.room && (
                                   <div className="flex items-center space-x-1 mt-1.5 opacity-80 mt-auto">
                                      <MapPin className="w-3 h-3 shrink-0" />
                                      <span className="text-[10px] font-medium truncate">{event.room}</span>
                                   </div>
                                )}
                             </div>
                           )}
                        </div>
                      );
                    })}
                 </div>
              ))}
            </div>
          </div>
        </div>

      </div>
      )}

      {activeSubTab === 'configuracoes' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="mb-6">
             <label className="block text-sm font-semibold text-slate-700 mb-2">Selecione o Médico</label>
             <select 
               value={configDoctorId} 
               onChange={(e) => setConfigDoctorId(e.target.value)}
               className="w-full sm:w-80 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4]"
             >
               {doctors.map(doc => (
                 <option key={doc.id} value={doc.id}>{doc.name} - {doc.specialty}</option>
               ))}
             </select>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 mb-4 text-lg">Horários de Atendimento</h3>
            <div className="space-y-4">
              {scheduleConfig.map((item, idx) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 p-4 border border-slate-200 rounded-xl bg-slate-50 relative">
                  <div className="flex items-center space-x-3 w-40">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer" 
                      checked={item.active} 
                      onChange={(e) => {
                        const newConfig = [...scheduleConfig];
                        newConfig[idx].active = e.target.checked;
                        setScheduleConfig(newConfig);
                      }}
                    />
                    <span className="font-medium text-slate-700">{item.label}</span>
                  </div>
                  {item.active ? (
                    <div className="flex items-center space-x-3">
                      <div>
                         <span className="text-xs text-slate-500 block mb-1 px-1">Início</span>
                         <input type="time" value={item.start} onChange={(e) => {
                            const newConfig = [...scheduleConfig];
                            newConfig[idx].start = e.target.value;
                            setScheduleConfig(newConfig);
                         }} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C1E2A4]" />
                      </div>
                      <span className="text-slate-400 mt-5">-</span>
                      <div>
                         <span className="text-xs text-slate-500 block mb-1 px-1">Fim</span>
                         <input type="time" value={item.end} onChange={(e) => {
                            const newConfig = [...scheduleConfig];
                            newConfig[idx].end = e.target.value;
                            setScheduleConfig(newConfig);
                         }} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C1E2A4]" />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Indisponível</span>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-8 flex justify-end">
               <button 
                 onClick={() => {
                   setToastMessage('Configurações salvas com sucesso');
                   setTimeout(() => setToastMessage(''), 3000);
                 }}
                 className="px-6 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
               >
                 Salvar Agendas
               </button>
            </div>
          </div>
        </div>
      )}

      {/* API Notice */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl text-xs font-mono text-slate-500 space-y-1.5 max-w-4xl shadow-sm">
        <strong className="text-[#192F28] block">Criptografia Local & LGPD Compliance:</strong>
        Todas as consultas mostradas e inseridas estão restritas ao isolamento por token de identificação do médico. Os alertas e confirmações são despachados de ponta-a-ponta usando criptografia pós-sessão do WhatsApp Webhook.
      </div>

    </div>
  );
}
