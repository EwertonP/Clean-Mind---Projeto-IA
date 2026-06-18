import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  FileText, 
  DollarSign, 
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
  CheckCircle2
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
  }, [triggerCount]);

  const handleRefreshAll = () => {
    setTriggerCount(prev => prev + 1);
  };

  const handleNavigateWithParams = (tab: string, patientId?: string) => {
    setSelectedPatientParam(patientId);
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
      <aside className={`fixed top-0 left-0 h-screen w-[260px] md:w-64 flex-col border-r border-slate-200 bg-white z-40 shadow-xl md:shadow-sm transform transition-transform duration-300 ease-in-out md:flex ${isMobileMenuOpen ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0 hidden'}`}>
        <div className="flex flex-col flex-grow">
          
          {/* Brand Seal header */}
          <div className="p-5 md:p-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-serif font-bold tracking-tight text-slate-900 mb-4 md:mb-6">cleanmind.</h1>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#C1E2A4] flex items-center justify-center font-bold text-slate-800 text-xs md:text-sm">
                  C
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-bold text-slate-900 truncate">Clínica One</p>
                  <p className="text-[10px] md:text-[11px] text-slate-500 truncate">Seção Monteiro</p>
                </div>
              </div>
            </div>
            
            {/* Close button for mobile */}
            <button 
              className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links list */}
          <nav className="flex-grow px-3 md:px-4 space-y-1 mt-2 overflow-y-auto">
            {doctor?.is_configured !== false ? (
              <>
                <button
                  onClick={() => handleNavigateWithParams('dashboard')}
                  className={`w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-[#C1E2A4] text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => handleNavigateWithParams('agenda')}
                  className={`w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'agenda' ? 'bg-[#C1E2A4] text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                  <span>Agenda</span>
                </button>

                <button
                  onClick={() => handleNavigateWithParams('financeiro')}
                  className={`w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'financeiro' ? 'bg-[#C1E2A4] text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                  <span>Cobranças</span>
                </button>

                <button
                  onClick={() => handleNavigateWithParams('prontuario')}
                  className={`w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'prontuario' ? 'bg-[#C1E2A4] text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <FileText className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                  <span>Prontuários</span>
                </button>

                <button
                  onClick={() => handleNavigateWithParams('paciente')}
                  className={`w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'paciente' ? 'bg-[#C1E2A4] text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <User className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                  <span>Pacientes</span>
                </button>

                <button
                  onClick={() => handleNavigateWithParams('medicos')}
                  className={`w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'medicos' ? 'bg-[#C1E2A4] text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Stethoscope className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                  <span>Médicos</span>
                </button>
              </>
            ) : (
              <div className="px-4 py-4 text-xs text-slate-500 font-medium text-center bg-amber-50 rounded-lg border border-amber-100">
                Conclua as configurações iniciais para liberar o acesso.
              </div>
            )}
          </nav>
        </div>

        {/* Doctor Identity Block */}
        <div className="p-3 md:p-4 border-t border-slate-200 mt-auto">
          <button 
            onClick={() => handleNavigateWithParams('configuracoes')}
            className={`w-full text-left px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer ${activeTab === 'configuracoes' ? 'bg-[#192F28] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <SlidersHorizontal className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
            <span>Configurações</span>
          </button>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noreferrer" 
            className="w-full text-left px-3 md:px-4 py-2 mt-1 rounded-lg text-xs md:text-sm font-medium flex items-center space-x-3 transition-all cursor-pointer text-slate-600 hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4 md:h-5 md:w-5 shrink-0 text-green-500" />
            <span>Suporte</span>
          </a>
          
          <div className="flex items-center justify-between mt-3 md:mt-4 px-3 md:px-4 py-2">
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#C1E2A4] flex items-center justify-center font-bold text-slate-800 text-[10px] md:text-xs">
                F
              </div>
              <span className="text-xs md:text-sm font-medium text-slate-900">Fulana</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-slate-700 p-1 rounded transition cursor-pointer"
              title="Encerrar Sessão Segura"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main viewport Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen md:ml-64 w-full relative">
        
        {/* Header navigation controller */}
        <header className="sticky top-0 z-10 h-16 md:h-20 border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 bg-white/80 backdrop-blur-md shrink-0 transition-all">
          
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Small screen menu triggers */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-1.5 -ml-1.5 mr-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="font-serif font-bold text-lg text-[#192F28]">cleanmind.</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            
            <button
              onClick={() => handleNavigateWithParams('alertas')}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full border transition-all flex items-center space-x-2 cursor-pointer shadow-sm group ${
                hasAlerts 
                  ? 'border-red-200 bg-red-600 hover:bg-red-700 text-white focus:ring-4 focus:ring-red-100 shadow-md animate-pulse' 
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-[#192F28]'
              }`}
              title={hasAlerts ? "Você possui alertas clínicos pendentes" : "Nenhum alerta pendente"}
            >
              <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 group-hover:scale-110 transition-transform ${hasAlerts ? 'text-white' : 'text-[#192F28]'}`} />
              <span className="hidden sm:inline">ALERTA CLÍNICO</span>
              <span className="sm:hidden">ALERTA</span>
            </button>

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
            <Settings />
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
