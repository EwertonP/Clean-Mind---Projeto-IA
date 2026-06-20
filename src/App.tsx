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
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Doctor, dataManager } from './data';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Agenda from './components/Agenda';
import Billing from './components/Billing';
import MedicalRecordEditor from './components/MedicalRecordEditor';
import PatientDiaryApp from './components/PatientDiaryApp';
import AlertCenter from './components/AlertCenter';
import Doctors from './components/Doctors';
import Settings from './components/Settings';

export default function App() {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedPatientParam, setSelectedPatientParam] = useState<string | undefined>(undefined);
  const [billingDraftParam, setBillingDraftParam] = useState<any>(null);
  const [openNewAppointmentParam, setOpenNewAppointmentParam] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [globalToastMessage, setGlobalToastMessage] = useState('');
  
  // Dynamic counter to force refresh of localStorage states across tabs
  const [triggerCount, setTriggerCount] = useState<number>(0);
  const [hasAlerts, setHasAlerts] = useState(false);
  const prevAlertCount = useRef<number>(0);

  // Load doctor session from local storage on mount
  useEffect(() => {
    const sessionId = localStorage.getItem('cm_doctor_session');
    if (sessionId) {
      const doctors = dataManager.getDoctors();
      const doc = doctors.find(d => d.id === sessionId);
      if (doc) {
        setDoctor(doc);
        dataManager.pullFromFirestore(doc.id).then(() => {
          setTriggerCount(prev => prev + 1);
        });
        if (doc.is_configured === false) {
          setActiveTab('configuracoes');
        }
        return;
      }
    }
    // If no session, remain null (Auth screen will show)
  }, []);

  useEffect(() => {
    if (doctor?.is_configured === false && activeTab !== 'configuracoes') {
      setActiveTab('configuracoes');
    }
  }, [doctor?.is_configured, activeTab]);

  useEffect(() => {
    // Check for crisis alerts
    const activeAlerts = dataManager.getDiaryEntries().filter(e => e.crisis_flag);
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
  }, [triggerCount]);

  const handleRefreshAll = () => {
    setTriggerCount(prev => prev + 1);
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
    setDoctor(null);
    setActiveTab('dashboard');
  };

  const handleResetData = () => {
    if (confirm('Deseja resetar todas as alterações para o estado demonstrativo original?')) {
      dataManager.resetAll();
    }
  };

  if (!doctor) {
    return <Auth onAuthSuccess={(doc) => {
      localStorage.setItem('cm_doctor_session', doc.id);
      setDoctor(doc);
    }} />;
  }

  if (doctor.is_configured === false) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] font-sans text-slate-900 flex flex-col items-center py-8 px-4 sm:px-6">
        <div className="w-full max-w-5xl">
          <div className="flex justify-between items-center mb-8 px-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#C1E2A4] flex items-center justify-center font-bold text-slate-800 text-sm">
                C
              </div>
              <h1 className="text-xl md:text-2xl font-serif font-bold tracking-tight text-slate-900">cleanmind.</h1>
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
            <Settings onRefreshDashboard={handleRefreshAll} />
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
        <div className="flex flex-col flex-grow">
          
          {/* Brand Seal header */}
          <div className="p-6 pb-2 inline-flex items-center space-x-2 relative">
            <img src="/cleanmind_logo.png" alt="CleanMind" className="h-8 object-contain" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const fallback = document.getElementById('logo-fallback-desktop');
              if (fallback) fallback.style.display = 'flex';
            }} />
            <div id="logo-fallback-desktop" className="hidden items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-[#C1E2A4] flex items-center justify-center text-[#192F28]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M12 21a9 9 0 0 0 8-12.8A9 9 0 0 0 5.4 6" />
                  <path d="M21 3L9 15" />
                  <path d="M12 21a9 9 0 0 1-8-12.8" />
                  <path d="M3 21L15 9" />
                </svg>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">CleanMind</h1>
            </div>
            
            <button 
              className="md:hidden absolute right-4 top-6 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="px-4 mt-4">
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
                  <p className="text-sm font-bold text-slate-900 truncate">{doctor?.name || 'Médico(a)'}</p>
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
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'configuracoes' ? 'bg-[#192F28] text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
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
          <div className="p-4 mt-auto">
             <button
                onClick={() => {
                  handleLogout();
                  setIsUserMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-50"
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
        <header className={`sticky top-0 z-10 flex items-center justify-between px-4 sm:px-8 shrink-0 transition-all ${
          activeTab === 'dashboard' 
            ? 'h-16 md:h-8 bg-transparent border-none' 
            : 'h-16 md:h-20 border-b border-slate-200 bg-white/80 backdrop-blur-md'
        }`}>
          
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Small screen menu triggers */}
            <div className="md:hidden flex items-center mt-4">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-1.5 -ml-1.5 mr-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <img src="/cleanmind_logo.png" alt="cleanmind." className="h-6 object-contain" onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const fallback = document.getElementById('logo-fallback-mobile');
                if (fallback) fallback.style.display = 'inline';
              }} />
              <span id="logo-fallback-mobile" className="hidden font-serif font-bold text-lg text-slate-900">cleanmind.</span>
            </div>
          </div>

        </header>

        {/* Active viewport content box */}
        <main className="flex-grow p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-8">
          {activeTab === 'dashboard' && (
            <Dashboard 
              onNavigate={handleNavigateWithParams} 
              triggerRefresh={triggerCount} 
            />
          )}
          {activeTab === 'agenda' && (
            <Agenda 
              onNavigate={handleNavigateWithParams}
              initialOpenNewModal={openNewAppointmentParam}
              onRefreshDashboard={handleRefreshAll} 
              triggerRefresh={triggerCount} 
            />
          )}
          {activeTab === 'prontuario' && (
            <MedicalRecordEditor 
              initialPatientId={selectedPatientParam} 
              onRefreshDashboard={handleRefreshAll} 
              triggerRefresh={triggerCount} 
            />
          )}
          {activeTab === 'financeiro' && (
            <Billing 
              initialDraft={billingDraftParam}
              onClearDraft={() => setBillingDraftParam(null)}
              onRefreshDashboard={handleRefreshAll} 
              triggerRefresh={triggerCount} 
            />
          )}
          {activeTab === 'paciente' && (
            <PatientDiaryApp 
              onRefreshDashboard={handleRefreshAll} 
              triggerRefresh={triggerCount} 
            />
          )}
          {activeTab === 'medicos' && (
            <Doctors 
              onRefreshDashboard={handleRefreshAll} 
              triggerRefresh={triggerCount} 
            />
          )}
          {activeTab === 'alertas' && (
            <AlertCenter 
              onNavigate={handleNavigateWithParams} 
              triggerRefresh={triggerCount} 
            />
          )}
          {activeTab === 'configuracoes' && (
            <Settings onRefreshDashboard={handleRefreshAll} />
          )}
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
