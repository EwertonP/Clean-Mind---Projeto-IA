import { useState, useEffect } from 'react';
import { AlertCircle, Calendar, DollarSign, Users, ArrowRight, TrendingUp, TrendingDown, Clock, Laptop, Activity } from 'lucide-react';
import { Appointment, Patient, Billing, DiaryEntry, dataManager } from '../data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  onNavigate: (tab: string, param?: string) => void;
  triggerRefresh: number;
}

export default function Dashboard({ onNavigate, triggerRefresh }: DashboardProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [billing, setBilling] = useState<Billing[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  
  // Load state values
  useEffect(() => {
    setPatients(dataManager.getPatients());
    setAppointments(dataManager.getAppointments());
    setBilling(dataManager.getBilling());
    setDiaryEntries(dataManager.getDiaryEntries());
  }, [triggerRefresh]);

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
    const monthlyBills = billing.filter(b => b.status === 'paid' && b.due_date.startsWith(formattedMonth));
    const totalRev = monthlyBills.reduce((acc, bill) => acc + bill.amount, 0);
    revenueData.push({ name: mName, value: totalRev, color: totalRev > 0 ? '#C1E2A4' : '#e2e8f0' });

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
    <div className="space-y-6 font-sans pb-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-slate-200 pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Central</h1>
          <p className="text-sm text-slate-500 mt-1">Resumo das suas métricas e atendimentos de hoje.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center shadow-sm">
            <span className="hidden sm:inline mr-2">Filtro Rápido:</span> Mensal
            <TrendingDown className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pacientes Ativos</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{activePatientsCount}</div>
            <div className="flex items-center text-xs font-medium">
              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center mr-2">
                <TrendingUp className="w-3 h-3 mr-1" /> +12%
              </span>
              <span className="text-slate-400">vs. mês passado</span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sessões Hoje</span>
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{appointmentsToday.length}</div>
            <div className="flex items-center text-xs font-medium">
              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center mr-2">
                <TrendingUp className="w-3 h-3 mr-1" /> +2
              </span>
              <span className="text-slate-400">vs. ontem</span>
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturamento (Mês)</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 mb-1 leading-none tracking-tight">
              <span className="text-lg opacity-50 font-medium mr-1 tracking-normal">R$</span>
              {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center text-xs font-medium mt-1">
              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center mr-2">
                <TrendingUp className="w-3 h-3 mr-1" /> +5%
              </span>
              <span className="text-slate-400">vs. mês passado</span>
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">A Receber</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 mb-1 leading-none tracking-tight">
              <span className="text-lg opacity-50 font-medium mr-1 tracking-normal">R$</span>
              {pendingRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center text-xs font-medium mt-1">
               <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded flex items-center mr-2">
                <TrendingDown className="w-3 h-3 mr-1" /> -2%
              </span>
              <span className="text-slate-400">vs. mês passado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Evolução de Receita</h2>
                <p className="text-sm text-slate-500">Fluxo de caixa dos últimos 6 meses</p>
              </div>
            </div>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `R$${val/1000}k`} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Receita Realizada']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={40}>
                    {revenueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {revenueData.every(r => r.value === 0) && (
                <div className="text-center text-slate-400 text-sm mt-4">Nenhuma receita registrada neste período. Adicione registros no Módulo Financeiro.</div>
              )}
            </div>
          </div>

          {/* Sessions Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sessões Realizadas / Marcadas</h2>
                <p className="text-sm text-slate-500">Histórico de agendamentos por modalidade</p>
              </div>
            </div>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="Online" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={40} />
                  <Bar dataKey="Presencial" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
              {sessionsData.every(s => s.Online === 0 && s.Presencial === 0) && (
                <div className="text-center text-slate-400 text-sm mt-4">Nenhuma sessão registrada. Adicione pacientes na Agenda.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Alerts First, then Breakdown */}
        <div className="space-y-6">
          {/* Central de Alertas Summary */}
          <div className={`p-6 rounded-2xl border shadow-sm ${crisisAlerts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
             <div className="flex items-center space-x-3 mb-3">
               <div className={`w-10 h-10 rounded-full flex items-center justify-center ${crisisAlerts.length > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                 <AlertCircle className="w-5 h-5" />
               </div>
               <div>
                  <h3 className={`font-bold ${crisisAlerts.length > 0 ? 'text-red-900' : 'text-emerald-900'}`}>Alertas Clínicos</h3>
                  <p className={`text-sm ${crisisAlerts.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
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
                <div className="text-xs text-emerald-600 mt-2 font-medium">Todos os pacientes estão estáveis.</div>
             )}
          </div>

          {/* Active Customers Summary / Modalities */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900">Modalidade de Sessões</h2>
            <p className="text-sm text-slate-500 mb-6">Comparativo das {totalMonthApps} sessões este mês</p>

            <div className="space-y-6">
              {/* Desktop / Online */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center">
                    <Laptop className="w-4 h-4 text-emerald-500 mr-2" />
                    <span className="text-sm font-semibold text-slate-700">Online</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900 mr-2">{onlinePercentage}%</span>
                    <span className="text-xs text-slate-500 font-medium">({currentOnlineCount})</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${onlinePercentage}%` }}></div>
                </div>
              </div>

              {/* Presencial */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 text-orange-500 mr-2" />
                    <span className="text-sm font-semibold text-slate-700">Presencial</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900 mr-2">{presencialPercentage}%</span>
                    <span className="text-xs text-slate-500 font-medium">({currentPresencialCount})</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${presencialPercentage}%` }}></div>
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${app.type === 'online' ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
                      {app.type === 'online' ? 'Online' : 'Presencial'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-md ${
                        app.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
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
    </div>
  );
}

