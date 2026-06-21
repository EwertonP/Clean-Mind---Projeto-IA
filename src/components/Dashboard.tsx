import { useState, useEffect } from 'react';
import { AlertCircle, Calendar, DollarSign, Users, ArrowRight, TrendingUp, TrendingDown, Clock, Laptop, Activity } from 'lucide-react';
import { Appointment, Patient, Billing, DiaryEntry, dataManager } from '../data';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'motion/react';
import { useStore } from '../store';

interface DashboardProps {
  onNavigate: (tab: string, param?: string, extraParam?: string | boolean | any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const isLoading = useStore(state => state.isLoading);
  const patients = useStore(state => state.patients);
  const appointments = useStore(state => state.appointments);
  const billing = useStore(state => state.billing);
  const diaryEntries = useStore(state => state.diary);
  const expenses = useStore(state => state.expenses);
  
  // Calculations for KPIs
  // Using fixed date matching the app's current context
  const todayStr = '2026-06-09';
  const appointmentsToday = appointments.filter(app => app.date === todayStr);
  const activePatientsCount = patients.filter(p => p.status === 'active').length;

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || 'Paciente';
  };

  const currentDate = new Date('2026-06-09T12:00:00');
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const monthlyRevenue = billing
    .filter(bill => bill.status === 'paid' && bill.due_date.startsWith(currentMonthStr))
    .reduce((acc, bill) => acc + bill.amount, 0);

  const pendingRevenue = billing
    .filter(bill => bill.status === 'pending' && bill.due_date.startsWith(currentMonthStr))
    .reduce((acc, bill) => acc + bill.amount, 0);

  const crisisAlerts = diaryEntries.filter(entry => entry.crisis_flag);

  // Dynamic Chart Data (Last 6 Months)
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const revenueData = [];
  const sessionsData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const mName = monthNames[d.getMonth()];
    const mYear = d.getFullYear();
    const formattedMonth = `${mYear}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    // Revenue
    const monthlyBillsPaid = billing.filter(b => b.status === 'paid' && b.due_date.startsWith(formattedMonth));
    const totalRev = monthlyBillsPaid.reduce((acc, bill) => acc + bill.amount, 0);

    const monthlyBillsPending = billing.filter(b => b.status === 'pending' && b.due_date.startsWith(formattedMonth));
    const totalPending = monthlyBillsPending.reduce((acc, bill) => acc + bill.amount, 0);

    const monthlyExp = expenses.filter(e => e.date.startsWith(formattedMonth));
    const totalExp = monthlyExp.reduce((acc, exp) => acc + exp.amount, 0);
    
    revenueData.push({ 
      name: mName, 
      "A receber": totalPending,
      Receita: totalRev,
      Despesas: totalExp
    });

    // Sessions (for the bar chart requested)
    const monthlyApps = appointments.filter(a => a.date.startsWith(formattedMonth));
    const onlineApps = monthlyApps.filter(a => a.type === 'online').length;
    const presencialApps = monthlyApps.filter(a => a.type === 'presencial').length;
    sessionsData.push({ 
      name: mName, 
      Online: onlineApps,
      Presencial: presencialApps
    });
  }

  // Modality statistics for current month
  const currentMonthApps = appointments.filter(a => a.date.startsWith(currentMonthStr));
  let currentOnlineCount = 0;
  let currentPresencialCount = 0;
  currentMonthApps.forEach(a => {
    if (a.type === 'online') currentOnlineCount++;
    if (a.type === 'presencial') currentPresencialCount++;
  });
  
  const totalMonthApps = currentMonthApps.length;
  const onlinePercentage = totalMonthApps > 0 ? Math.round((currentOnlineCount / totalMonthApps) * 100) : 0;
  const presencialPercentage = totalMonthApps > 0 ? Math.round((currentPresencialCount / totalMonthApps) * 100) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 font-sans pb-8 max-w-[1200px] mx-auto text-slate-800"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Dashboard Central</h1>
          <p className="text-[15px] font-medium text-slate-500 mt-1">Veja um panorama geral da sua clínica.</p>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => onNavigate('agenda', undefined, 'new_appointment')}
            className="px-5 py-2 text-[14px] font-bold rounded-full border border-transparent bg-[#192F28] hover:bg-slate-800 text-[#C1E2A4] transition flex items-center shadow-md h-10"
          >
            <span className="mr-1.5 text-lg leading-none mb-[2px]">+</span> Novo Agendamento
          </button>
        </div>
      </div>

      {/* KPI Cards row similar to image */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Total Pacientes Ativos */}
        <motion.div 
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between cursor-default"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-slate-600" />
              <span className="text-[15px] font-bold text-slate-800">Total Pacientes Ativos</span>
            </div>
            <button className="text-[13px] font-bold text-[#192F28] hover:text-slate-700 flex items-center cursor-pointer" onClick={() => onNavigate('paciente')}>
              Ver Detalhes &gt;
            </button>
          </div>
          
          <div className="flex items-end justify-between mb-8">
            <div className="text-[40px] font-extrabold text-slate-900 leading-none">
              {isLoading ? (
                <div className="h-10 w-24 bg-slate-200 animate-pulse rounded-md inline-block"></div>
              ) : (
                <>{activePatientsCount} <span className="text-xl font-bold text-slate-500 tracking-tight">Pacientes</span></>
              )}
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-400 mb-1">Mês anterior <span className="text-[#192F28]/70 bg-[#C1E2A4]/20 px-1.5 py-0.5 rounded ml-1 font-bold">↗ 12.3%</span></span>
            </div>
          </div>

          <div className="flex space-x-1 w-full h-3 mb-4">
            <div className="bg-[#192F28] h-full rounded-l-full" style={{ width: '60%' }}></div>
            <div className="bg-[#C1E2A4] h-full" style={{ width: '25%' }}></div>
            <div className="bg-[#A3B1A6] h-full rounded-r-full" style={{ width: '15%' }}></div>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#192F28]"></div>
              <span>Recorrentes (60%)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#C1E2A4]"></div>
              <span>Esporádicos (25%)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#A3B1A6]"></div>
              <span>Alta Médica (15%)</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Sessões no Mês */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-slate-600" />
              <span className="text-[15px] font-bold text-slate-800">Sessões deste Mês</span>
            </div>
            <button className="text-[13px] font-bold text-[#192F28] hover:text-slate-700 flex items-center cursor-pointer" onClick={() => onNavigate('agenda')}>
              Ver Detalhes &gt;
            </button>
          </div>

          <div className="flex flex-row items-center justify-between h-full">
            <div className="relative w-[150px] h-[75px] overflow-hidden flex-shrink-0">
               {/* Simple CSS gauge simulation */}
               <div className="w-[150px] h-[150px] rounded-full border-[12px] border-slate-100 absolute top-0 left-0 border-t-[#192F28] border-l-[#192F28] border-r-[#C1E2A4] rotate-45"></div>
               <div className="absolute top-[35px] left-0 right-0 flex flex-col items-center">
                 <span className="text-[28px] font-extrabold text-slate-900 leading-none">{totalMonthApps}</span>
                 <span className="text-[11px] font-bold text-slate-400">Total Marcad.</span>
               </div>
            </div>

            <div className="flex flex-col space-y-3 font-semibold text-[13px] whitespace-nowrap ml-6 flex-grow">
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#C1E2A4]"></div>
                  <span className="text-slate-600">Sessões Concluídas</span>
                </div>
                <span className="text-slate-900">{currentMonthApps.filter(a => a.status === 'completed').length}</span>
              </div>
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#192F28]"></div>
                  <span className="text-slate-600">Sessões Agendadas</span>
                </div>
                <span className="text-slate-900">{currentMonthApps.length - currentMonthApps.filter(a => a.status === 'completed' || a.status === 'canceled').length}</span>
              </div>
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#A3B1A6]"></div>
                  <span className="text-slate-600">Sessões Canceladas</span>
                </div>
                <span className="text-slate-900">{currentMonthApps.filter(a => a.status === 'canceled').length}</span>
              </div>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Chart */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-slate-600" />
                <h2 className="text-[15px] font-bold text-slate-800">Atividade Financeira</h2>
              </div>
              <div className="flex space-x-3">
                <button className="text-[13px] font-bold text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1.5" /> Últimos 6 meses
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between mb-8">
              <div className="mb-4 md:mb-0">
                <div className="text-[28px] font-bold text-slate-900 leading-none mb-2">
                   R$ {monthlyRevenue.toLocaleString('pt-BR')}
                </div>
                <div className="text-slate-500 text-sm font-medium">Visão Geral do Saldo</div>
              </div>
              <div className="flex items-center space-x-4 text-xs font-semibold text-slate-500">
                <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-sm bg-[#C1E2A4] mr-1.5"></div> Receita</div>
                <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-sm bg-[#192F28] mr-1.5"></div> A receber</div>
                <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-sm bg-[#A3B1A6] mr-1.5"></div> Despesas</div>
              </div>
            </div>

            <div className="w-full h-[280px]">
              {isLoading ? (
                <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl"></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `R$${val/1000}k`} />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 flex flex-col space-y-2 min-w-[180px]">
                              <p className="font-bold text-black border-b border-slate-100 pb-2 mb-1">{label}</p>
                              {[...payload].reverse().map((entry: any, index: number) => (
                                <div key={index} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                    <span className="text-black font-bold capitalize">{entry.name}</span>
                                  </div>
                                  <span className="text-black font-bold ml-4">R$ {entry.value.toLocaleString('pt-BR')}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="Despesas" fill="#A3B1A6" stackId="a" />
                    <Bar dataKey="A receber" fill="#192F28" stackId="a" />
                    <Bar dataKey="Receita" fill="#C1E2A4" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Sessions Chart */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sessões Realizadas / Marcadas</h2>
                <p className="text-sm text-slate-500">Histórico de agendamentos por modalidade</p>
              </div>
            </div>
            <div className="flex-1 min-h-[250px]">
              {isLoading ? (
                <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl"></div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sessionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="Online" stackId="a" fill="#C1E2A4" radius={[0, 0, 4, 4]} barSize={40} />
                      <Bar dataKey="Presencial" stackId="a" fill="#192F28" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                  {sessionsData.every(s => s.Online === 0 && s.Presencial === 0) && (
                    <div className="text-center text-slate-400 text-sm mt-4">Nenhuma sessão registrada. Adicione pacientes na Agenda.</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Alerts First, then Breakdown */}
        <div className="space-y-6">
          {/* Central de Alertas Summary */}
          <div className={`p-6 rounded-3xl border shadow-sm ${crisisAlerts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-[#C1E2A4]/20 border-[#C1E2A4]/50'}`}>
             <div className="flex items-center space-x-3 mb-3">
               <div className={`w-10 h-10 rounded-full flex items-center justify-center ${crisisAlerts.length > 0 ? 'bg-red-100 text-red-600' : 'bg-[#C1E2A4] text-[#192F28]'}`}>
                 <AlertCircle className="w-5 h-5" />
               </div>
               <div>
                  <h3 className={`font-bold ${crisisAlerts.length > 0 ? 'text-red-900' : 'text-[#192F28]'}`}>Alertas Clínicos</h3>
                  <p className={`text-sm ${crisisAlerts.length > 0 ? 'text-red-700' : 'text-[#192F28]/80'}`}>
                    {crisisAlerts.length} casos de atenção
                  </p>
               </div>
             </div>
             {crisisAlerts.length > 0 ? (
               <button 
                 onClick={() => onNavigate('alertas')}
                 className="w-full py-2.5 mt-2 text-sm font-semibold bg-white text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition flex items-center justify-center space-x-2 shadow-sm"
               >
                 <span>Ver Detalhes</span>
                 <ArrowRight className="w-4 h-4" />
               </button>
             ) : (
                <div className="text-xs text-[#192F28] mt-2 font-medium">Todos os pacientes estão estáveis.</div>
             )}
          </div>

          {/* Active Customers Summary / Modalities */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900">Modalidade de Sessões</h2>
            <p className="text-sm text-slate-500 mb-6">Comparativo das {totalMonthApps} sessões este mês</p>

            <div className="space-y-6">
              {/* Desktop / Online */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center">
                    <Laptop className="w-4 h-4 text-[#C1E2A4] mr-2" />
                    <span className="text-sm font-semibold text-slate-700">Online</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900 mr-2">{onlinePercentage}%</span>
                    <span className="text-xs text-slate-500 font-medium">({currentOnlineCount})</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-[#C1E2A4] h-2 rounded-full" style={{ width: `${onlinePercentage}%` }}></div>
                </div>
              </div>

              {/* Presencial */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 text-[#192F28] mr-2" />
                    <span className="text-sm font-semibold text-slate-700">Presencial</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900 mr-2">{presencialPercentage}%</span>
                    <span className="text-xs text-slate-500 font-medium">({currentPresencialCount})</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-[#C1E2A4] h-2 rounded-full" style={{ width: `${presencialPercentage}%` }}></div>
                </div>
              </div>
            </div>
            {totalMonthApps === 0 && (
                <p className="text-xs text-slate-400 mt-4 text-center">Sem dados suficientes neste mês.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Table: Recent Appointments */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">Agenda Recente</h2>
          <button 
           onClick={() => onNavigate('agenda')}
           className="text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition"
          >
            Acessar Agenda Completa
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl">Sessão ID</th>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Modalidade</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.slice(0, 5).map(app => (
                <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">#{app.id.substring(0, 6)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-[#C1E2A4] flex items-center justify-center font-bold text-slate-800 text-xs">
                        {getPatientName(app.patient_id).charAt(0)}
                      </div>
                      <span className="font-medium text-slate-900">{getPatientName(app.patient_id)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-slate-700">
                      <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                      {app.date.split('-').reverse().join('/')}
                      <Clock className="w-3.5 h-3.5 ml-3 mr-1.5 text-slate-400" />
                      {app.start_time}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${app.type === 'online' ? 'bg-[#C1E2A4]' : 'bg-orange-500'}`}></span>
                      {app.type === 'online' ? 'Online' : 'Presencial'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-md ${
                        app.status === 'completed' ? 'bg-[#C1E2A4]/20 text-[#192F28] border border-[#C1E2A4]/30' :
                        app.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}>
                        {app.status === 'completed' ? 'Concluída' : app.status === 'confirmed' ? 'Confirmada' : app.status}
                      </span>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhuma sessão recente encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

