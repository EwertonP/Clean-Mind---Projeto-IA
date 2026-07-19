import React, { useState, useEffect } from 'react';
import { Doctor, Patient, Appointment, Billing } from '../data';
import { collection, getDocs, query, where, updateDoc, doc as firestoreDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  ArrowLeft, Building2, User, Users, Calendar, 
  CreditCard, Activity, AlertTriangle, MessageSquare, 
  ShieldCheck, RefreshCw, LogOut, CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  clinic: Doctor;
  onBack: () => void;
  onUpdateStatus: (clinic: Doctor) => void;
}

export function AgencyClientProfile({ clinic, onBack, onUpdateStatus }: Props) {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [billing, setBilling] = useState<Billing[]>([]);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    const fetchDetailedData = async () => {
      try {
        const [patientsSnap, appsSnap, billingSnap] = await Promise.all([
          getDocs(query(collection(db, "patients"), where("doctor_id", "==", clinic.id))),
          getDocs(query(collection(db, "appointments"), where("doctor_id", "==", clinic.id))),
          getDocs(query(collection(db, "billing"), where("doctor_id", "==", clinic.id)))
        ]);

        setPatients(patientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
        setAppointments(appsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
        setBilling(billingSnap.docs.map(d => ({ id: d.id, ...d.data() } as Billing)));
      } catch (error) {
        console.error("Error fetching detailed data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetailedData();
  }, [clinic.id]);

  // Calculations
  const activePatientsCount = patients.filter(p => p.status === 'active').length;
  
  // Weekly Appointments (Simple calculation: in the last 7 days)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekApps = appointments.filter(a => {
    const aDate = new Date(a.date);
    return aDate >= sevenDaysAgo && aDate <= now;
  }).length;

  const monthBillingDocs = billing.filter(b => {
    const bDate = new Date(b.created_at);
    return bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
  });
  const generatedGuides = monthBillingDocs.filter(b => b.nfe_status === 'issued').length;
  const monthRevenue = monthBillingDocs.reduce((acc, curr) => acc + curr.amount, 0);

  // Churn Risk calculation (No patients added in the last 15 days)
  let churnRiskText = "";
  let isHighRisk = false;
  
  const sortedPatients = [...patients].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const lastPatient = sortedPatients.length > 0 ? sortedPatients[0] : null;
  
  if (lastPatient) {
    const lastPDate = new Date(lastPatient.created_at);
    const diffDays = Math.floor((now.getTime() - lastPDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays > 15) {
      isHighRisk = true;
      churnRiskText = `Sem registro de novos pacientes há ${diffDays} dias. Possível baixo engajamento com a plataforma.`;
    } else {
      churnRiskText = `Último paciente registrado há ${diffDays} dias. Uso saudável da plataforma.`;
    }
  } else if (!loading) {
    isHighRisk = true;
    churnRiskText = "Nenhum paciente cadastrado até o momento. Risco altíssimo de abandono na fase de onboarding.";
  }

  const handleChangePlan = async (newPlan: 'free' | 'pro' | 'premium') => {
    if (!window.confirm(`Deseja alterar o plano deste cliente para ${newPlan.toUpperCase()}?`)) return;
    try {
      const ref = firestoreDoc(db, "doctors", clinic.id);
      await updateDoc(ref, { plan_type: newPlan });
      alert("Plano atualizado com sucesso!");
      window.location.reload(); // Quick refresh
    } catch(e) {
      alert("Erro ao alterar plano.");
    }
  };

  const handleResetPassword = async () => {
    alert(`Uma instrução de redefinição de senha fictícia foi enviada para ${clinic.email}.`);
    setShowPasswordReset(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center space-x-4 mb-6">
        <button 
          onClick={onBack}
          className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{clinic.clinic_name || 'Clínica não configurada'}</h2>
          <p className="text-sm font-medium text-slate-500">{clinic.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Profile & Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Responsável</p>
                <div className="flex items-center text-slate-900 font-medium">
                  <User className="w-4 h-4 mr-2 text-slate-400" />
                  {clinic.name}
                </div>
              </div>
              
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status de Implementação</p>
                {clinic.is_configured ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Onboarding Completo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Pendente Configuração
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Plano Atual</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-primary bg-status-success/20 px-3 py-1 rounded-lg">
                    {clinic.plan_type?.toUpperCase() || 'FREE'}
                  </span>
                  <button 
                    onClick={() => setIsChangingPlan(!isChangingPlan)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
                  >
                    Alterar
                  </button>
                </div>
                
                {isChangingPlan && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100 text-sm">
                    <button onClick={() => handleChangePlan('free')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all font-medium text-slate-600">Free</button>
                    <button onClick={() => handleChangePlan('pro')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all font-medium text-brand-primary">Pro</button>
                    <button onClick={() => handleChangePlan('premium')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all font-medium text-brand-primary">Premium</button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 mt-6 pt-6 space-y-3">
              <button 
                onClick={() => onUpdateStatus(clinic)}
                className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all border ${clinic.is_verified ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : 'bg-brand-primary text-white hover:bg-black'}`}
              >
                {clinic.is_verified ? 'Suspender Acesso' : 'Reativar Acesso'}
              </button>
              
              <button 
                onClick={() => setShowPasswordReset(true)}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all"
              >
                Resetar Senha
              </button>
              
              {showPasswordReset && (
                <div className="bg-orange-50 text-orange-800 p-3 rounded-lg text-xs font-medium border border-orange-100">
                  <p className="mb-2">Confirma o envio do link de recuperação para o email do cliente?</p>
                  <div className="flex space-x-2">
                    <button onClick={handleResetPassword} className="bg-orange-600 text-white px-3 py-1 rounded-md">Sim, Enviar</button>
                    <button onClick={() => setShowPasswordReset(false)} className="text-orange-600 px-3 py-1 bg-white rounded-md">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <button className="w-full bg-status-success/20 text-brand-primary py-3 rounded-xl border border-brand-primary/20 font-bold text-sm flex items-center justify-center hover:bg-status-success/30 transition-colors">
            <MessageSquare className="w-4 h-4 mr-2" />
            Enviar Mensagem (WhatsApp)
          </button>
        </div>

        {/* Right Column - Metrics */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Churn Risk Panel */}
          <div className={`p-5 rounded-2xl border ${isHighRisk ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'} flex items-start space-x-4`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isHighRisk ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold ${isHighRisk ? 'text-red-900' : 'text-green-900'}`}>
                {isHighRisk ? 'Risco de Churn (Alerta)' : 'Risco de Churn Controlado'}
              </h3>
              <p className={`text-sm mt-1 font-medium ${isHighRisk ? 'text-red-700' : 'text-green-700'}`}>
                {churnRiskText}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 bg-status-success/20 text-brand-primary rounded-xl flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Pacientes Cadastrados</h3>
              <div className="mt-2 flex items-baseline">
                <p className="text-[32px] font-bold text-slate-900 leading-none">{patients.length}</p>
                <span className="ml-2 text-xs font-bold text-brand-primary bg-status-success/20 px-2 py-1 rounded-md">{activePatientsCount} ativos</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 bg-status-success/20 text-brand-primary rounded-xl flex items-center justify-center mb-4">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Sessões (Últimos 7 dias)</h3>
              <div className="mt-2 flex items-baseline">
                <p className="text-[32px] font-bold text-slate-900 leading-none">{thisWeekApps}</p>
                <span className="ml-2 text-xs font-medium text-slate-500">agendamentos recorrentes</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Guias Faturadas (Mês)</h3>
              <div className="mt-2 flex items-baseline">
                <p className="text-[32px] font-bold text-slate-900 leading-none">{generatedGuides}</p>
                <span className="ml-2 text-xs font-medium text-slate-500">automatizadas</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-white relative overflow-hidden" style={{backgroundColor: '#114F3E'}}>
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Activity className="w-24 h-24" />
              </div>
              <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center mb-4 relative z-10">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-white/80 text-sm font-medium relative z-10">Volume Transacionado (Mês)</h3>
              <div className="mt-2 flex items-baseline relative z-10">
                <p className="text-[32px] font-bold text-white leading-none">R$ {monthRevenue.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
