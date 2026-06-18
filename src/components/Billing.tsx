import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, Plus, Receipt, Landmark, Sparkles, Check, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Billing as BillingType, Patient, dataManager } from '../data';

interface BillingProps {
  onRefreshDashboard: () => void;
  triggerRefresh: number;
}

export default function Billing({ onRefreshDashboard, triggerRefresh }: BillingProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [billingList, setBillingList] = useState<BillingType[]>([]);
  
  // New billing form states
  const [showForm, setShowForm] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [amount, setAmount] = useState('350.00');
  const [dueDate, setDueDate] = useState('2026-06-15');
  const [method, setMethod] = useState<'pix' | 'cartao'>('pix');
  const [autoEmitNfe, setAutoEmitNfe] = useState(true);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    setPatients(dataManager.getPatients());
    setBillingList(dataManager.getBilling());
    if (selectedPatientId === '' && dataManager.getPatients().length > 0) {
      setSelectedPatientId(dataManager.getPatients()[0].id);
    }
  }, [triggerRefresh]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !amount || !dueDate) return;

    // Save Billing to state
    const newBill = dataManager.addBilling({
      patient_id: selectedPatientId,
      amount: parseFloat(amount),
      due_date: dueDate,
      status: 'pending',
      auto_emit_nfe: autoEmitNfe
    });

    // Reload list
    setBillingList(dataManager.getBilling());
    setShowForm(false);
    onRefreshDashboard();

    setToastMessage('Fatura criada');

    setTimeout(() => {
      setToastMessage('');
    }, 6000);
  };

  const handleSimulatePayment = (billId: string) => {
    const list = dataManager.getBilling();
    const index = list.findIndex(b => b.id === billId);
    if (index !== -1) {
      const bill = list[index];
      bill.status = 'paid';
      
      if (bill.auto_emit_nfe) {
        bill.nfe_status = 'issued';
      }
      
      list[index] = bill;
      dataManager.saveBilling(list);
      setBillingList(list);
      onRefreshDashboard();

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

  return (
    <div className="space-y-8 font-sans">
      
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

      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 border-b border-slate-200 pb-5 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cobranças</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-lg">
            Faturamento automatizado, conciliação Pix síncrona e emissão automatizada de notas fiscais de serviço (NFS-e).
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (!selectedPatientId && patients.length > 0) {
              setSelectedPatientId(patients[0].id);
            }
          }}
          className="w-full md:w-auto bg-[#C1E2A4] text-slate-900 text-sm border border-[#b0d292] font-semibold px-6 py-2.5 rounded-lg hover:bg-[#b0d292] transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Gerar Nova Fatura</span>
        </button>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wide block font-semibold">Faturamento Bruto</span>
          <span className="text-2xl font-serif text-[#192F28] font-bold block pt-1">R$ {totalInvoiced.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wide block font-semibold">Total Recebido</span>
          <span className="text-2xl font-serif text-emerald-650 font-bold block pt-1">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wide block font-semibold">Saldo Pendente</span>
          <span className="text-2xl font-serif text-[#192F28] font-bold block pt-1">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Modal / Overlay Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-screen">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                <h3 className="font-bold text-lg">Registrar Nova Cobrança de Paciente</h3>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Selecionar Paciente *</label>
                  <select
                    required
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
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
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] focus:border-[#C1E2A4] text-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Método de Lançamento</label>
                  <div className="flex gap-4 pt-1.5">
                    <label className="flex items-center space-x-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="method"
                        checked={method === 'pix'}
                        onChange={() => setMethod('pix')}
                        className="accent-[#192F28] w-4 h-4"
                      />
                      <span>Pix QrCode Automatizado</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="method"
                        checked={method === 'cartao'}
                        onChange={() => setMethod('cartao')}
                        className="accent-[#192F28] w-4 h-4"
                      />
                      <span>Cartão de Crédito Online</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 space-y-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoEmitNfe}
                    onChange={(e) => setAutoEmitNfe(e.target.checked)}
                    className="mt-1 accent-emerald-500 w-4 h-4 rounded border-slate-300"
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
                className="px-6 py-2.5 text-sm font-bold bg-[#C1E2A4] text-slate-900 rounded-lg hover:bg-[#b0d292] transition-colors cursor-pointer shadow-sm border border-[#b0d292] flex items-center space-x-2"
              >
                <Check className="h-4 w-4" />
                <span>Gerar Cobrança</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoice Table History */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50">
          <h3 className="font-serif text-[#192F28] font-bold text-base">Histórico de Transações e Liquidação</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-mono tracking-wider text-[10px] font-bold">
                <th className="p-4">Paciente</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Vencimento</th>
                <th className="p-4">Status Canal</th>
                <th className="p-4">Nota Fiscal (NFS-e)</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {billingList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-400 italic">Histórico de cobrança vazio.</td>
                </tr>
              ) : (
                billingList.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/55 transition-colors text-slate-700 font-medium">
                    <td className="p-4">
                      <div className="font-serif font-bold text-sm text-[#192F28]">{getPatientName(bill.patient_id)}</div>
                      <div className="text-[10px] font-mono text-slate-400">Ref: {bill.id}</div>
                    </td>
                    <td className="p-4 font-mono font-bold text-sm">
                      R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 font-mono">
                      {new Date(bill.due_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-mono text-[9px] font-bold uppercase ${bill.status === 'paid' ? 'bg-status-success/15 text-status-success' : 'bg-status-danger/10 text-status-danger'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${bill.status === 'paid' ? 'bg-status-success' : 'bg-status-danger animate-pulse'}`}></span>
                        <span>{bill.status === 'paid' ? 'Liquidado' : 'Pendente'}</span>
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded font-mono text-[9px] font-bold ${bill.nfe_status === 'issued' ? 'bg-[#192F28]/10 text-[#192F28] border border-[#192F28]/15' : bill.nfe_status === 'processing' ? 'bg-[#ECE5D5] text-[#192F28]' : 'bg-slate-100 text-slate-500'}`}>
                        <Receipt className="h-3 w-3" />
                        <span>
                          {bill.nfe_status === 'issued' ? 'Nota Emitida' : bill.nfe_status === 'processing' ? 'Em Processamento' : 'Não Emitida'}
                        </span>
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {bill.status === 'pending' ? (
                        <button
                          onClick={() => handleSimulatePayment(bill.id)}
                          className="bg-[#192F28] text-white font-mono text-[9px] uppercase px-3 py-1.5 rounded-full font-bold hover:bg-opacity-90 transition-all cursor-pointer shadow-sm"
                        >
                          Simular Pix (Compensar)
                        </button>
                      ) : (
                        <div className="text-[10px] text-emerald-700 font-mono font-bold flex items-center justify-end space-x-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Conciliado</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
