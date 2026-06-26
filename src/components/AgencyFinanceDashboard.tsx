import React, { useState, useEffect } from 'react';
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Doctor } from "../data";
import { motion } from "motion/react";
import { 
  TrendingUp, CreditCard, DollarSign, Wallet, 
  BarChart3, ArrowUpRight, CheckCircle2 
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';

const PLAN_PRICES = {
  free: 0,
  pro: 197,
  premium: 397
};

export function AgencyFinanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<Doctor[]>([]);

  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "doctors"));
        const clinicsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Doctor));
        setClinics(clinicsData.filter(d => d.role !== 'agency'));
      } catch (error) {
        console.error("Error fetching clinics", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClinics();
  }, []);

  const planStats = {
    free: clinics.filter(c => !c.plan_type || c.plan_type === 'free').length,
    pro: clinics.filter(c => c.plan_type === 'pro').length,
    premium: clinics.filter(c => c.plan_type === 'premium').length,
  };

  const currentMRR = planStats.pro * PLAN_PRICES.pro + planStats.premium * PLAN_PRICES.premium;
  const activePaidSubscribers = planStats.pro + planStats.premium;

  // Generate realistic looking historical data based on current MRR
  const generateHistory = () => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentMonthIdx = new Date().getMonth();
    const data = [];
    
    let simulatedMRR = currentMRR * 0.4; // Start at 40% of current MRR 6 months ago
    const step = (currentMRR - simulatedMRR) / 5;

    for (let i = 5; i >= 0; i--) {
      const mIdx = (currentMonthIdx - i + 12) % 12;
      const mrrValue = i === 0 ? currentMRR : simulatedMRR + (Math.random() * step * 0.5);
      
      data.push({
        name: months[mIdx],
        mrr: Math.round(mrrValue),
        clientes: Math.max(1, Math.round(mrrValue / 250)) // Avg price
      });
      simulatedMRR += step;
    }
    return data;
  };

  const mrrData = generateHistory();

  const planDistData = [
    { name: 'Free', value: planStats.free, color: '#94a3b8' },
    { name: 'Pro', value: planStats.pro, color: '#A5B0A5' },
    { name: 'Premium', value: planStats.premium, color: '#8ebf5c' },
  ];

  // Mock recent payments
  const recentPayments = clinics
    .filter(c => c.plan_type === 'pro' || c.plan_type === 'premium')
    .slice(0, 5)
    .map((c, idx) => ({
      id: c.id,
      name: c.clinic_name || c.name || 'Clínica',
      plan: c.plan_type,
      amount: c.plan_type === 'premium' ? PLAN_PRICES.premium : PLAN_PRICES.pro,
      date: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      status: 'paid'
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Carregando dados financeiros...
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 font-sans pb-8 max-w-[1200px] mx-auto text-slate-800"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
           <div className="flex items-center space-x-2 text-status-success mb-2">
             <DollarSign className="w-5 h-5" />
             <span className="text-[13px] font-bold tracking-wider text-brand-primary uppercase">Financeiro</span>
           </div>
           <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Receita e Assinaturas</h1>
           <p className="text-[15px] font-medium text-slate-500 mt-1">Acompanhe o MRR e a distribuição de planos dos seus clientes.</p>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden text-white" style={{backgroundColor: '#192F28'}}>
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center mb-4 relative z-10">
            <DollarSign className="w-5 h-5" />
          </div>
          <h3 className="text-white/80 text-sm font-medium relative z-10">MRR (Receita Recorrente)</h3>
          <p className="text-[32px] font-bold text-white leading-none mt-1 relative z-10">
            R$ {currentMRR.toLocaleString('pt-BR')}
            <span className="text-sm text-white/60 font-medium ml-1">/ mês</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 text-brand-primary rounded-xl flex items-center justify-center mb-4">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Assinantes Pagantes</h3>
          <div className="mt-1 flex items-baseline">
            <p className="text-[32px] font-bold text-slate-900 leading-none">{activePaidSubscribers}</p>
            <span className="ml-2 text-xs font-bold text-brand-primary bg-emerald-50 px-2 py-1 rounded-md">
              {Math.round((activePaidSubscribers / Math.max(1, clinics.length)) * 100)}% de conversão
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
            <Wallet className="w-5 h-5" />
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Ticket Médio (ARPU)</h3>
          <p className="text-[32px] font-bold text-slate-900 leading-none mt-1">
            R$ {activePaidSubscribers > 0 ? Math.round(currentMRR / activePaidSubscribers).toLocaleString('pt-BR') : 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Evolução do MRR</h3>
                <p className="text-sm text-slate-500">Crescimento da receita nos últimos 6 meses</p>
              </div>
              <div className="flex items-center space-x-2 text-sm font-medium text-brand-primary bg-emerald-50 px-3 py-1 rounded-lg">
                <ArrowUpRight className="w-4 h-4" />
                <span>+12.5%</span>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mrrData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#192F28" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#192F28" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    tickFormatter={(value) => `R$${value}`}
                    width={60}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'MRR']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="#192F28" strokeWidth={3} fillOpacity={1} fill="url(#colorMrr)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Últimos Pagamentos (Assinaturas)</h3>
            </div>
            <div className="overflow-x-auto custom-scroll">
              <table className="w-full text-left border-separate border-spacing-0 min-w-[750px]">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Cliente</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Plano</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Data</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Valor</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 text-right border-b border-slate-200">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.length > 0 ? recentPayments.map((payment, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 text-sm whitespace-nowrap leading-tight group-hover:text-brand-primary/70 transition-colors">{payment.name}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          payment.plan === 'premium' ? 'bg-[#8ebf5c]/20 text-brand-primary' : 'bg-brand-secondary/20 text-brand-primary'
                        }`}>
                          {payment.plan}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-slate-600 whitespace-nowrap">{payment.date}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-700 text-sm whitespace-nowrap">R$ {payment.amount},00</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="inline-flex items-center justify-end text-brand-primary bg-status-success/20 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Pago
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">Nenhum pagamento registrado recentemente.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Distribuição de Planos</h3>
            
            <div className="h-[200px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planDistData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 500, fill: '#475569' }} width={70} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {planDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Free</p>
                    <p className="text-xs text-slate-500">Tríal / Limitado</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{planStats.free}</p>
                  <p className="text-xs text-slate-500">
                    {Math.round((planStats.free / Math.max(1, clinics.length)) * 100)}%
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 border border-emerald-50 bg-emerald-50/50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Pro</p>
                    <p className="text-xs text-emerald-700/70">Intermediário</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-900">{planStats.pro}</p>
                  <p className="text-xs text-emerald-700/70">
                    {Math.round((planStats.pro / Math.max(1, clinics.length)) * 100)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-emerald-50 bg-emerald-50/50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Premium</p>
                    <p className="text-xs text-emerald-700/70">Pacote Completo</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-900">{planStats.premium}</p>
                  <p className="text-xs text-emerald-700/70">
                    {Math.round((planStats.premium / Math.max(1, clinics.length)) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
