import { useEffect, useState } from "react";
import { collection, getDocs, updateDoc, doc as firestoreDoc, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Doctor } from "../data";
import { Building2, Users, CreditCard, Activity, Search, ShieldCheck, Plus, X, Copy, Mail } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AgencyClientProfile } from "./AgencyClientProfile";

export default function AgencyDashboard() {
  const [clinics, setClinics] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClinic, setSelectedClinic] = useState<Doctor | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const [clinicsStats, setClinicsStats] = useState<Record<string, { patients: number, revenue: number }>>({});

  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "doctors"));
        const clinicsData: Doctor[] = [];
        const stats: Record<string, { patients: number, revenue: number }> = {};
        
        const promises = querySnapshot.docs.map(async (doc) => {
           const doctorDoc = { id: doc.id, ...doc.data() } as Doctor;
           clinicsData.push(doctorDoc);

           if (doctorDoc.role !== 'agency') {
             try {
                // Fetch patient count
                const pQuery = query(collection(db, "patients"), where("doctor_id", "==", doc.id));
                const pSnap = await getCountFromServer(pQuery);
                const pCount = pSnap.data().count;

                // Estimate rev by plan
                let rev = 0;
                if (doctorDoc.plan_type === 'pro') rev = 299;
                else if (doctorDoc.plan_type === 'premium') rev = 199;
                else if (doctorDoc.plan_type === 'free') rev = 0;
                else rev = 150; // default estimated

                stats[doc.id] = { patients: pCount, revenue: rev };
             } catch (e) {
                stats[doc.id] = { patients: 0, revenue: 0 };
             }
           }
        });

        await Promise.all(promises);
        setClinicsStats(stats);
        setClinics(clinicsData);
      } catch (error) {
        console.error("Error fetching clinics API", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClinics();
  }, []);

  const totalClinics = clinics.filter(c => c.role !== 'agency').length;
  // This is a placeholder since we don't fetch all patients across collections yet.
  // In a real app we would either sync patient counts to the doctor doc or query patient collections
  const activeClinics = clinics.filter(c => c.is_configured && c.role !== 'agency').length;
  const pendingClinics = clinics.filter(c => !c.is_configured && c.role !== 'agency').length;

  const totalRevenue = Object.values(clinicsStats).reduce((acc, curr) => acc + curr.revenue, 0);

  const toggleStatus = async (clinic: Doctor) => {
     // A simple demonstration of mutating status. E.g. suspend a clinic
     try {
       const newIsVerified = !clinic.is_verified;
       const ref = firestoreDoc(db, "doctors", clinic.id);
       await updateDoc(ref, { is_verified: newIsVerified });
       setClinics(clinics.map(c => c.id === clinic.id ? { ...c, is_verified: newIsVerified } : c));
     } catch (err) {
       console.error("Could not update clinic status", err);
       alert("Erro ao atualizar status do cliente.");
     }
  };

  const filteredClinics = clinics.filter(c => 
    c.role !== 'agency' &&
    (c.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
     (c.clinic_name && c.clinic_name.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const handleGenerateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    
    // Generate a simple invite link using query params
    const link = `${window.location.origin}?invite=true&email=${encodeURIComponent(inviteEmail)}&name=${encodeURIComponent(inviteName)}`;
    setGeneratedLink(link);
  };

  if (selectedClinic) {
    return (
      <AnimatePresence mode="wait">
        <AgencyClientProfile 
          key="client-profile"
          clinic={selectedClinic} 
          onBack={() => setSelectedClinic(null)} 
          onUpdateStatus={(updated) => toggleStatus(updated)}
        />
      </AnimatePresence>
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
             <ShieldCheck className="w-5 h-5" />
             <span className="text-[13px] font-bold tracking-wider text-brand-primary uppercase">Master Admin</span>
           </div>
           <h1 className="text-4xl sm:text-5xl font-monique font-normal text-creative-green pb-1">CleanMind Hub</h1>
           <p className="text-[15px] font-medium text-slate-500 mt-1">Visão global de todos os clientes e clínicas a utilizar o CleanMind.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-500">A carregar dados das clínicas...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-status-success/20 text-brand-primary rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Total de Clínicas</h3>
              <p className="text-[28px] font-bold text-slate-900 leading-none mt-1">{totalClinics}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Configuradas Ativas</h3>
              <p className="text-[28px] font-bold text-slate-900 leading-none mt-1">{activeClinics}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Pendentes de Config</h3>
              <p className="text-[28px] font-bold text-slate-900 leading-none mt-1">{pendingClinics}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <CreditCard className="w-24 h-24" />
              </div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-12 h-12 bg-status-success/50 text-brand-primary rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium relative z-10">Faturamento Agência</h3>
              <p className="text-[28px] font-bold text-slate-900 leading-none mt-1 relative z-10">R$ {totalRevenue},00<span className="text-sm text-slate-400 font-sans font-normal ml-1">/ mês</span></p>
            </motion.div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center space-x-4">
                 <h2 className="text-lg font-bold text-slate-800">Clientes Atuais</h2>
                 <button 
                   onClick={() => { setShowInviteModal(true); setGeneratedLink(""); setInviteEmail(""); setInviteName(""); }}
                   className="flex items-center space-x-2 bg-brand-primary hover:bg-[#25453B] text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                 >
                   <Plus className="w-4 h-4" />
                   <span>Nova Clínica</span>
                 </button>
               </div>
               <div className="relative">
                 <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                 <input 
                   type="text" 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   placeholder="Pesquisar por email ou nome da clínica..."
                   className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 text-sm w-full md:w-80"
                 />
               </div>
             </div>

            <div className="overflow-x-auto custom-scroll border-t border-slate-200">
              <table className="w-full text-left border-separate border-spacing-0 min-w-[750px]">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200">Clínica / Responsável</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200 text-center">Pacientes</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200 text-center">Status</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200 text-center">Login (Acesso)</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200 text-center">Plano</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-500 border-b border-slate-200 text-right">Ação Rápida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClinics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">Nenhum cliente encontrado.</td>
                    </tr>
                  ) : (
                    filteredClinics.map(clinic => (
                      <tr 
                        key={clinic.id} 
                        className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                        onClick={() => setSelectedClinic(clinic)}
                      >
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 text-sm whitespace-nowrap leading-tight group-hover:text-brand-primary/70 transition-colors">{clinic.clinic_name || 'Sem nome (Incompleto)'}</div>
                          <div className="text-xs text-slate-500 mt-1">{clinic.email}</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="font-semibold text-slate-700 text-sm">{clinicsStats[clinic.id]?.patients || 0}</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${clinic.is_configured ? 'bg-status-success/20 text-brand-primary' : 'bg-brand-cream text-brand-primary'}`}>
                            {clinic.is_configured ? 'Configurada' : 'Pendente Configuração'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${clinic.is_verified ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-slate-500'}`}>
                             {clinic.is_verified ? 'Ativo' : 'Suspenso/Inativo'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="text-sm font-medium text-slate-600 whitespace-nowrap">{clinic.plan_type ? clinic.plan_type.toUpperCase() : 'FREE'}</div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(clinic);
                            }}
                            className="text-xs font-bold text-brand-primary hover:opacity-70 transition-colors bg-slate-100 px-3 py-1.5 rounded-lg"
                          >
                            {clinic.is_verified ? 'Suspender' : 'Reativar'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-status-success/20 text-brand-primary rounded-xl flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">Novo Convite Mágico</h3>
                    <p className="text-sm text-slate-500">Envie um link pré-configurado para a clínica.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowInviteModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {!generatedLink ? (
                  <form onSubmit={handleGenerateInvite} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Nome da Clínica ou Médico Responsável <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        value={inviteName}
                        onChange={e => setInviteName(e.target.value)}
                        placeholder="Ex: Clínica CleanMind"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">E-mail do Responsável <span className="text-red-500">*</span></label>
                      <input 
                        type="email" 
                        required
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="contato@clinica.com"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    
                    <button 
                      type="submit"
                      disabled={!inviteEmail || !inviteName}
                      className="w-full mt-2 bg-brand-primary hover:bg-black text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      Gerar Link de Convite
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-status-success/10 text-brand-primary p-4 rounded-xl border border-brand-primary/20">
                      <p className="text-sm font-medium mb-2">Link gerado com sucesso!</p>
                      <div className="flex items-center space-x-2">
                        <div className="bg-white px-3 py-2 border border-brand-primary/25 rounded-lg text-xs font-mono flex-1 overflow-x-auto whitespace-nowrap text-brand-primary">
                          {generatedLink}
                        </div>
                        <button 
                          onClick={() => { navigator.clipboard.writeText(generatedLink); alert("Link copiado!"); }}
                          className="p-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/80 transition-colors"
                          title="Copiar Link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-slate-500 mb-4">
                      Envie este link para <strong className="text-slate-700">{inviteName}</strong>. 
                      Ao clicar, eles serão direcionados para configurar a senha, e o sistema fará o onboarding preenchendo automaticamente o e-mail e o nome.
                    </p>

                    <button 
                      onClick={() => setShowInviteModal(false)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Concluir e Fechar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
