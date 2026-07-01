import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Clock, Plus, Receipt, Landmark, Sparkles, Check, CheckCircle2, ChevronRight, BarChart3, Search, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Billing as BillingType, Patient, dataManager } from '../data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

import { useStore } from '../store';
import Expenses from './Expenses';

interface BillingProps {
  initialDraft?: { patientId: string; amount: string; dueDate: string } | null;
  onClearDraft?: () => void;
}

export default function Billing({ initialDraft, onClearDraft }: BillingProps) {
  const patientsStore = useStore(state => state.patients); const patients = useMemo(() => patientsStore.filter(Boolean), [patientsStore]);
  const billingStore = useStore(state => state.billing); const billingList = useMemo(() => billingStore.filter(b => b && b.due_date), [billingStore]);
  
  // New billing form states
  const [showForm, setShowForm] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [amount, setAmount] = useState('350.00');
  const [dueDate, setDueDate] = useState('2026-06-15');
  const [method, setMethod] = useState<'pix' | 'cartao' | 'dinheiro'>('pix');
  const [autoEmitNfe, setAutoEmitNfe] = useState(true);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [activeTab, setActiveTab] = useState<'receitas' | 'despesas'>('receitas');

  // Chart Data calculation (Last 6 Months)
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const yearMonth = d.toISOString().substring(0, 7);
    
    const monthBills = billingList.filter(b => b.due_date.substring(0, 7) === yearMonth);
    const paid = monthBills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0);
    const pending = monthBills.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amount, 0);
    
    if (paid > 0 || pending > 0) {
      chartData.push({
        name: d.toLocaleDateString('pt-BR', { month: 'short' }).charAt(0).toUpperCase() + d.toLocaleDateString('pt-BR', { month: 'short' }).slice(1),
        Recebido: paid,
        Pendente: pending,
      });
    }
  }

  // Handle draft
  useEffect(() => {
    if (initialDraft) {
      setSelectedPatientId(initialDraft.patientId);
      setAmount(initialDraft.amount);
      setDueDate(initialDraft.dueDate);
      setShowForm(true);
    }
  }, [initialDraft]);

  useEffect(() => {
    if (!initialDraft && selectedPatientId === '' && patients.length > 0) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !amount || !dueDate) return;

    // Save Billing to state
    const newBill = dataManager.addBilling({
      patient_id: selectedPatientId,
      amount: parseFloat(amount),
      due_date: dueDate,
      status: 'pending',
      payment_method: method,
      auto_emit_nfe: autoEmitNfe
    });

    setShowForm(false);
    if (onClearDraft) onClearDraft();

    setToastMessage('Fatura criada. Aguardando pagamento.');

    setTimeout(() => {
      setToastMessage('');
    }, 6000);
  };

  const handleSimulatePayment = (billId: string) => {
    const list = billingStore;
    const index = list.findIndex(b => b.id === billId);
    if (index !== -1) {
      const updates: Partial<any> = { status: 'paid' };
      
      if (list[index].auto_emit_nfe) {
        updates.nfe_status = 'issued';
      }
      
      dataManager.updateBilling(billId, updates);

      setToastMessage('Pagamento confirmado');
      setTimeout(() => {
        setToastMessage('');
      }, 7000);
    }
  };

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || 'Paciente';
  };

  // General billing statistics
  const totalInvoiced = billingList.reduce((acc, b) => acc + b.amount, 0);
  const totalPaid = billingList.filter(b => b.status === 'paid').reduce((acc, b) => acc + b.amount, 0);
  const totalPending = billingList.filter(b => b.status === 'pending').reduce((acc, b) => acc + b.amount, 0);

  // Filter
  const filteredBillingList = billingList.filter(bill => {
    const patientName = getPatientName(bill.patient_id).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = patientName.includes(searchLower) || bill.id.includes(searchLower);
    
    if (statusFilter !== 'all' && bill.status !== statusFilter) return false;
    
    return matchesSearch;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 font-sans"
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
            <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
            <p className="text-xs font-medium">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-monique font-normal text-creative-green pb-1">Financeiro</h1>
          <p className="text-[15px] font-medium text-slate-500 mt-1 max-w-lg">
            Gestão de receitas, faturamento automatizado e controle de despesas.
          </p>
        </div>
        {activeTab === 'receitas' && (
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setShowForm(!showForm);
                if (!selectedPatientId && patients.length > 0) {
                  setSelectedPatientId(patients[0].id);
                }
              }}
              className="px-5 py-2 text-[14px] font-bold rounded-full border border-transparent bg-brand-primary hover:bg-slate-800 text-status-success transition flex items-center shadow-md h-10 cursor-pointer"
            >
              <span className="mr-1.5 text-lg leading-none mb-[2px]">+</span> Gerar Nova Fatura
            </button>
          </div>
        )}
      </div>

      <div className="flex space-x-2 border-b border-slate-200 mb-8">
        <button
          onClick={() => setActiveTab('receitas')}
          className={`pb-3 px-4 text-sm font-semibold transition-colors relative ${activeTab === 'receitas' ? 'text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Receitas
          {activeTab === 'receitas' && (
            <motion.div layoutId="finance-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-t" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('despesas')}
          className={`pb-3 px-4 text-sm font-semibold transition-colors relative ${activeTab === 'despesas' ? 'text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Despesas
          {activeTab === 'despesas' && (
            <motion.div layoutId="finance-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-t" />
          )}
        </button>
      </div>

      {activeTab === 'receitas' ? (
        <>
          {/* KPIs & Chart Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* KPI stats */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex-1">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wide block font-semibold flex items-center space-x-2">
              <Landmark className="h-4 w-4 text-brand-primary" />
              <span>Receita Recebida</span>
            </span>
            <span className="text-3xl font-sans text-brand-primary font-bold block pt-2">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex-1">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wide block font-semibold flex items-center space-x-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>Saldo Pendente</span>
            </span>
            <span className="text-3xl font-sans text-brand-primary font-bold block pt-2">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2 text-slate-800 font-bold">
              <BarChart3 className="h-5 w-5 text-status-success" />
              <span>Fluxo de Caixa (Últimos Meses)</span>
            </div>
            <div className="flex items-center space-x-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-brand-primary mr-1.5"></div> Recebido</div>
              <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-amber-400 mr-1.5"></div> Pendente</div>
            </div>
          </div>
          <div className="h-48 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={2} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'Inter, sans-serif' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'Inter, sans-serif' }} tickFormatter={(val) => `R$${val/1000}k`} />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 min-w-[150px]">
                            <p className="font-bold text-slate-800 border-b border-slate-100 pb-2 mb-2">{label}</p>
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex justify-between text-sm py-1">
                                <div className="flex items-center">
                                  <div className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: entry.color }}></div>
                                  <span className="text-slate-600 font-medium">{entry.name}</span>
                                </div>
                                <span className="font-bold text-slate-900 ml-4">R$ {entry.value.toLocaleString('pt-BR')}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="Recebido" fill="#192F28" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pendente" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">
                Sem dados de faturamento para exibir
              </div>
            )}
          </div>
        </div>

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
                  <DollarSign className="h-5 w-5 text-brand-primary/70" />
                  <h3 className="font-bold text-lg">Registrar Nova Cobrança de Paciente</h3>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Selecionar Paciente *</label>
                  <select
                    required
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
                  >
                    {patients.length === 0 ? (
                      <option value="">Carregue pacientes primeiro...</option>
                    ) : (
                      patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Valor da Sessão (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-status-success focus:border-status-success text-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Método de Lançamento</label>
                  <div className="flex gap-4 pt-1.5 flex-wrap">
                    <label className="flex items-center space-x-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="method"
                        checked={method === 'pix'}
                        onChange={() => setMethod('pix')}
                        className="accent-brand-primary w-4 h-4"
                      />
                      <span>Pix QrCode Automatizado</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="method"
                        checked={method === 'cartao'}
                        onChange={() => setMethod('cartao')}
                        className="accent-brand-primary w-4 h-4"
                      />
                      <span>Cartão de Crédito Online</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="method"
                        checked={method === 'dinheiro'}
                        onChange={() => setMethod('dinheiro')}
                        className="accent-brand-primary w-4 h-4"
                      />
                      <span>Dinheiro (Físico)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5 space-y-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoEmitNfe}
                    onChange={(e) => setAutoEmitNfe(e.target.checked)}
                    className="mt-1 accent-brand-primary w-4 h-4 rounded border-slate-300"
                  />
                  <div className="-mt-0.5">
                    <span className="block text-sm font-bold text-slate-700">Emitir NFS-e automaticamente após pagamento</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Sincroniza e emite nota fiscal mercantil na prefeitura local assim que o banco detectar a compensação.</span>
                  </div>
                </label>
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
                className="px-6 py-2.5 text-sm font-bold bg-status-success text-slate-900 rounded-lg hover:bg-[#b0d292] transition-colors cursor-pointer shadow-sm border border-[#b0d292] flex items-center space-x-2"
              >
                <Check className="h-4 w-4" />
                <span>Gerar Cobrança</span>
              </button>
            </div>
          </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Invoice Table History */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-sans text-brand-primary font-bold text-base">Histórico de Transações e Liquidação</h3>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar paciente ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-status-success bg-white text-slate-900"
              />
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Todas
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${statusFilter === 'paid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Pagas
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${statusFilter === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Pendentes
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[750px]">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Paciente</th>
                <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Valor</th>
                <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Vencimento</th>
                <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Status Canal</th>
                <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Nota Fiscal (NFS-e)</th>
                <th className="py-4 px-6 text-sm font-semibold text-slate-500 text-center border-b border-slate-200">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBillingList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-12">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Receipt className="w-12 h-12 mb-4 text-slate-200" />
                      <p className="text-sm font-semibold text-slate-500">Nenhuma transação encontrada</p>
                      <p className="text-xs mt-1">Nenhum registro corresponde aos filtros atuais.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBillingList.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900 text-sm whitespace-nowrap leading-tight group-hover:text-brand-primary/70 transition-colors">{getPatientName(bill.patient_id)}</div>
                      <div className="text-xs text-slate-500 mt-1">Ref: {bill.id} {bill.payment_method ? `| Pagamento via: ${bill.payment_method}` : ''}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-700 text-sm whitespace-nowrap">
                        R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-slate-600 whitespace-nowrap">
                        {new Date(bill.due_date).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${bill.status === 'paid' ? 'bg-emerald-50 text-brand-primary' : 'bg-rose-50 text-rose-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${bill.status === 'paid' ? 'bg-status-success' : 'bg-rose-500 animate-pulse'}`}></span>
                        {bill.status === 'paid' ? 'Liquidado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${bill.nfe_status === 'issued' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/15' : bill.nfe_status === 'processing' ? 'bg-brand-cream text-brand-primary' : 'bg-slate-100 text-slate-500'}`}>
                        <Receipt className="h-3.5 w-3.5" />
                        <span>
                          {bill.nfe_status === 'issued' ? 'Nota Emitida' : bill.nfe_status === 'processing' ? 'Em Processamento' : 'Não Emitida'}
                        </span>
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex justify-center">
                        {bill.status === 'pending' ? (
                          <button
                            onClick={() => handleSimulatePayment(bill.id)}
                            className="bg-brand-primary text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-opacity-90 transition-all cursor-pointer shadow-sm whitespace-nowrap"
                          >
                            Simular Pix (Compensar)
                          </button>
                        ) : (
                          <div className="text-xs text-brand-primary font-bold flex items-center space-x-1.5 whitespace-nowrap">
                            <CheckCircle2 className="h-4 w-4 text-brand-primary" />
                            <span>Conciliado</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
          </>
      ) : (
        <Expenses />
      )}

    </motion.div>
  );
}
