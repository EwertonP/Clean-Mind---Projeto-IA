import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  FileText, 
  Wallet, 
  MessageSquare, 
  Database,
  LogOut,
  BrainCircuit,
  SlidersHorizontal,
  User,
  Heart,
  Sparkles,
  RefreshCw,
  Award,
  Menu,
  X,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Users,
  ShieldCheck,
  Building2,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Doctor, dataManager } from './data';
import { useStore } from './store';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Agenda from './components/Agenda';
import Billing from './components/Billing';
import MedicalRecordEditor from './components/MedicalRecordEditor';
import PatientDiaryApp from './components/PatientDiaryApp';
import AlertCenter from './components/AlertCenter';
import Doctors from './components/Doctors';
import Settings from './components/Settings';
import AgencyDashboard from './components/AgencyDashboard';
import DiaryDashboard from './components/DiaryDashboard';
import PatientMobileApp from './components/PatientMobileApp';
import { AgencyFinanceDashboard } from './components/AgencyFinanceDashboard';

export default function App() {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [patientUser, setPatientUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedPatientParam, setSelectedPatientParam] = useState<string | undefined>(undefined);
  const [billingDraftParam, setBillingDraftParam] = useState<any>(null);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('cm_dark_mode');
  }, []);

  useEffect(() => {
    // Sempre rolar para o topo ao trocar de aba
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    if (doctor?.id) {
       const unsub = useStore.getState().initSync(doctor.id);
       return () => unsub();
    }
  }, [doctor?.id]);
  const [openNewAppointmentParam, setOpenNewAppointmentParam] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [agencyTab, setAgencyTab] = useState<'clinics' | 'finance'>('clinics');
  const [globalToastMessage, setGlobalToastMessage] = useState('');
  
  const [hasAlerts, setHasAlerts] = useState(false);
  const prevAlertCount = useRef<number>(0);
  
  const diaryEntries = useStore((state) => state.diary);

  // Load doctor or patient session from local storage on mount
  useEffect(() => {
    const patientSessionId = localStorage.getItem('cm_patient_session');
    if (patientSessionId) {
      const patients = dataManager.getPatients();
      const p = patients.find(pat => pat.id === patientSessionId);
      if (p) {
        setPatientUser(p);
      } else {
        // Fallback to firestore if not found in local array
        import('firebase/firestore').then(({ doc, getDoc }) => {
          import('./firebase').then(({ db }) => {
            getDoc(doc(db, 'patients', patientSessionId)).then(docSnap => {
              if (docSnap.exists()) {
                setPatientUser({ id: docSnap.id, ...docSnap.data() } as any);
              } else {
                localStorage.removeItem('cm_patient_session');
              }
            });
          });
        });
      }
      return;
    }

    const sessionId = localStorage.getItem('cm_doctor_session');
    if (sessionId) {
      const doctors = dataManager.getDoctors();
      const doc = doctors.find(d => d.id === sessionId);
      if (doc) {
        setDoctor(doc);
        dataManager.pullFromFirestore(doc.id);
        if (doc.is_configured === false) {
          setActiveTab('configuracoes');
        }
        return;
      }
    }
  }, []);

  useEffect(() => {
    if (doctor?.is_configured === false && activeTab !== 'configuracoes' && doctor.role !== 'agency') {
      setActiveTab('configuracoes');
    }
  }, [doctor?.is_configured, activeTab, doctor?.role]);

  useEffect(() => {
    if (!doctor) return;

    let timeoutId: number;

    const handleLogoutTimeout = () => {
      localStorage.removeItem('cm_doctor_session');
      setDoctor(null);
      setActiveTab('dashboard');
      alert('Sua sessão expirou por inatividade (Regra de Segurança e Privacidade). Você foi desconectado automaticamente.');
    };

    const resetTimeout = () => {
      window.clearTimeout(timeoutId);
      // 3 hours = 3 * 60 * 60 * 1000
      timeoutId = window.setTimeout(handleLogoutTimeout, 3 * 60 * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimeout));

    // Initialize timer
    resetTimeout();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach(e => document.removeEventListener(e, resetTimeout));
    };
  }, [doctor]);

  useEffect(() => {
    // Check for crisis alerts
    const activeAlerts = diaryEntries.filter(e => e.crisis_flag);
    setHasAlerts(activeAlerts.length > 0);
    
    // Only show popup if new alerts appeared (count increased)
    if (activeAlerts.length > prevAlertCount.current) {
      setGlobalToastMessage('Existem novos alertas clínicos detectados pela IA. Verifique urgentemente a Central de Alertas.');
    }
    
    prevAlertCount.current = activeAlerts.length;

    // Refresh doctor profile data
    const sessionId = localStorage.getItem('cm_doctor_session');
    if (sessionId) {
      const doctors = dataManager.getDoctors();
      const doc = doctors.find(d => d.id === sessionId);
      if (doc) {
        setDoctor(doc);
      }
    }
  }, [diaryEntries]);

  const handleRefreshAll = () => {
    // Left empty since Zustand triggers re-renders automatically
  };

  const handleNavigateWithParams = (tab: string, patientId?: string, draft?: any) => {
    setSelectedPatientParam(patientId);
    if (draft) {
      if (tab === 'agenda' && draft === 'new_appointment') {
        setOpenNewAppointmentParam(true);
      } else {
        setBillingDraftParam(draft);
      }
    } else {
      setOpenNewAppointmentParam(false);
    }
    setActiveTab(tab);
    setIsMobileMenuOpen(false); // Close menu on navigation
    handleRefreshAll();
  };

  const handleLogout = () => {
    localStorage.removeItem('cm_doctor_session');
    localStorage.removeItem('cm_patient_session');
    setDoctor(null);
    setPatientUser(null);
    setActiveTab('dashboard');
  };

  const handleResetData = () => {
    if (confirm('Deseja resetar todas as alterações para o estado demonstrativo original?')) {
      dataManager.resetAll();
    }
  };

  if (!doctor && !patientUser) {
    return <Auth 
      onAuthSuccess={(doc) => {
        localStorage.setItem('cm_doctor_session', doc.id);
        setDoctor(doc);
      }} 
      onPatientAuthSuccess={(patient) => {
        localStorage.setItem('cm_patient_session', patient.id);
        setPatientUser(patient);
      }}
    />;
  }

  if (patientUser) {
    return (
      <div className="bg-[#EAECE6] min-h-screen">
         <PatientMobileApp patient={patientUser} onLogout={handleLogout} />
      </div>
    );
  }

  if (doctor?.role === 'agency') {
    return (
      <div className="min-h-screen bg-[#FBFBFA] font-sans text-slate-900 flex">
        {/* Mobile Backdrop Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Navigation Sidebar (Desktop & Mobile Drawer) */}
        <aside className={`fixed top-0 left-0 h-screen w-[260px] flex-col border-r border-slate-100 bg-white z-40 shadow-xl md:shadow-none transform transition-transform duration-300 ease-in-out md:flex ${isMobileMenuOpen ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0 hidden'}`}>
          <div className="flex flex-col flex-grow h-full overflow-y-auto max-h-screen custom-scroll min-h-0 relative">
            
            {/* Brand Seal header */}
            <div className="p-6 pb-2 inline-flex items-center space-x-2 relative">
              <div className="w-8 h-8 rounded-lg bg-status-success flex items-center justify-center text-brand-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-[28px] font-monique font-normal text-creative-green">CleanMind Hub</h1>
              
              <button 
                className="md:hidden absolute right-4 top-6 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="px-4 mt-4 relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-100 shadow-sm rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                    A
                  </div>
                  <div className="ml-3 min-w-0 text-left">
                    <p className="text-sm font-bold text-slate-900 truncate">Agência e Agentes</p>
                    <p className="text-xs text-slate-500 truncate">{doctor.email}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </button>
            </div>

            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mx-4 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-50 absolute w-[228px] top-[140px]"
                >
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={() => {
                        setAgencyTab('clinics');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer text-slate-700 hover:bg-slate-50"
                    >
                      <SlidersHorizontal className="h-4 w-4 shrink-0" />
                      <span>Configurações</span>
                    </button>



                    <button
                      onClick={() => {
                        handleLogout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <LogOut className="h-[18px] w-[18px] shrink-0" />
                      <span>Sair do Hub</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Links list */}
            <nav className="flex-grow px-4 space-y-5 mt-8 overflow-y-auto pb-4">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Administração</h3>
                <div className="space-y-0.5">
                  <button
                    onClick={() => { setAgencyTab('clinics'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${agencyTab === 'clinics' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <Building2 className={`h-[18px] w-[18px] shrink-0 ${agencyTab === 'clinics' ? 'text-[#76A34A]' : 'text-slate-400'}`} />
                    <span>Clínicas</span>
                  </button>
                  <button
                    onClick={() => { setAgencyTab('finance'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${agencyTab === 'finance' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <DollarSign className={`h-[18px] w-[18px] shrink-0 ${agencyTab === 'finance' ? 'text-[#76A34A]' : 'text-slate-400'}`} />
                    <span>Financeiro Hub</span>
                  </button>
                </div>
              </div>
            </nav>
            
            {/* Footer Area Navigation */}
            <div className="p-4 mt-auto space-y-2">


               <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                  <span>Sair do Hub</span>
                </button>
            </div>
          </div>
        </aside>

        {/* Main viewport Container */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen md:ml-[260px] bg-slate-50 w-full relative">
          
          {/* Header navigation controller */}
          <header className="sticky top-0 z-10 flex items-center justify-between py-4 px-4 sm:px-8 shrink-0 transition-all h-16 md:h-[72px] bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm md:bg-transparent md:border-none md:shadow-none md:backdrop-blur-none" style={{ marginTop: '0px' }}>
            
            <div className="flex items-center space-x-3 sm:space-x-4 w-full">
              {/* Small screen menu triggers */}
              <div className="md:hidden flex items-center">
                <button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-1.5 -ml-1.5 mr-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Menu className="h-6 w-6" />
                </button>
              </div>
              
              <AnimatePresence mode="wait">
                <motion.div
                  key="agency-header"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="min-w-0 flex-1 truncate"
                >
                   <h2 className="text-3xl sm:text-4xl font-monique font-normal text-creative-green truncate pb-1">
                     {agencyTab === 'clinics' ? 'Gerenciamento de Clínicas' : 'Painel Financeiro'}
                   </h2>
                </motion.div>
              </AnimatePresence>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 sm:px-8 pb-12 w-full max-w-[1600px] mx-auto custom-scroll">
            {agencyTab === 'clinics' ? <AgencyDashboard /> : <AgencyFinanceDashboard />}
          </main>
        </div>
      </div>
    );
  }

  if (doctor.is_configured === false) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] font-sans text-slate-900 flex flex-col items-center py-8 px-4 sm:px-6">
        <div className="w-full max-w-5xl">
          <div className="flex justify-between items-center mb-8 px-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-status-success flex items-center justify-center font-bold text-brand-primary text-sm">
                C
              </div>
              <h1 className="text-[32px] font-monique font-normal text-creative-green">cleanmind.</h1>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-slate-700 flex items-center space-x-2 text-sm font-medium transition cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm"
              title="Encerrar Sessão"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 text-sm">Configuração Obrigatória</h3>
              <p className="text-amber-700 text-sm mt-1">Por favor, preencha todas as informações do perfil da clínica para liberar o acesso ao sistema completo.</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <Settings />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] font-sans text-slate-900 flex">
      
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Navigation Sidebar (Desktop & Mobile Drawer) */}
      <aside className={`fixed top-0 left-0 h-screen w-[260px] flex-col border-r border-slate-100 bg-white z-40 shadow-xl md:shadow-none transform transition-transform duration-300 ease-in-out md:flex ${isMobileMenuOpen ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0 hidden'}`}>
        <div className="flex flex-col flex-grow h-full overflow-y-auto max-h-screen custom-scroll min-h-0 relative">
          
          {/* Brand Seal header */}
          <div className="p-6 pb-2 inline-flex items-center space-x-2 relative">
            <img src="/CleanMind Logo.png" alt="CleanMind" className="h-8 object-contain" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const fallback = document.getElementById('logo-fallback-desktop');
              if (fallback) fallback.style.display = 'flex';
            }} />
            <div id="logo-fallback-desktop" className="hidden items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-status-success flex items-center justify-center text-brand-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M12 21a9 9 0 0 0 8-12.8A9 9 0 0 0 5.4 6" />
                  <path d="M21 3L9 15" />
                  <path d="M12 21a9 9 0 0 1-8-12.8" />
                  <path d="M3 21L15 9" />
                </svg>
              </div>
              <h1 className="text-[28px] font-monique font-normal text-creative-green">CleanMind</h1>
            </div>
            
            <button 
              className="md:hidden absolute right-4 top-6 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="px-4 mt-4 relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-100 shadow-sm rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center min-w-0">
                {doctor?.clinic_logo ? (
                  <img src={doctor.clinic_logo} alt="Logo" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                    {doctor?.clinic_name ? doctor.clinic_name.charAt(0).toUpperCase() : 'C'}
                  </div>
                )}
                <div className="ml-3 min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-900 truncate">Agência e Agentes</p>
                  <p className="text-xs text-slate-500 truncate">{doctor?.email || 'email@exemplo.com'}</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </button>
          </div>

          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-4 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-50 absolute w-[228px] top-[140px]"
              >
                <div className="p-2 space-y-1">
                  <button 
                    onClick={() => {
                      handleNavigateWithParams('configuracoes');
                      setIsUserMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'configuracoes' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    <SlidersHorizontal className="h-4 w-4 shrink-0" />
                    <span>Configurações</span>
                  </button>



                  <a
                    href="https://wa.me/5511999999999"
                    target="_blank"
                    rel="noreferrer" 
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer text-slate-700 hover:bg-slate-50"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span>Suporte</span>
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Links list */}
          <nav className="flex-grow px-4 space-y-5 mt-8 overflow-y-auto pb-4">
            {true ? (
              <>
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Geral</h3>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => handleNavigateWithParams('dashboard')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <LayoutDashboard className={`h-[18px] w-[18px] shrink-0 ${activeTab === 'dashboard' ? 'text-[#76A34A]' : ''}`} />
                      <span>Dashboard</span>
                    </button>
                    <button
                      onClick={() => handleNavigateWithParams('paciente')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'paciente' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <Users className={`h-[18px] w-[18px] shrink-0 ${activeTab === 'paciente' ? 'text-[#76A34A]' : ''}`} />
                      <span>Pacientes</span>
                    </button>
                    <button
                      onClick={() => handleNavigateWithParams('agenda')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'agenda' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <Calendar className={`h-[18px] w-[18px] shrink-0 ${activeTab === 'agenda' ? 'text-[#76A34A]' : ''}`} />
                      <span>Agenda</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Clínica</h3>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => handleNavigateWithParams('prontuario')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'prontuario' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <FileText className={`h-[18px] w-[18px] shrink-0 ${activeTab === 'prontuario' ? 'text-[#76A34A]' : ''}`} />
                      <span>Prontuários</span>
                    </button>
                    <button
                      onClick={() => handleNavigateWithParams('alertas')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'alertas' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <AlertTriangle className={`h-[18px] w-[18px] shrink-0 ${activeTab === 'alertas' ? 'text-[#76A34A]' : ''}`} />
                      <span>Alertas Clínicos</span>
                    </button>
                    <button
                      onClick={() => handleNavigateWithParams('diario')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'diario' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <BrainCircuit className={`h-[18px] w-[18px] shrink-0 ${activeTab === 'diario' ? 'text-[#76A34A]' : ''}`} />
                      <span>Diário do Paciente</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Administração</h3>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => handleNavigateWithParams('financeiro')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'financeiro' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <Wallet className={`h-[18px] w-[18px] shrink-0 ${activeTab === 'financeiro' ? 'text-[#76A34A]' : ''}`} />
                      <span>Financeiro</span>
                    </button>
                    <button
                      onClick={() => handleNavigateWithParams('medicos')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'medicos' ? 'bg-slate-100 text-slate-900 shadow-sm border-slate-200/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <Stethoscope className={`h-[18px] w-[18px] shrink-0 ${activeTab === 'medicos' ? 'text-[#76A34A]' : ''}`} />
                      <span>Médicos Associados</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-4 py-4 text-xs text-slate-500 font-medium text-center bg-amber-50 rounded-lg border border-amber-100">
                Conclua as configurações iniciais para liberar o acesso.
              </div>
            )}
          </nav>
          
          {/* Footer Area Navigation */}
          <div className="p-4 mt-auto space-y-2">


             <button
                onClick={() => {
                  handleLogout();
                  setIsUserMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                <span>Logout</span>
              </button>
          </div>
        </div>
      </aside>

      {/* Main viewport Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen md:ml-[260px] bg-slate-50 w-full relative">
        
        {/* Header navigation controller */}
        <header className="sticky top-0 z-10 flex items-center justify-between py-4 px-4 sm:px-8 shrink-0 transition-all h-16 md:h-[72px] bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm md:bg-transparent md:border-none md:shadow-none md:backdrop-blur-none" style={{ marginTop: '0px' }}>
          
          <div className="flex items-center space-x-3 sm:space-x-4 w-full">
            {/* Small screen menu triggers */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-1.5 -ml-1.5 mr-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <img src="/CleanMind Logo.png" alt="cleanmind." className="h-6 object-contain" onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const fallback = document.getElementById('logo-fallback-mobile');
                if (fallback) fallback.style.display = 'inline';
              }} />
              <span id="logo-fallback-mobile" className="hidden font-serif font-bold text-lg text-slate-900">cleanmind.</span>
            </div>

            {/* Global Search */}
            <div className="hidden md:flex ml-auto flex-1 max-w-md items-center relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="Busca global (pacientes, prontuários)..." 
                className="pl-9 pr-4 py-2 w-full text-sm outline-none border border-slate-200 rounded-full focus:ring-2 focus:ring-status-success/50 focus:border-status-success transition-all bg-white"
                onChange={(e) => {
                  if (activeTab !== 'paciente' && e.target.value.length > 2) {
                     handleNavigateWithParams('paciente');
                  }
                }}
              />
            </div>
          </div>

        </header>

        {/* Active viewport content box */}
        <main className="flex-grow p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  onNavigate={handleNavigateWithParams} 
                />
              )}
              {activeTab === 'agenda' && (
                <Agenda 
                  onNavigate={handleNavigateWithParams}
                  initialOpenNewModal={openNewAppointmentParam}
                />
              )}
              {activeTab === 'prontuario' && (
                <MedicalRecordEditor 
                  initialPatientId={selectedPatientParam} 
                />
              )}
              {activeTab === 'financeiro' && (
                <Billing 
                  initialDraft={billingDraftParam}
                  onClearDraft={() => setBillingDraftParam(null)}
                />
              )}
              {activeTab === 'diario' && (
                <DiaryDashboard />
              )}
              {activeTab === 'paciente' && (
                <PatientDiaryApp 
                />
              )}
              {activeTab === 'medicos' && (
                <Doctors 
                />
              )}
              {activeTab === 'alertas' && (
                <AlertCenter 
                  onNavigate={handleNavigateWithParams} 
                />
              )}
              {activeTab === 'configuracoes' && (
                <Settings />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* Global Application Toast Notification */}
      <AnimatePresence>
        {globalToastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 bg-slate-900 border border-slate-800 text-white px-5 py-4 rounded-xl shadow-2xl flex items-start space-x-3 z-50 max-w-sm"
          >
            <div className="p-1 min-w-max bg-red-500/20 rounded-full mt-0.5">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1 text-red-400">Atenção Prioritária</h3>
              <p className="text-sm font-medium text-slate-200 leading-snug">{globalToastMessage}</p>
            </div>
            <button 
              onClick={() => setGlobalToastMessage('')}
              className="ml-auto text-slate-400 hover:text-white mt-1 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
