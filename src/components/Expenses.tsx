import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DollarSign, Clock, Plus, CheckCircle2, Search, Filter, X } from 'lucide-react';
import { Expense, dataManager } from '../data';
import { useStore } from '../store';

export default function Expenses() {
  const expensesStore = useStore(state => state.expenses);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [category, setCategory] = useState<'água' | 'luz' | 'internet' | 'alimentação' | 'funcionários' | 'limpeza' | 'outros'>('água');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [toastMessage, setToastMessage] = useState('');

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date) return;

    dataManager.addExpense({
      amount: parseFloat(amount),
      date,
      category,
      description,
      status
    });

    setShowForm(false);
    setAmount('');
    setDescription('');
    setToastMessage('Despesa adicionada com sucesso.');
    setTimeout(() => setToastMessage(''), 5000);
  };

  const handlePayExpense = (id: string) => {
    dataManager.updateExpense(id, { status: 'paid' });
    setToastMessage('Despesa marcada como paga.');
    setTimeout(() => setToastMessage(''), 5000);
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
      dataManager.deleteExpense(id);
      setToastMessage('Despesa excluída.');
      setTimeout(() => setToastMessage(''), 5000);
    }
  };

  const totalPaid = expensesStore.filter(e => e.status === 'paid').reduce((acc, e) => acc + e.amount, 0);
  const totalPending = expensesStore.filter(e => e.status === 'pending').reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 z-50 max-w-xs bg-slate-800 text-white p-3 rounded-lg shadow-lg flex items-center space-x-2"
          >
            <CheckCircle2 className="h-4 w-4 text-[#C1E2A4] shrink-0" />
            <p className="text-xs font-medium">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm w-48">
            <div className="text-xs font-semibold text-slate-500 uppercase flex items-center mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[#192F28]" /> Pago
            </div>
            <div className="text-2xl font-bold text-[#192F28]">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm w-48">
            <div className="text-xs font-semibold text-slate-500 uppercase flex items-center mb-1">
              <Clock className="w-3.5 h-3.5 mr-1 text-amber-500" /> Pendente
            </div>
            <div className="text-2xl font-bold text-[#192F28]">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2 text-[14px] font-bold rounded-lg border border-transparent bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center shadow-md cursor-pointer h-10"
        >
          <Plus className="w-4 h-4 mr-2" /> Adicionar Despesa
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddExpense} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8 relative">
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                <DollarSign className="w-5 h-5 text-indigo-500 mr-2" /> Nova Despesa
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    placeholder="Ex: 150.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Data</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="água">Água</option>
                    <option value="luz">Luz</option>
                    <option value="internet">Internet</option>
                    <option value="alimentação">Alimentação</option>
                    <option value="funcionários">Funcionários</option>
                    <option value="limpeza">Limpeza do Espaço</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente (A Pagar)</option>
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-4">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Descrição (opcional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    placeholder="Detalhes adicionais..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  className="bg-[#192F28] text-[#C1E2A4] font-bold px-6 py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold text-slate-800 flex items-center">
            Histórico de Despesas
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500 uppercase font-semibold">
                <th className="p-4 font-mono tracking-wider">Descrição / Categoria</th>
                <th className="p-4 font-mono tracking-wider">Valor</th>
                <th className="p-4 font-mono tracking-wider">Data</th>
                <th className="p-4 font-mono tracking-wider">Status</th>
                <th className="p-4 font-mono tracking-wider text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {expensesStore.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">Nenhuma despesa registrada.</td>
                </tr>
              ) : (
                expensesStore.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/55 transition-colors border-b border-slate-50 last:border-0">
                    <td className="p-4">
                      <div className="font-bold text-sm text-[#192F28]">{exp.description || 'Sem descrição'}</div>
                      <div className="text-xs text-slate-500 capitalize">{exp.category}</div>
                    </td>
                    <td className="p-4 font-mono font-bold text-sm text-slate-700">
                      R$ {exp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {new Date(exp.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4">
                      {exp.status === 'paid' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded font-medium text-[10px] uppercase bg-emerald-100 text-emerald-800">
                          Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded font-medium text-[10px] uppercase bg-amber-100 text-amber-800">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        {exp.status === 'pending' && (
                          <button
                            onClick={() => handlePayExpense(exp.id)}
                            className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 cursor-pointer"
                          >
                            Pagar
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-xs text-red-500 font-semibold hover:text-red-700 cursor-pointer"
                        >
                          Excluir
                        </button>
                      </div>
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
