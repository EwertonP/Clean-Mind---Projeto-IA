import React, { useState } from 'react';
import { Mail, Lock, User, Phone as PhoneIcon, ArrowRight, CornerDownRight, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Doctor, Patient, dataManager } from '../data';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { maskPhone } from '../utils/masks';

interface AuthProps {
  onAuthSuccess: (doctor: Doctor) => void;
  onPatientAuthSuccess?: (patient: Patient) => void;
}

export default function Auth({ onAuthSuccess, onPatientAuthSuccess }: AuthProps) {
  type AuthTab = 'login' | 'register' | 'forgot_password' | 'verify_reset_code' | 'reset_password';
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [showVerification, setShowVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Login Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Register Fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Password Recovery Fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState(['', '', '', '', '', '']);
  const [generatedResetCode, setGeneratedResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);


  // Verification
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyCode = params.get('verify');
    const emailParam = params.get('email');
    const inviteParam = params.get('invite');
    const nameParam = params.get('name');
    
    if (inviteParam === 'true' && emailParam) {
      setActiveTab('register');
      setRegEmail(emailParam);
      if (nameParam) setRegName(nameParam);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (verifyCode && emailParam) {
      setVerificationEmail(emailParam);
      setShowVerification(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      
      handleVerifyCodeAuto(emailParam, verifyCode);
    }
  }, []);

  const handleVerifyCodeAuto = async (email: string, code: string) => {
    setIsVerifyingCode(true);
    setErrorMsg('');
    try {
      const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const q = query(collection(db, 'doctors'), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Usuário não encontrado.');
      }
      
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      
      if (data.verification_code === code) {
        await updateDoc(docSnap.ref, { is_verified: true });
        
        const updatedDoc = { ...data, is_verified: true, id: docSnap.id } as Doctor;
        
        const docs = dataManager.getDoctors();
        const idx = docs.findIndex(d => d.id === updatedDoc.id);
        if (idx >= 0) docs[idx] = updatedDoc;
        else docs.push(updatedDoc);
        dataManager.saveDoctors(docs);

        localStorage.setItem('cm_doctor_session', updatedDoc.id);
        
        setShowVerification(false);
        setIsVerifyingCode(false);
        onAuthSuccess(updatedDoc);
      } else {
        throw new Error('Link de verificação inválido ou expirado.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Falha ao verificar link.');
      setIsVerifyingCode(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    setLoading(true);
    setErrorMsg('');

    try {
      // Patient CPF Login Bypass
      const rawInput = loginEmail.replace(/\D/g, '');
      if (rawInput.length === 11) {
        
        let patient = undefined;
        // Try local first
        try {
          const patients = dataManager.getPatients();
          patient = patients.find(p => {
            if (!p.cpf) return false;
            return p.cpf.replace(/\D/g, '') === rawInput;
          });
        } catch (e) {
          console.error(e);
        }
        
        // If not found locally, query firestore
        if (!patient) {
          try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            
            // Re-apply mask to match how it's stored
            let maskedCpf = rawInput;
            maskedCpf = maskedCpf.replace(/(\d{3})(\d)/, '$1.$2');
            maskedCpf = maskedCpf.replace(/(\d{3})(\d)/, '$1.$2');
            maskedCpf = maskedCpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            
            const q = query(
              collection(db, 'patients'), 
              where('cpf', 'in', [rawInput, maskedCpf])
            );
            
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              patient = snapshot.docs[0].data() as Patient;
            }
          } catch (err) {
            console.error("Failed to fetch patient from firestore", err);
          }
        }

        if (patient) {
          if (loginPassword === rawInput || loginPassword === patient.cpf) {
            setLoading(false);
            if (onPatientAuthSuccess) onPatientAuthSuccess(patient);
            return;
          } else {
            setLoading(false);
            setErrorMsg('Senha incorreta para este CPF.');
            return;
          }
        } else {
          // If 11 digits were typed but no patient found, it might still be a regular email login fail
          // or we can just fall through and let Firebase auth handle it and fail as "invalid email".
          // We will fall through to let standard Auth give the error.
        }
      }

      // Hardcoded Agency Bypass
      const normalizedEmail = loginEmail.trim().toLowerCase();
      if (normalizedEmail === 'ewertonphillipe18@gmail.com' && (loginPassword === 'celanmindadmin' || loginPassword === 'cleanmindadmin')) {
        const agencyDoc: Doctor = {
          id: 'agency-admin-123',
          name: 'CleanMind Agency',
          email: 'ewertonphillipe18@gmail.com',
          crp_crm: '',
          specialty: '',
          role: 'agency',
          is_configured: true,
          is_verified: true,
          created_at: new Date().toISOString()
        };
        
        const docs = dataManager.getDoctors();
        const idx = docs.findIndex(d => d.id === agencyDoc.id);
        if (idx >= 0) docs[idx] = agencyDoc;
        else docs.push(agencyDoc);
        dataManager.saveDoctors(docs);

        localStorage.setItem('cm_doctor_session', agencyDoc.id);
        
        setLoading(false);
        onAuthSuccess(agencyDoc);
        return;
      }

      const { user } = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const docRef = await getDoc(doc(db, 'doctors', user.uid));
      let currentDoc = docRef.exists() ? (docRef.data() as Doctor) : null;

      if (currentDoc && currentDoc.is_verified === false) {
        setLoading(false);
        setVerificationEmail(loginEmail);
        setShowVerification(true);
        await signOut(auth);
        return;
      }

      if (!currentDoc) {
        // Se autenticou no firebase mas não tem documento
        const isAgency = user.email === 'ewertonphillipe18@gmail.com';
        currentDoc = {
          id: user.uid,
          name: user.displayName || (isAgency ? 'CleanMind Agency' : 'Administrador'),
          email: user.email || '',
          crp_crm: '',
          specialty: '',
          role: isAgency ? 'agency' : 'admin',
          is_configured: isAgency ? true : false,
          is_verified: isAgency ? true : false,
          created_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'doctors', user.uid), currentDoc);
      }
      
      const docs = dataManager.getDoctors();
      const idx = docs.findIndex(d => d.id === currentDoc.id);
      if (idx >= 0) docs[idx] = currentDoc;
      else docs.push(currentDoc);
      dataManager.saveDoctors(docs);

      localStorage.setItem('cm_doctor_session', currentDoc.id);
      
      setLoading(false);
      onAuthSuccess(currentDoc);
    } catch (e: any) {
      setLoading(false);
      if (e?.message?.includes('offline')) {
        setErrorMsg('O Firestore não foi inicializado. Crie o Firestore Database no painel do Firebase.');
      } else {
        setErrorMsg('Credenciais inválidas. Verifique seu e-mail e tente novamente.');
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { user } = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      const isAgency = regEmail === 'ewertonphillipe18@gmail.com';
      const newDoc: Doctor = {
        id: user.uid,
        name: isAgency ? 'CleanMind Agency' : regName,
        email: regEmail,
        phone: '',
        crp_crm: '',
        specialty: '',
        role: isAgency ? 'agency' : 'admin',
        is_configured: isAgency ? true : false,
        is_verified: isAgency ? true : false,
        verification_code: verificationCode,
        created_at: new Date().toISOString()
      };

      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await setDoc(doc(db, 'doctors', user.uid), newDoc);

      const verifyLink = `${window.location.origin}?verify=${verificationCode}&email=${encodeURIComponent(regEmail)}`;
      
      try {
        await fetch('/api/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: regEmail, code: verificationCode, link: verifyLink, name: regName })
        });
      } catch (err) {
        console.error('Falha ao enviar e-mail:', err);
      }

      setLoading(false);
      setVerificationEmail(regEmail);
      setShowVerification(true);
      await signOut(auth);
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
      } else if (e?.message?.includes('offline')) {
        setErrorMsg('O Firestore não foi inicializado. Crie o Firestore Database no painel do Firebase.');
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

      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const docRef = await getDoc(doc(db, 'doctors', user.uid));
      let currentDoc = docRef.exists() ? (docRef.data() as Doctor) : null;

      if (!currentDoc) {
        const isAgency = user.email === 'ewertonphillipe18@gmail.com';
        currentDoc = {
          id: user.uid,
          name: user.displayName || (isAgency ? 'CleanMind Agency' : 'Administrador'),
          email: user.email || '',
          crp_crm: '',
          specialty: '',
          role: isAgency ? 'agency' : 'admin',
          is_configured: isAgency ? true : false,
          is_verified: isAgency ? true : false,
          created_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'doctors', user.uid), currentDoc);
      }
      
      const docs = dataManager.getDoctors();
      const idx = docs.findIndex(d => d.id === currentDoc.id);
      if (idx >= 0) docs[idx] = currentDoc;
      else docs.push(currentDoc);
      dataManager.saveDoctors(docs);

      localStorage.setItem('cm_doctor_session', currentDoc.id);

      onAuthSuccess(currentDoc);
      setLoading(false);
    } catch (e: any) {
      if (e?.message?.includes('offline')) {
        setErrorMsg('O Firestore não foi inicializado. Crie o Firestore Database no painel do Firebase.');
      } else {
        console.error(e);
        setErrorMsg('Erro ao fazer login com o Google.');
      }
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setErrorMsg('Por favor, informe seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedResetCode(code);
      
      const response = await fetch('/api/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, code }),
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar e-mail');
      }

      setLoading(false);
      setActiveTab('verify_reset_code');
      setErrorMsg('');
      
      // Fallback for AI Studio preview environment: Resend free tier only sends to the verified account owner email.
      // So we show the code in an alert in development so the user isn't blocked from testing the flow.
      alert(`Código enviado!\n(Se não chegar no e-mail por restrições do plano gratuito do Resend, use este código para testar: ${code})`);

    } catch (error) {
      console.error(error);
      setErrorMsg('Erro ao enviar e-mail. Verifique se o backend está configurado corretamente.');
      setLoading(false);
    }
  };

  const handleVerifyResetCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = resetCode.join('');
    if (code !== generatedResetCode) {
      setErrorMsg('Código incorreto. Tente novamente.');
      return;
    }
    setErrorMsg('');
    setActiveTab('reset_password');
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert('Simulação: Senha redefinida com sucesso!');
      setActiveTab('login');
      setResetEmail('');
      setResetCode(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmNewPassword('');
    }, 1000);
  };
  
  const handleResetCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...resetCode];
    newCode[index] = value;
    setResetCode(newCode);
    
    if (value && index < 5) {
      const nextInput = document.getElementById(`reset-code-${index + 1}`);
      nextInput?.focus();
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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-[1000px] bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col md:flex-row h-auto md:h-[650px]">
        
        {/* Left Column - Image */}
        <div className="hidden md:block md:w-1/2 relative bg-[#1E3029]">
          <div className="w-full h-full overflow-hidden relative">
            <img 
               src="/tela%20de%20login.png" 
               alt="CleanMind" 
               className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Render the image uploaded by the user */}
          </div>
        </div>

        {/* Right Column - Form */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center bg-white relative overflow-y-auto overflow-x-hidden">
          
          <div className="max-w-sm w-full mx-auto my-auto">
            {showVerification ? (
              <div className="flex flex-col items-center text-center animate-fade-in">
                <div className="w-16 h-16 bg-status-success/20 text-brand-primary rounded-full flex items-center justify-center mb-6">
                  {isVerifyingCode ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Mail className="w-8 h-8" />
                  )}
                </div>
                <h2 className="text-2xl font-serif text-slate-900 font-medium mb-3">
                  {isVerifyingCode ? 'Verificando...' : 'Verifique seu e-mail'}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Enviamos um e-mail de verificação para <strong className="text-slate-900">{verificationEmail}</strong>. <br/><br/>
                  Por favor, clique no botão enviado no seu e-mail para validar seu acesso.
                </p>

                {errorMsg && (
                  <div className="w-full p-3 mb-6 bg-rose-50 text-rose-600 text-sm font-medium rounded-xl flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {errorMsg}
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setShowVerification(false);
                    setActiveTab('login');
                  }}
                  className="w-full h-12 border border-status-success/50 text-brand-primary hover:bg-status-success/20 font-medium rounded-xl transition-all flex items-center justify-center mb-4"
                >
                  Voltar para o Login
                </button>
              </div>
            ) : activeTab === 'login' ? (
              <div key="login" className="animate-fade-in space-y-6">
                <div>
                  <h2 className="text-[28px] font-semibold text-slate-900 tracking-tight leading-tight mb-2">
                    Acesso à sua conta
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Gerencie agendas, acompanhe seus pacientes, verifique alertas clínicos e acesse resumos diários de onde estiver.
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Email ou CPF <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="seu@email.com ou 000.000.000-00"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-sm text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Senha <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Digite sua senha"
                        className="w-full pl-4 pr-11 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-sm text-slate-900 placeholder:text-slate-400 font-medium"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      >
                        {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => { setActiveTab('forgot_password'); setErrorMsg(''); }}
                      className="text-sm font-medium text-[#7fb742] hover:text-[#6a9a37] transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#1e201b] hover:bg-black text-white py-3.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <span>Login</span>
                      )}
                    </button>
                  </div>
                </form>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-medium uppercase tracking-wider">ou</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <GoogleLogo />
                    Continuar com o Google
                  </button>
                </div>

                <div className="text-center pt-2">
                  <span className="text-sm text-slate-500">
                    Ainda não tem uma conta?{' '}
                    <button 
                      onClick={() => { setActiveTab('register'); setErrorMsg(''); }}
                      className="font-medium text-[#7fb742] hover:text-[#6a9a37] transition-colors"
                    >
                      Criar uma conta
                    </button>
                  </span>
                </div>

              </div>
            ) : activeTab === 'register' ? (
              <div key="register" className="animate-fade-in space-y-4">
                 <div>
                  <h2 className="text-[28px] font-semibold text-slate-900 tracking-tight leading-tight mb-2">
                    Nova conta
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Crie sua conta para começar a gerenciar seus pacientes e usar nossos recursos.
                  </p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Nome completo <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-sm text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="Seu e-mail"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-sm text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Senha <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Crie uma senha forte"
                        className="w-full pl-4 pr-11 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-sm text-slate-900 placeholder:text-slate-400 font-medium"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      >
                        {showRegPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#1e201b] hover:bg-black text-white py-3.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <span>Criar conta</span>
                      )}
                    </button>
                  </div>
                </form>

                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-medium uppercase tracking-wider">ou</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <GoogleLogo />
                    Continuar com o Google
                  </button>
                </div>

                <div className="text-center pt-2 pb-4">
                  <span className="text-sm text-slate-500">
                    Já tem uma conta?{' '}
                    <button 
                      onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
                      className="font-medium text-[#7fb742] hover:text-[#6a9a37] transition-colors"
                    >
                      Fazer login
                    </button>
                  </span>
                </div>
              </div>
            ) : activeTab === 'forgot_password' ? (
              <div key="forgot_password" className="animate-fade-in space-y-6">
                <div>
                  <button 
                    onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
                    className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors mb-6"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para o login
                  </button>
                  <h2 className="text-[28px] font-semibold text-slate-900 tracking-tight leading-tight mb-2">
                    Esqueceu a senha?
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Digite o e-mail associado à sua conta. Enviaremos um código de 6 dígitos para você redefinir sua senha.
                  </p>
                </div>

                <form onSubmit={handleForgotPasswordRequest} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Digite seu e-mail"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-sm text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                  </div>

                  {errorMsg && (
                    <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#1e201b] hover:bg-black text-white py-3.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <span>Enviar código</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : activeTab === 'verify_reset_code' ? (
              <div key="verify_reset_code" className="animate-fade-in space-y-6">
                <div>
                  <button 
                    onClick={() => { setActiveTab('login'); setErrorMsg(''); setResetCode(['', '', '', '', '', '']); }}
                    className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors mb-6"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para o login
                  </button>
                  <h2 className="text-[28px] font-semibold text-slate-900 tracking-tight leading-tight mb-2">
                    Digite o código
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Insira o código de 6 dígitos que enviamos para <span className="font-semibold">{resetEmail}</span>.
                  </p>
                </div>

                <form onSubmit={handleVerifyResetCode} className="space-y-5">
                  <div className="flex justify-between max-w-xs mx-auto mb-6">
                    {resetCode.map((digit, index) => (
                      <input
                        key={index}
                        id={`reset-code-${index}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleResetCodeChange(index, e.target.value)}
                        className="w-10 h-10 sm:w-12 sm:h-12 text-center text-xl font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-status-success transition-all"
                      />
                    ))}
                  </div>

                  {errorMsg && (
                    <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200 mt-4">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || resetCode.some(d => d === '')}
                      className="w-full bg-[#1e201b] hover:bg-black text-white py-3.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      Verificar código
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div key="reset_password" className="animate-fade-in space-y-6">
                <div>
                  <button 
                    onClick={() => { setActiveTab('login'); setErrorMsg(''); setResetEmail(''); setResetCode(['', '', '', '', '', '']); setNewPassword(''); setConfirmNewPassword(''); }}
                    className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors mb-6"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para o login
                  </button>
                  <h2 className="text-[28px] font-semibold text-slate-900 tracking-tight leading-tight mb-2">
                    Nova senha
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Crie uma nova senha para sua conta e comece a usá-la imediatamente.
                  </p>
                </div>

                <form onSubmit={handleResetPasswordSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Nova Senha <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-4 pr-11 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-sm text-slate-900 placeholder:text-slate-400 font-medium"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Confirme a Senha <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showConfirmNewPassword ? "text" : "password"}
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        className="w-full pl-4 pr-11 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-sm text-slate-900 placeholder:text-slate-400 font-medium"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      >
                        {showConfirmNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#1e201b] hover:bg-black text-white py-3.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <span>Redefinir Senha</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
