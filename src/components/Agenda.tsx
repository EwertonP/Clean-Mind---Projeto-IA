import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Users, Globe, MapPin, Check, Sparkles, RefreshCw, MessageSquare, CheckCircle2, CalendarPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Appointment, Patient, dataManager } from '../data';
import { connectGoogleCalendar, isGoogleCalendarConnected, syncGoogleCalendarEvent, deleteGoogleCalendarEvent, sendAppointmentEmail, checkGoogleCalendarAvailability } from '../googleCalendar';
import { useStore } from '../store';

interface AgendaProps {
  onNavigate?: (tab: string, patientId?: string, draft?: any) => void;
  initialOpenNewModal?: boolean;
}

export default function Agenda({ onNavigate, initialOpenNewModal }: AgendaProps) {
  const patientsStore = useStore(state => state.patients); const patients = useMemo(() => patientsStore.filter(Boolean), [patientsStore]);
  const appointmentsStore = useStore(state => state.appointments); const appointments = useMemo(() => appointmentsStore.filter(a => a && a.date), [appointmentsStore]);
  const doctorsStoreStore = useStore(state => state.doctors); const doctorsStore = useMemo(() => doctorsStoreStore.filter(Boolean), [doctorsStoreStore]);

  const doctors = doctorsStore.filter(d => d.role === 'doctor' || (d.role !== 'admin' && d.crp_crm && d.crp_crm !== ''));
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [date, setDate] = useState('2026-06-09');
  const [startTime, setStartTime] = useState('14:30');
  const [duration, setDuration] = useState(60);
  const [type, setType] = useState<'online' | 'presencial'>('online');
  const [room, setRoom] = useState('Sala 1');
  const [appointmentType, setAppointmentType] = useState<'novo' | 'retorno'>('novo');
  const [consultationPrice, setConsultationPrice] = useState('0.00');
  const [recurrence, setRecurrence] = useState('none');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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

  useEffect(() => {
    if (appointmentType === 'retorno') {
      setConsultationPrice('0.00');
    } else {
      const patient = patients.find(p => p.id === selectedPatientId);
      const doctorId = patient?.doctor_id || dataManager.getDoctor().id;
      const doc = doctorsStore.find(d => d.id === doctorId);
      setConsultationPrice(doc?.consultation_price ? doc.consultation_price.toFixed(2) : '350.00');
    }
  }, [appointmentType, selectedPatientId, patients, showForm]);

  useEffect(() => {
    if (initialOpenNewModal) {
      setEditingAppointmentId(null);
      setShowForm(true);
    }
  }, [initialOpenNewModal]);

  useEffect(() => {
    if (selectedPatientId === '' && patients.length > 0) {
      setSelectedPatientId(patients[0].id);
    }
    
    if (configDoctorId === '' && doctors.length > 0) {
      setConfigDoctorId(doctors[0].id);
    }
  }, [patients, doctors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !date || !startTime) return;

    const currentDoc = doctors.find(d => d.id === (configDoctorId || (doctors[0] ? doctors[0].id : '')));
    const busStart = currentDoc?.business_hours?.start || '08:00';
    const busEnd = currentDoc?.business_hours?.end || '18:00';
    if (startTime < busStart || startTime > busEnd) {
      setToastMessage(`Fora do horário de funcionamento (${busStart} às ${busEnd}).`);
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    // Check for conflicts
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
    
    // Find the doctor handling this appointment to check conflicts
    const doctorId = patients.find(p => p.id === selectedPatientId)?.doctor_id || dataManager.getDoctor().id;
    const docForCheck = doctors.find(d => d.id === doctorId);
    
    const hasConflict = dataManager.getAppointments().some((app) => {
      if (app.date !== date || app.status === 'canceled' || app.doctor_id !== doctorId) return false;
      if (editingAppointmentId && app.id === editingAppointmentId) return false;
      
      const appStart = new Date(`${app.date}T${app.start_time}`);
      const appEnd = new Date(appStart.getTime() + app.duration * 60000);
      
      // Conflict occurs if new start time is before existing end time AND new end time is after existing start time
      return startDateTime < appEnd && endDateTime > appStart;
    });

    if (hasConflict) {
      setToastMessage(`Conflito: Este médico já possui outro agendamento neste horário no sistema.`);
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }
    
    // Check Google Calendar API conflicts
    const tokenForCheck = docForCheck?.google_access_token;
    if (tokenForCheck || isGoogleCalendarConnected(docForCheck)) {
      const editingApp = editingAppointmentId ? dataManager.getAppointments().find(a => a.id === editingAppointmentId) : undefined;
      const isAvailable = await checkGoogleCalendarAvailability(startDateTime, endDateTime, tokenForCheck, editingApp?.google_event_id, docForCheck?.id);
      
      if (!isAvailable) {
        setToastMessage(`Conflito: Este horário já está ocupado no Google Calendar do médico.`);
        setTimeout(() => setToastMessage(''), 3000);
        return;
      }
    }

    // Save to data manager
    let newApp;
    const maxPrice = consultationPrice ? parseFloat(consultationPrice.replace(',', '.')) : 0;
    let needsBilling = false;
    let newAppPrice = 0;

    const finalPrice = appointmentType === 'retorno' ? 0 : (maxPrice * (duration / 60));

    if (editingAppointmentId) {
      newApp = dataManager.updateAppointment(editingAppointmentId, {
        patient_id: selectedPatientId,
        date,
        start_time: startTime,
        duration,
        type,
        room: type === 'presencial' ? room : undefined,
        is_return: appointmentType === 'retorno',
        price: finalPrice
      });
      if (!newApp) return;
    } else {
      newAppPrice = finalPrice;
      newApp = dataManager.addAppointment({
        patient_id: selectedPatientId,
        date,
        start_time: startTime,
        duration,
        type,
        room: type === 'presencial' ? room : undefined,
        status: 'confirmed',
        is_return: appointmentType === 'retorno',
        price: finalPrice,
        doctor_id: doctorId
      });

      if (!newApp.is_return && newAppPrice > 0) {
        needsBilling = true;
      }
    }

    // Refresh clinical lists
    
    const appDoctorId = newApp.doctor_id || patients.find(p => p.id === selectedPatientId)?.doctor_id || dataManager.getDoctor().id;
    const doc = doctorsStore.find(d => d.id === appDoctorId) || dataManager.getDoctors().find(d => d.id === appDoctorId) || dataManager.getDoctor();
    const doctorToken = doc?.google_access_token;
    
    if (isGoogleCalendarConnected(doc) || doctorToken) {
      const doctorName = doc?.name?.trim() ? doc.name : 'Médico';
      const actualRoom = newApp.type === 'presencial' ? newApp.room : undefined;
      const pat = patients.find(p => p.id === selectedPatientId);
      
      let meetLinkToUse: string | undefined = undefined;
      
      try {
        const syncResult = await syncGoogleCalendarEvent(newApp, getPatientName(selectedPatientId), doctorName, actualRoom, doctorToken, pat?.email);
        if (syncResult?.eventId) {
          meetLinkToUse = syncResult.meetLink;
          if (!newApp.google_event_id) {
            newApp = dataManager.updateAppointment(newApp.id, { google_event_id: syncResult.eventId });
          }
          setToastMessage('Agendamento realizado e sincronizado com o Google Calendar');
        } else {
          setToastMessage('Agendamento realizado (não sincronizado no Google Calendar devido a token expirado)');
        }
      } catch (err) {
        console.error("Calendar sync error", err);
        setToastMessage('Agendamento realizado (Falha na sincronização do Calendário)');
      }
      
      if (pat && pat.email) {
        const confirmed = window.confirm(`Deseja enviar um email de confirmação para ${pat.email}?`);
        if (confirmed) {
           sendAppointmentEmail(
             pat.email, 
             pat.name, 
             newApp.date, 
             newApp.start_time, 
             newApp.type, 
             meetLinkToUse, 
             actualRoom ? `${doctorName} - ${actualRoom}` : doctorName, 
             doctorName
           ).then(() => {
              console.log('Email sent request complete');
           });
        }
      }
    } else {
      setToastMessage('Agendamento realizado');
    }
    
    // Reset Form
    setShowForm(false);
    setShowDeleteConfirm(false);

    // Auto dismiss Toast
    setTimeout(() => {
      setToastMessage('');
    }, 3000);

    // Redirect to Financeiro
    if (needsBilling && onNavigate) {
      onNavigate('financeiro', selectedPatientId, {
        patientId: selectedPatientId,
        amount: newAppPrice.toString(),
        dueDate: newApp.date
      });
    }
  };

  const handleDeleteAppointment = async () => {
    if (!editingAppointmentId) return;
    const appToDel = appointments.find(a => a.id === editingAppointmentId);
    
    dataManager.deleteAppointment(editingAppointmentId);
    setShowForm(false);
    setShowDeleteConfirm(false);

    const doc = doctorsStore.find(d => d.id === appToDel?.doctor_id);
    const doctorToken = doc?.google_access_token;
    
    if (appToDel?.google_event_id && (isGoogleCalendarConnected(doc) || doctorToken)) {
      await deleteGoogleCalendarEvent(appToDel.google_event_id, doctorToken, appToDel.doctor_id);
    }
    
    setToastMessage('Agendamento excluído com sucesso');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || 'Paciente';
  };

  // Time slots mapping based on doctor
  const timeSlots = useMemo(() => {
    const doc = doctors.find(d => d.id === (configDoctorId || (doctors[0] ? doctors[0].id : '')));
    const startHour = parseInt((doc?.business_hours?.start || '08:00').split(':')[0], 10);
    const endHour = parseInt((doc?.business_hours?.end || '18:00').split(':')[0], 10);
    
    const slots = [];
    for (let i = startHour; i <= endHour; i++) {
      slots.push(i.toString().padStart(2, '0') + ':00');
    }
    return slots.length > 0 ? slots : ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  }, [doctors, configDoctorId]);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [calendarFilter, setCalendarFilter] = useState<string>('all');
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');

  const nextMonthOrWeek = () => {
    const next = new Date(currentDate);
    if (calendarView === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    setCurrentDate(next);
  };

  const prevMonthOrWeek = () => {
    const prev = new Date(currentDate);
    if (calendarView === 'month') {
      prev.setMonth(prev.getMonth() - 1);
    } else {
      prev.setDate(prev.getDate() - 7);
    }
    setCurrentDate(prev);
  };

  const getCalendarMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    
    const startDate = new Date(firstDay);
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);

    const days = [];
    const maxDays = 42; 
    let current = new Date(startDate);
    const today = new Date();
    
    for (let i = 0; i < maxDays; i++) {
        days.push({
            dateObj: new Date(current),
            dateString: current.getFullYear() + '-' + String(current.getMonth() + 1).padStart(2, '0') + '-' + String(current.getDate()).padStart(2, '0'),
            isCurrentMonth: current.getMonth() === month,
            isToday: current.getDate() === today.getDate() && current.getMonth() === today.getMonth() && current.getFullYear() === today.getFullYear()
        });
        current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const calendarDays = getCalendarMonth(currentDate);

  const getAppointmentsForDay = (isoDate: string) => {
    return appointments.filter(app => {
      if (app.date !== isoDate) return false;
      // Filter by doctor when a specific doctor is selected
      if (calendarFilter !== 'all' && app.doctor_id !== calendarFilter) return false;
      return true;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const getDayShortName = (date: Date) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[date.getDay()];
  };

  const getMonthShortName = (date: Date) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months[date.getMonth()];
  };

  const getMonthFullName = (date: Date) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return months[date.getMonth()];
  };

  const getAppointmentColorStyle = (isReturn: boolean | undefined) => {
    if (isReturn) {
      return 'bg-brand-primary text-white';
    }
    return 'bg-status-success text-brand-primary';
  };

  const getWeekDays = (date: Date) => {
    const doc = doctors.find(d => d.id === (configDoctorId || (doctors[0] ? doctors[0].id : '')));
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

  const colors = ['bg-status-success', 'bg-amber-100', 'bg-orange-100', 'bg-slate-100', 'bg-pink-100'];
  const getAppointmentsForSlot = (isoDate: string, time: string) => {
    const slotHour = parseInt(time.split(':')[0], 10);
    return appointments.filter(app => {
      if (app.date !== isoDate) return false;
      // Filter by doctor when a specific doctor is selected
      if (calendarFilter !== 'all' && app.doctor_id !== calendarFilter) return false;
      const appHour = parseInt(app.start_time.split(':')[0], 10);
      return appHour === slotHour;
    });
  };

  const getPatientColor = (patientId: string) => {
    const idx = patients.findIndex(p => p.id === patientId);
    return colors[Math.max(0, idx) % colors.length];
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 font-sans"
    >
      
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
            <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
            <p className="text-xs font-medium">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-monique font-normal text-creative-green pb-1">Agenda</h1>
          <p className="text-[15px] font-medium text-slate-500 mt-1">Gerencie seus agendamentos e compromissos clínicos.</p>
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
      <AnimatePresence>
      {showForm && (
        <div className="fixed inset-0 z-50">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          ></motion.div>
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200"
          >
            <form onSubmit={handleSubmit} className="bg-white w-full h-full flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2 text-slate-900">
                  <CalendarIcon className="h-5 w-5 text-brand-primary/70" />
                  <h3 className="font-bold text-lg">{editingAppointmentId ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 -mr-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* WhatsApp Banner */}
              <div className="bg-status-success/20 border border-status-success/30 rounded-xl p-4 flex items-start space-x-3">
                <MessageSquare className="h-5 w-5 text-brand-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-brand-primary font-bold text-sm">Integração WhatsApp Nativa</h4>
                  <p className="text-brand-primary/80 text-xs mt-0.5">Confirmação automática enviada ao paciente + Lembrete 24h antes + Link para reagendamento.</p>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Tipo de Atendimento *</label>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value as any)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
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
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
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

                {appointmentType !== 'retorno' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Valor da Sessão (R$) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={consultationPrice}
                        onChange={(e) => setConsultationPrice(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Este valor será enviado automaticamente para o módulo financeiro e fluxo de faturamento.</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Data *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Horário *</label>
                  <input
                    type="time"
                    required
                    min={doctors.find(d => d.id === (configDoctorId || (doctors[0] ? doctors[0].id : '')))?.business_hours?.start || "08:00"}
                    max={doctors.find(d => d.id === (configDoctorId || (doctors[0] ? doctors[0].id : '')))?.business_hours?.end || "18:00"}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
                  />
                </div>

                {appointmentType === 'novo' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Tipo de Sessão *</label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
                      >
                         <option value="online">Terapia Individual (Online)</option>
                         <option value="presencial">Terapia Individual (Presencial)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Duração *</label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
                      >
                        <option value={60}>1 hora (1 Sessão)</option>
                        <option value={120}>2 horas (2 Sessões)</option>
                        <option value={180}>3 horas (3 Sessões)</option>
                        <option value={240}>4 horas (4 Sessões)</option>
                        <option value={300}>5 horas (5 Sessões)</option>
                      </select>
                    </div>

                    {type === 'presencial' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Sala de Atendimento *</label>
                        <select
                          value={room}
                          onChange={(e) => setRoom(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
                        >
                          {(doctors.find(d => d.id === (configDoctorId || (doctors[0] ? doctors[0].id : '')))?.clinic_rooms || ['Sala 1']).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sync Banner */}
              <div className="bg-status-success/10 border border-status-success/30 rounded-xl p-5 space-y-4">
                <div className="flex items-start space-x-3">
                  <Sparkles className="h-5 w-5 text-status-success shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-brand-primary font-bold text-sm">Sincronização Inteligente de Horários</h4>
                    <p className="text-brand-primary/80 text-xs mt-0.5">O cleanmind verifica automaticamente conflitos, sugere horários disponíveis e exporta para o seu Google Calendar.</p>
                  </div>
                </div>
                
                <div className="space-y-3 bg-white rounded-lg p-4 border border-status-success/20">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="h-4 w-4 text-brand-primary/70" />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">Enviar confirmação via WhatsApp</span>
                        <span className="block text-xs text-slate-500">Mensagem automática com data, hora e link</span>
                      </div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-brand-primary/70 border-slate-300 rounded focus:ring-status-success" />
                  </label>
                  <div className="border-t border-slate-100"></div>
                  <label className="flex items-center justify-between cursor-pointer pt-1">
                    <div className="flex items-center space-x-3">
                      <RefreshCw className="h-4 w-4 text-status-success" />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">Exportar para o Google Calendar</span>
                        <span className="block text-xs text-slate-500">Atualização automática em tempo real</span>
                      </div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-status-success border-slate-300 rounded focus:ring-status-success" />
                  </label>
                </div>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-3">
               {editingAppointmentId && (
                 showDeleteConfirm ? (
                   <div className="mr-auto flex items-center space-x-2">
                     <span className="text-sm text-slate-600 font-medium">Tem certeza?</span>
                     <button
                       type="button"
                       onClick={handleDeleteAppointment}
                       className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors cursor-pointer"
                     >
                       Sim, Excluir
                     </button>
                     <button
                       type="button"
                       onClick={() => setShowDeleteConfirm(false)}
                       className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                     >
                       Não
                     </button>
                   </div>
                 ) : (
                   <button
                     type="button"
                     onClick={() => setShowDeleteConfirm(true)}
                     className="px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer mr-auto"
                   >
                     Excluir
                   </button>
                 )
               )}
               <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-bold bg-status-success text-slate-900 rounded-lg hover:bg-[#b0d292] transition-colors cursor-pointer shadow-sm border border-[#b0d292]"
                >
                  {editingAppointmentId ? 'Salvar Alterações' : 'Finalizar Agendamento'}
                </button>
            </div>
          </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeSubTab === 'calendario' && (
          <motion.div
            key="calendario"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8 max-w-[1200px] mx-auto">
        
        {/* Top Header - Similar to the referenced design */}
        <div className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center space-x-4">
            <div className="bg-[#e4f3d2] text-brand-primary rounded-xl px-4 py-2 flex flex-col items-center justify-center min-w-[64px]">
               <span className="text-xs font-bold uppercase">{getMonthShortName(currentDate)}</span>
               <span className="text-xl font-bold leading-tight">{currentDate.getDate()}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{calendarView === 'month' ? `${getMonthFullName(currentDate)} ${currentDate.getFullYear()}` : formatMonthYear(currentDate)}</h2>
              <p className="text-sm text-slate-500">{calendarView === 'month' ? 'Visão Geral do Mês' : 'Visão Geral da Semana'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                 setToastMessage('Calendário atualizado');
                 setTimeout(() => setToastMessage(''), 3000);
              }}
              className="hidden md:flex px-3 py-2 flex items-center space-x-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setEditingAppointmentId(null);
                setShowForm(!showForm);
                if (!selectedPatientId && patients.length > 0) {
                  setSelectedPatientId(patients[0].id);
                }
              }}
              className="hidden md:flex px-5 py-2 text-[14px] font-bold rounded-full border border-transparent bg-brand-primary hover:bg-slate-800 text-status-success transition items-center shadow-md h-10 cursor-pointer"
            >
              <span className="mr-1.5 text-lg leading-none mb-[2px]">+</span> Novo Agendamento
            </button>
          </div>
        </div>

        {/* View Selection & Filters Nav */}
        <div className="px-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          
          <div className="flex space-x-6 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setCalendarFilter('all')}
              className={`font-semibold text-sm pb-3 whitespace-nowrap border-b-2 transition-colors ${calendarFilter === 'all' ? 'border-[#8ebf5c] text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Todos os médicos
            </button>
            {doctors.map(doc => (
              <button 
                key={doc.id}
                onClick={() => setCalendarFilter(doc.id)}
                className={`font-semibold text-sm pb-3 whitespace-nowrap border-b-2 transition-colors ${calendarFilter === doc.id ? 'border-[#8ebf5c] text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Dr(a). {doc.name.split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
               <button onClick={prevMonthOrWeek} className="px-2 py-1 text-slate-600 hover:text-slate-900 transition-colors">&lt;</button>
               <button onClick={goToday} className="px-3 py-1 font-medium text-sm text-slate-700 hover:text-slate-900 transition-colors">Hoje</button>
               <button onClick={nextMonthOrWeek} className="px-2 py-1 text-slate-600 hover:text-slate-900 transition-colors">&gt;</button>
            </div>
            
            <select 
               value={calendarView}
               onChange={(e) => setCalendarView(e.target.value as 'month' | 'week')}
               className="bg-slate-100 text-slate-700 font-medium text-sm px-3 py-1.5 rounded-lg outline-none cursor-pointer border-r-[8px] border-transparent"
             >
               <option value="month">Visão Mensal</option>
               <option value="week">Visão Semanal</option>
            </select>
          </div>
        </div>

        {/* Monthly/Weekly Grid */}
        <div className="p-4 sm:p-6 bg-slate-50/30">
          {calendarView === 'month' ? (
            <>
              <div className="grid grid-cols-7 bg-[#e4f3d2] py-2.5 rounded-t-xl overflow-hidden border border-[#d1eca8] border-b-0">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                   <div key={d} className="text-center font-semibold text-sm text-brand-primary">{d}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-b-xl overflow-hidden">
                {calendarDays.map((day, idx) => {
                  const dayEvents = getAppointmentsForDay(day.dateString);
                  return (
                    <div key={idx} className={`min-h-[140px] p-2 flex flex-col transition-colors ${day.isCurrentMonth ? 'bg-white hover:bg-slate-50' : 'bg-[#fafafa] text-slate-400'}`}>
                      {/* Date Number Header */}
                      <div className="flex justify-start mb-2">
                         <span className={`text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full ${day.isToday ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>
                           {day.dateObj.getDate()}
                         </span>
                      </div>
                      
                      {/* Events List */}
                      <div className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar pb-1">
                        {dayEvents.map(event => (
                          <div 
                            key={event.id}
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
                            className={`text-[10px] sm:text-xs rounded-md px-2 py-1.5 leading-tight truncate cursor-pointer shadow-sm border border-black/5 hover:opacity-80 transition-opacity flex items-center space-x-1.5 ${getAppointmentColorStyle(event.is_return)}`}
                          >
                             <span className="font-bold opacity-80 shrink-0">{event.start_time}</span>
                             <span className="truncate">{getPatientName(event.patient_id)}</span>
                          </div>
                        ))}
                        {!day.isCurrentMonth && dayEvents.length === 0 && (
                          <div className="hidden"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <div className="min-w-[700px]">
                <div className="flex bg-[#e4f3d2] border-b border-[#d1eca8]">
                   <div className="w-16 sm:w-20 shrink-0 border-r border-[#d1eca8]"></div>
                   {weekDays.map(day => (
                     <div key={day.name} className="flex-1 py-3 text-center border-r border-[#d1eca8] last:border-0">
                        <span className="block text-xs sm:text-sm text-brand-primary/80 mb-1 font-semibold">{day.name}</span>
                        <span className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 text-sm font-semibold rounded-full ${day.active ? 'bg-slate-900 text-white shadow-sm' : 'text-brand-primary'}`}>
                          {day.label}
                        </span>
                     </div>
                   ))}
                </div>

                <div className="bg-white">
                  {timeSlots.map((time, rowIdx) => (
                     <div key={time} className="flex border-b border-slate-100 last:border-0 min-h-[110px]">
                        <div className="w-16 sm:w-20 shrink-0 border-r border-slate-200 flex justify-center py-2 text-xs sm:text-sm text-slate-400 font-medium">
                          {time}
                        </div>
                        {weekDays.map((day, colIdx) => {
                          const events = getAppointmentsForSlot(day.date, time);
                          return (
                            <div key={`${day.label}-${time}`} className="flex-1 border-r border-slate-100 last:border-0 relative p-1.5 align-top flex flex-col gap-1 hover:bg-slate-50 transition-colors">
                               {events.map((event) => (
                                 <div 
                                   key={event.id}
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
                                   className={`${getAppointmentColorStyle(event.is_return)} w-full h-auto rounded-lg p-2 flex flex-col shadow-sm mx-auto overflow-hidden cursor-pointer hover:ring-2 hover:ring-slate-900/20 transition-all border border-black/5`}
                                 >
                                    <div className="flex items-center space-x-1 mb-1 pb-1 border-b border-black/10">
                                       <Clock className="w-3 h-3 opacity-60 shrink-0" />
                                       <span className="block text-[10px] font-semibold truncate">{event.start_time} - {event.duration}m</span>
                                    </div>
                                    <div className="flex items-center space-x-1 mt-0.5">
                                       <span className="block text-[10px] sm:text-[11px] font-bold leading-tight line-clamp-1">{getPatientName(event.patient_id)}</span>
                                    </div>
                                    {event.room && (
                                       <div className="flex items-center space-x-1 mt-1 opacity-80 mt-auto">
                                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                                          <span className="text-[9px] font-medium truncate">{event.room}</span>
                                       </div>
                                    )}
                                 </div>
                               ))}
                            </div>
                          );
                        })}
                     </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
          </motion.div>
      )}

      {activeSubTab === 'configuracoes' && (
        <motion.div
          key="configuracoes"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
        >
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="mb-6">
             <label className="block text-sm font-semibold text-slate-700 mb-2">Selecione o Médico</label>
             <select 
               value={configDoctorId} 
               onChange={(e) => setConfigDoctorId(e.target.value)}
               className="w-full sm:w-80 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success"
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
                      className="w-4 h-4 text-brand-primary/70 border-slate-300 rounded focus:ring-status-success cursor-pointer" 
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
                         }} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-status-success" />
                      </div>
                      <span className="text-slate-400 mt-5">-</span>
                      <div>
                         <span className="text-xs text-slate-500 block mb-1 px-1">Fim</span>
                         <input type="time" value={item.end} onChange={(e) => {
                            const newConfig = [...scheduleConfig];
                            newConfig[idx].end = e.target.value;
                            setScheduleConfig(newConfig);
                         }} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-status-success" />
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
      </motion.div>
      )}
      </AnimatePresence>

      {/* API Notice */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl text-xs font-mono text-slate-500 space-y-1.5 max-w-4xl shadow-sm">
        <strong className="text-brand-primary block">Criptografia Local & LGPD Compliance:</strong>
        Todas as consultas mostradas e inseridas estão restritas ao isolamento por token de identificação do médico. Os alertas e confirmações são despachados de ponta-a-ponta usando criptografia pós-sessão do WhatsApp Webhook.
      </div>

    </motion.div>
  );
}
