import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrainCircuit, Search, Filter, AlertTriangle, TrendingUp, TrendingDown, BookOpen, Clock, CheckCircle2, ChevronRight, User, MessageSquare, List } from 'lucide-react';
import { useStore } from '../store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

export default function DiaryDashboard() {
  const diaryStore = useStore(state => state.diary);
  const patientsStore = useStore(state => state.patients);
  const [viewTab, setViewTab] = useState<'conversas' | 'analise'>('conversas');
  const [filter, setFilter] = useState<'all' | 'alerts' | 'positive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // For the chat view
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Sorting descending by date
  const sortedEntries = useMemo(() => {
    return [...diaryStore].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [diaryStore]);

  // KPIs
  const totalEntries = sortedEntries.length;
  const recentEntriesCount = sortedEntries.filter(e => {
    const diff = new Date().getTime() - new Date(e.created_at).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000; // last 7 days
  }).length;
  const criticalAlerts = sortedEntries.filter(e => e.crisis_flag).length;

  const averageSentiment = totalEntries > 0 
    ? (sortedEntries.reduce((acc, e) => acc + e.sentiment_score, 0) / totalEntries).toFixed(1)
    : '0.0';

  // Chart data: general clinic mood over time (aggregate by date)
  const chartData = useMemo(() => {
    const dataByDate: Record<string, { totalScore: number, count: number }> = {};
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    sortedEntries.forEach(entry => {
      const date = new Date(entry.created_at);
      if (date >= tenDaysAgo) {
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!dataByDate[dateStr]) dataByDate[dateStr] = { totalScore: 0, count: 0 };
        dataByDate[dateStr].totalScore += entry.sentiment_score;
        dataByDate[dateStr].count += 1;
      }
    });

    return Object.keys(dataByDate).reverse().map(dateStr => ({ // reverse to make it chronological
      data: dateStr,
      humor: Number((dataByDate[dateStr].totalScore / dataByDate[dateStr].count).toFixed(2))
    }));
  }, [sortedEntries]);

  // Filtered feed
  const filteredEntries = useMemo(() => {
    return sortedEntries.filter(entry => {
      const patient = patientsStore.find(p => p.id === entry.patient_id);
      const matchesSearch = patient?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            entry.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFilter = true;
      if (filter === 'alerts') matchesFilter = entry.crisis_flag;
      if (filter === 'positive') matchesFilter = entry.sentiment_score > 0.3;

      return matchesSearch && matchesFilter;
    });
  }, [sortedEntries, patientsStore, filter, searchQuery]);

  // Conversas logic
  const patientsWithEntries = useMemo(() => {
    const list = patientsStore.map(p => {
      const pEntries = sortedEntries.filter(e => e.patient_id === p.id);
      return {
        ...p,
        entries: pEntries,
        lastEntry: pEntries.length > 0 ? pEntries[0] : null
      };
    }).filter(p => p.entries.length > 0);

    return list.sort((a, b) => {
      if (!a.lastEntry || !b.lastEntry) return 0;
      return new Date(b.lastEntry.created_at).getTime() - new Date(a.lastEntry.created_at).getTime();
    });
  }, [patientsStore, sortedEntries]);

  // Auto-select first patient if none selected
  useEffect(() => {
    if (viewTab === 'conversas' && !selectedPatientId && patientsWithEntries.length > 0) {
      setSelectedPatientId(patientsWithEntries[0].id);
    }
  }, [viewTab, patientsWithEntries, selectedPatientId]);

  // Scroll to bottom when patient changes
  useEffect(() => {
    if (viewTab === 'conversas' && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [selectedPatientId, viewTab]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 font-sans pb-10 flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-monique font-normal text-creative-green flex items-center gap-3 pb-1">
            <BrainCircuit className="h-9 w-9 text-creative-green shrink-0" /> Diário do Paciente
          </h1>
          <p className="text-[15px] font-medium text-slate-500 mt-1">
            Análise e leitura das reflexões compartilhadas de forma integrada.
          </p>
        </div>
        
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm overflow-x-auto shrink-0">
          <button 
            onClick={() => setViewTab('conversas')}
            className={`px-5 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${viewTab === 'conversas' ? 'bg-brand-primary text-status-success' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <MessageSquare className="w-4 h-4" /> Conversas
          </button>
          <button 
            onClick={() => setViewTab('analise')}
            className={`px-5 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${viewTab === 'analise' ? 'bg-brand-primary text-status-success' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <List className="w-4 h-4" /> Análise Geral
          </button>
        </div>
      </div>

      {viewTab === 'analise' && (
        <div className="animate-fade-in space-y-6">
          {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase flex items-center mb-1">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Total de Registros
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalEntries}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase flex items-center mb-1">
            <Clock className="w-3.5 h-3.5 mr-1.5" /> Últimos 7 dias
          </div>
          <div className="text-2xl font-bold text-[#76A34A]">{recentEntriesCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase flex items-center mb-1">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-red-500" /> Alertas Críticos
          </div>
          <div className="text-2xl font-bold text-red-600">{criticalAlerts}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase flex items-center mb-1">
             Termômetro Geral
          </div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-brand-primary">{averageSentiment}</div>
            {Number(averageSentiment) > 0 ? <TrendingUp className="w-5 h-5 text-status-success" /> : <TrendingDown className="w-5 h-5 text-status-success" />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center mb-2">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar palavra ou paciente..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-status-success/20 focus:border-status-success shadow-sm"
              />
            </div>
            
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm overflow-x-auto shrink-0 space-x-1">
              <button 
                onClick={() => setFilter('all')}
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-[#76A34A] text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                Feed Completo
              </button>
              <button 
                onClick={() => setFilter('alerts')}
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg whitespace-nowrap transition-colors ${filter === 'alerts' ? 'bg-red-500 text-white' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
              >
                Atenção
              </button>
              <button 
                onClick={() => setFilter('positive')}
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg whitespace-nowrap transition-colors ${filter === 'positive' ? 'bg-status-success text-brand-primary' : 'text-slate-500 hover:text-brand-primary hover:bg-status-success/20'}`}
              >
                Melhoras
              </button>
            </div>
          </div>

          <AnimatePresence>
            {filteredEntries.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm border-dashed"
              >
                <BookOpen className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <h4 className="font-bold text-slate-700 mb-2">Feed Vazio</h4>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">Nenhum registro encontrado para a busca ou filtro atual.</p>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {filteredEntries.map(entry => {
                  const patient = patientsStore.find(p => p.id === entry.patient_id);
                  const isPositive = entry.sentiment_score > 0.3;
                  
                  return (
                    <motion.div 
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white border rounded-2xl shadow-sm p-5 relative overflow-hidden transition-all hover:shadow-md ${entry.crisis_flag ? 'border-red-200' : 'border-slate-200'}`}
                    >
                      {entry.crisis_flag && (
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400"></div>
                      )}
                      {!entry.crisis_flag && isPositive && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-status-success"></div>
                      )}
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-brand-primary text-sm overflow-hidden border border-slate-200 shrink-0">
                            {patient?.photo_url ? (
                              <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              patient?.name?.substring(0, 2).toUpperCase() || <User className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-[15px]">{patient?.name || 'Paciente Removido'}</div>
                            <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                              {new Date(entry.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                           {entry.crisis_flag && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-red-50 text-red-600 uppercase tracking-wide border border-red-200">
                              <AlertTriangle className="h-3 w-3" /> Atenção Necessária
                            </span>
                          )}
                          <div className={`px-2.5 py-1 rounded border text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                            isPositive ? 'bg-status-success/20 border-status-success/40 text-brand-primary' : 
                            entry.sentiment_score < -0.3 ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                            'bg-slate-50 border-slate-200 text-slate-600'
                          }`}>
                            Mood {entry.sentiment_score}
                          </div>
                        </div>
                      </div>
                      
                      <div className="pl-[52px]">
                        <p className="text-slate-700 text-[15px] leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                        
                        <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end">
                          <button className="text-[13px] font-bold text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 transition-colors group">
                            Ver Histórico do Paciente <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar Analytics */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 overflow-hidden">
            <h3 className="text-[15px] font-bold text-slate-800 mb-5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#76A34A]" /> Humor Geral (Últimos 10 dias)
            </h3>
            
            <div className="h-[180px] w-full -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="humorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#76A34A" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#76A34A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[-1, 1]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1e293b', fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="humor" stroke="#76A34A" strokeWidth={2} fillOpacity={1} fill="url(#humorGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-[15px] font-bold text-slate-800 mb-2 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-slate-400" /> Inteligência Clínica
            </h3>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              O diário utiliza análise sentimental passiva capturada pela interação no WhatsApp para mapear a jornada terapêutica entre as sessões.
            </p>
            <ul className="space-y-3">
              <li className="flex gap-2">
                 <CheckCircle2 className="w-5 h-5 text-[#76A34A] shrink-0" />
                 <span className="text-sm text-slate-700">O <strong>Mood Score</strong> varia de -1.0 a +1.0.</span>
              </li>
              <li className="flex gap-2">
                 <CheckCircle2 className="w-5 h-5 text-[#76A34A] shrink-0" />
                 <span className="text-sm text-slate-700">Alertas críticos sinalizam forte carga negativa ou intenção autolesiva.</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
        </div>
      )}

      {viewTab === 'conversas' && (
        <div className="flex bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 min-h-[600px] animate-fade-in text-slate-800">
          {/* Sidebar */}
          <div className="w-full md:w-1/3 md:max-w-xs border-r border-slate-200 flex flex-col bg-[#FDFDFD]">
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full bg-slate-50 border border-transparent rounded-full text-sm focus:outline-none focus:ring-2 focus:bg-white focus:ring-status-success/50 focus:border-status-success"
                />
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1">
              {patientsWithEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Nenhuma conversa encontrada.
                </div>
              ) : (
                patientsWithEntries.map(p => {
                  const isSelected = selectedPatientId === p.id;
                  const msgs = p.entries;
                  const recent = p.lastEntry;
                  if (!recent) return null;
                  
                  return (
                  <button 
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-slate-200 border border-white shadow-sm flex items-center justify-center font-bold text-slate-600 text-sm">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        p.name?.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="font-bold text-[15px] truncate pr-2">{p.name}</span>
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(recent.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`text-[13px] truncate ${!isSelected && recent.crisis_flag ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>
                        {recent.content}
                      </p>
                    </div>
                  </button>
                )})
              )}
            </div>
          </div>
          
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col bg-[#F3F4F6] relative">
            {selectedPatientId ? (() => {
              const patient = patientsWithEntries.find(p => p.id === selectedPatientId);
              if (!patient) return null;
              
              const chronologicalEntries = [...patient.entries].reverse();
              
              return (
                <>
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 overflow-hidden shrink-0">
                        {patient.photo_url ? (
                          <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          patient.name?.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-[16px] leading-tight">{patient.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-[#76A34A] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#76A34A]"></span> Diário Ativo
                        </div>
                      </div>
                    </div>
                    <button className="text-[13px] font-semibold text-brand-primary border border-slate-200 hover:bg-slate-50 px-4 py-1.5 rounded-full transition-colors cursor-pointer">
                      Ver Perfil
                    </button>
                  </div>
                  
                  <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="text-center my-6">
                      <span className="bg-slate-200/50 text-slate-500 text-xs font-semibold px-3 py-1 rounded-full">
                        Início das Reflexões
                      </span>
                    </div>

                    {chronologicalEntries.map((msg, idx) => {
                      const isCrisis = msg.crisis_flag;
                      const isPositive = msg.sentiment_score > 0.3;
                      
                      return (
                      <motion.div 
                        key={msg.id} 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 350, damping: 22 }}
                        className="flex items-end gap-2 justify-end mb-4 origin-bottom-right"
                      >
                        <div className={`relative max-w-[75%] p-3 px-4 rounded-2xl rounded-br-none shadow-sm flex flex-col ${isCrisis ? 'bg-red-50 text-red-900 border border-red-100' : isPositive ? 'bg-status-success/20 border border-status-success/40 text-slate-900' : 'bg-white border border-slate-200'}`}>
                          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <div className={`flex items-center self-end gap-1.5 text-[10px] mt-1 ${isCrisis ? 'text-red-500' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {isCrisis ? (
                              <span className="bg-red-500 text-white px-1 rounded uppercase tracking-wider text-[8px] font-bold">Alerta</span>
                            ) : isPositive ? (
                              <span className="bg-status-success text-brand-primary px-1 rounded uppercase tracking-wider text-[8px] font-bold">Melhora</span>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </div>
                </>
              );
            })() : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <MessageSquare className="w-16 h-16 text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-700 mb-2">Selecione uma conversa</h3>
                <p className="text-sm">Clique em um paciente ao lado para ler seu diário.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </motion.div>
  );
}
