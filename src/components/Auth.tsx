import React, { useState } from 'react';
import { Mail, Lock, User, Phone as PhoneIcon, ArrowRight, CornerDownRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Doctor, dataManager } from '../data';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { maskPhone } from '../utils/masks';

interface AuthProps {
  onAuthSuccess: (doctor: Doctor) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showVerification, setShowVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Login Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register Fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { user } = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      
      const doctors = dataManager.getDoctors();
      const doc = doctors.find(d => d.email === user.email);

      setLoading(false);

      let currentDoc = doc;
      if (!currentDoc) {
        // Se autenticou no firebase mas não tem na lista local
        currentDoc = {
          id: user.uid,
          name: user.displayName || 'Médico',
          email: user.email || '',
          crp_crm: '',
          specialty: '',
          is_configured: false,
          created_at: new Date().toISOString()
        };
        dataManager.saveDoctor(currentDoc);
      }
      
      await dataManager.pullFromFirestore(currentDoc.id);
      
      setLoading(false);
      onAuthSuccess(currentDoc);
    } catch (e: any) {
      setLoading(false);
      setErrorMsg('Credenciais inválidas. Verifique seu e-mail e tente novamente.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPhone || !regPassword) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { user } = await createUserWithEmailAndPassword(auth, regEmail, regPassword);

      const doctors = dataManager.getDoctors();
      const newDoc: Doctor = {
        id: user.uid,
        name: regName,
        email: regEmail,
        phone: regPhone,
        crp_crm: '',
        specialty: '',
        is_configured: false,
        created_at: new Date().toISOString()
      };

      dataManager.saveDoctor(newDoc);

      await dataManager.pullFromFirestore(newDoc.id);

      setLoading(false);
      onAuthSuccess(newDoc);
    } catch (e: any) {
      setLoading(false);
      if (e.code === 'auth/email-already-in-use') {
        setErrorMsg('Este e-mail já está em uso.');
      } else if (e.code === 'auth/weak-password') {
        setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      } else if (e.code === 'auth/invalid-email') {
        setErrorMsg('E-mail inválido.');
      } else if (e.code === 'auth/operation-not-allowed') {
        setErrorMsg('Login por e-mail/senha não está habilitado no Firebase.');
      } else {
        setErrorMsg(`Erro: ${e.message || 'Falha interna'}`);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const doctors = dataManager.getDoctors();
      let doc = doctors.find(d => d.email === user.email);

      if (!doc) {
        doc = {
          id: user.uid,
          name: user.displayName || 'Médico',
          email: user.email || '',
          crp_crm: '',
          specialty: '',
          is_configured: false,
          created_at: new Date().toISOString()
        };
        dataManager.saveDoctor(doc);
      }

      await dataManager.pullFromFirestore(doc.id);

      onAuthSuccess(doc);
      setLoading(false);
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Erro ao fazer login com o Google.');
      setLoading(false);
    }
  };

  const GoogleLogo = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        
        {/* Logo Area */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-700 flex items-center justify-center text-white font-serif font-bold text-2xl shadow-xl mb-4">
            C
          </div>
          <h1 className="text-3xl font-serif font-semibold text-slate-900 tracking-tight">CleanMind</h1>
          <p className="text-slate-500 font-mono text-xs mt-2 tracking-wide uppercase">Software Médico de Alto Padrão</p>
        </div>

        {/* Main Box */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
          
          {showVerification ? (
            <div className="p-8 sm:p-10 flex flex-col items-center text-center animate-fade-in">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-serif text-slate-900 font-medium mb-3">Verifique seu e-mail</h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-8">
                Enviamos um link de verificação para <strong className="text-slate-900">{regEmail}</strong>. 
                Por favor, clique no link recebido para concluir o seu cadastro.
              </p>
              
              <button
                onClick={() => {
                  setShowVerification(false);
                  setActiveTab('login');
                }}
                className="text-sm text-emerald-700 hover:text-emerald-800 font-medium transition-colors"
              >
                Voltar para o Login
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
                  className={`flex-1 py-5 text-sm font-medium transition-colors relative ${
                    activeTab === 'login' ? 'text-emerald-800' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Fazer Login
                  {activeTab === 'login' && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600" />
                  )}
                </button>
                <button
                  onClick={() => { setActiveTab('register'); setErrorMsg(''); }}
                  className={`flex-1 py-5 text-sm font-medium transition-colors relative ${
                    activeTab === 'register' ? 'text-emerald-800' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Cadastrar-se
                  {activeTab === 'register' && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600" />
                  )}
                </button>
              </div>

              {/* Form Content */}
              <div className="p-8 sm:p-10 relative">
                {activeTab === 'login' ? (
                  <div key="login" className="animate-fade-in space-y-6">
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">E-mail</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input
                            type="email"
                            required
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="seu@email.com"
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-800 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Senha</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input
                            type="password"
                            required
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-800 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end mt-1">
                        <a href="#" className="text-xs text-slate-500 hover:text-emerald-700 hover:underline transition-colors">
                          Esqueceu sua senha?
                        </a>
                      </div>

                      {errorMsg && (
                        <div className="flex items-center space-x-2 text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-lg border border-red-200">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <span>Entrar no Consultório</span>
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    <div className="relative flex items-center py-2 mt-4">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="flex-shrink-0 mx-4 text-xs text-slate-400">ou</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <GoogleLogo />
                        Fazer login com o Google
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key="register" className="animate-fade-in space-y-6">
                    <form onSubmit={handleRegisterSubmit} className="space-y-4">
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Nome completo</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="Dr. Nome Sobrenome"
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-800 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">E-mail</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input
                            type="email"
                            required
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="seu@email.com"
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-800 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Telefone</label>
                        <div className="relative">
                          <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={regPhone}
                            onChange={(e) => setRegPhone(maskPhone(e.target.value))}
                            placeholder="(00) 00000-0000"
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-800 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Senha</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input
                            type="password"
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-800 placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                      
                      {errorMsg && (
                        <div className="flex items-center space-x-2 text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-lg border border-red-200">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      <div className="pt-4">
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <span>Continuar</span>
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      </div>

                      <div className="relative flex items-center py-2 mt-4">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-slate-400">ou</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                      </div>

                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={handleGoogleSignIn}
                          disabled={loading}
                          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          <GoogleLogo />
                          Cadastrar com o Google
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-400 text-center px-4 mt-4 leading-relaxed">
                        Ao se cadastrar, você concorda com nossos Termos de Uso e Política de Privacidade da LGPD.
                      </p>
                    </form>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        <div className="text-center mt-8 text-slate-400 text-xs font-mono">
          © 2026 CleanMind Ltda. SRES Registro Eletrônico Licenciado.
        </div>
      </div>
    </div>
  );
}
