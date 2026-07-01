import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Building2, Settings2, Link as LinkIcon, Mail, Calendar, MessageSquare, MapPin, Building, CalendarIcon as CalendarDays, Phone, Globe, UploadCloud, Trash2 } from 'lucide-react';
import { connectGoogleCalendar, isGoogleCalendarConnected, disconnectGoogleCalendar } from '../googleCalendar';
import { dataManager, compressImage } from '../data';
import { useStore } from '../store';
import { maskCNPJ, maskDate, maskPhone, maskCEP } from '../utils/masks';
import { getStates, getCities, fetchAddressByCep, IBGEState, IBGECity } from '../utils/ibge';

const timeOptions = Array.from({ length: 24 * 2 }).map((_, idx) => {
  const hour = Math.floor(idx / 2).toString().padStart(2, '0');
  const minute = idx % 2 === 0 ? '00' : '30';
  return `${hour}:${minute}`;
});

export default function Settings({ onRefreshDashboard }: { onRefreshDashboard?: () => void }) {
  const sessionId = localStorage.getItem('cm_doctor_session');
  const doctorsStore = useStore(state => state.doctors);
  const doc = doctorsStore.find(d => d.id === sessionId) || dataManager.getDoctor();
  
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'integrations' | 'whatsapp'>('profile');
  const [googleConnected, setGoogleConnected] = useState(isGoogleCalendarConnected());
  const [isEditing, setIsEditing] = useState(doc?.is_configured === false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Clinic profile state
  const [profileData, setProfileData] = useState(() => {
    return {
      name: doc?.clinic_name || '',
      logo: doc?.clinic_logo || '',
      specialty: doc?.specialty || '',
      patients: '47',
      professionals: '3',
      numberOfRooms: doc?.clinic_rooms?.length.toString() || '',
      description: doc?.clinic_description || '',
      cnpj: doc?.clinic_cnpj || '',
      founded: doc?.clinic_founded || '',
      address: doc?.clinic_street || '',
      neighborhood: doc?.clinic_neighborhood || '',
      zip: doc?.clinic_zip || '',
      city: doc?.clinic_city || '',
      state: doc?.clinic_state || '',
      phone: doc?.phone || '',
      email: doc?.email || '',
      website: doc?.clinic_website || '',
      consultationPrice: doc?.consultation_price?.toString() || '',
      businessHoursStart: doc?.business_hours?.start || '',
      businessHoursEnd: doc?.business_hours?.end || '',
      businessDays: doc?.business_hours?.days || '',
      custom_signature: doc?.custom_signature || ''
    };
  });

  const [statesList, setStatesList] = useState<IBGEState[]>([]);
  const [citiesList, setCitiesList] = useState<IBGECity[]>([]);

  useEffect(() => {
    getStates().then(setStatesList);
  }, []);

  useEffect(() => {
    if (profileData.state) {
      getCities(profileData.state).then(setCitiesList);
    } else {
      setCitiesList([]);
    }
  }, [profileData.state]);

  // Auto-save draft when editing initial configuration
  useEffect(() => {
    if (doc?.is_configured !== false) return;
    
    // Only run if there is some data to save
    if (!profileData.name && !profileData.cnpj && !profileData.phone) return;

    const timeout = setTimeout(() => {
      if (sessionId && doc) {
        const roomsNum = parseInt(profileData.numberOfRooms, 10) || 1;
        const draftDoc = { ...doc };
        draftDoc.clinic_name = profileData.name;
        draftDoc.clinic_logo = profileData.logo;
        draftDoc.specialty = profileData.specialty;
        draftDoc.clinic_description = profileData.description;
        draftDoc.clinic_cnpj = profileData.cnpj;
        draftDoc.clinic_founded = profileData.founded;
        draftDoc.clinic_street = profileData.address;
        draftDoc.clinic_neighborhood = profileData.neighborhood;
        draftDoc.clinic_zip = profileData.zip;
        draftDoc.clinic_city = profileData.city;
        draftDoc.clinic_state = profileData.state;
        draftDoc.phone = profileData.phone;
        draftDoc.email = profileData.email;
        draftDoc.clinic_website = profileData.website;
        draftDoc.clinic_address = `${profileData.address}, ${profileData.neighborhood} - ${profileData.city}/${profileData.state} - CEP: ${profileData.zip}`;
        draftDoc.custom_signature = profileData.custom_signature;
        draftDoc.consultation_price = profileData.consultationPrice ? parseFloat(profileData.consultationPrice.replace(',', '.')) : undefined;
        draftDoc.clinic_rooms = Array.from({length: roomsNum}, (_, i) => `Sala ${i + 1}`);
        draftDoc.business_hours = {
          start: profileData.businessHoursStart,
          end: profileData.businessHoursEnd,
          days: profileData.businessDays
        };
        // DO NOT set is_configured = true here. It remains a draft until explicit save.
        dataManager.saveDoctor(draftDoc);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [profileData]); // only depend on profileData to avoid loop with doc

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let { name, value } = e.target;
    if (name === 'cnpj') value = maskCNPJ(value);
    if (name === 'founded') value = maskDate(value);
    if (name === 'zip') value = maskCEP(value);
    if (name === 'phone') value = maskPhone(value);
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleCEPBlur = async () => {
    if (profileData.zip.length === 9) {
      const data = await fetchAddressByCep(profileData.zip);
      if (data) {
        setProfileData(prev => ({
          ...prev,
          address: data.street || prev.address,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
          state: data.state || prev.state,
        }));
      }
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setProfileData(prev => ({ ...prev, logo: compressed }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    // Validate required fields
    const requiredFields = [
      'name', 'specialty', 'numberOfRooms', 'description', 'cnpj', 'founded',
      'address', 'neighborhood', 'zip', 'city', 'state', 'phone', 'email',
      'website', 'businessHoursStart', 'businessHoursEnd', 'businessDays'
    ];

    const missingFields = requiredFields.filter(field => !profileData[field as keyof typeof profileData]);

    if (missingFields.length > 0) {
      setValidationErrors(missingFields);
      alert('Por favor, preencha todas as informações do perfil da clínica para prosseguir.');
      return;
    }

    setValidationErrors([]);
    setIsEditing(false);
    // Em um app real, os dados do profile seriam salvos globalmente.
    // Aqui sincronizamos as salas pro doctor logado para a Agenda reconhecer:
    if (sessionId) {
      const doc = doctorsStore.find(d => d.id === sessionId) || dataManager.getDoctor();
      if (doc) {
        const roomsNum = parseInt(profileData.numberOfRooms, 10) || 1;
        doc.clinic_name = profileData.name;
        doc.clinic_logo = profileData.logo;
        doc.specialty = profileData.specialty;
        doc.clinic_description = profileData.description;
        doc.clinic_cnpj = profileData.cnpj;
        doc.clinic_founded = profileData.founded;
        doc.clinic_street = profileData.address;
        doc.clinic_neighborhood = profileData.neighborhood;
        doc.clinic_zip = profileData.zip;
        doc.clinic_city = profileData.city;
        doc.clinic_state = profileData.state;
        doc.phone = profileData.phone;
        doc.email = profileData.email;
        doc.clinic_website = profileData.website;
        doc.clinic_address = `${profileData.address}, ${profileData.neighborhood} - ${profileData.city}/${profileData.state} - CEP: ${profileData.zip}`;
        doc.custom_signature = profileData.custom_signature;
        doc.consultation_price = profileData.consultationPrice ? parseFloat(profileData.consultationPrice.replace(',', '.')) : undefined;
        doc.clinic_rooms = Array.from({length: roomsNum}, (_, i) => `Sala ${i + 1}`);
        doc.business_hours = {
          start: profileData.businessHoursStart,
          end: profileData.businessHoursEnd,
          days: profileData.businessDays
        };
        doc.is_configured = true;
        dataManager.saveDoctor(doc);
        
        if (onRefreshDashboard) {
          onRefreshDashboard();
        }
      }
    }
    alert('Configurações salvas da Clínica One atualizadas com sucesso!');
    window.location.reload();
  };

  const handleConnectGoogle = async () => {
    try {
      const result = await connectGoogleCalendar();
      if (result) {
        setGoogleConnected(true);
      }
    } catch (error: any) {
      console.error(error);
      if (error?.code !== 'auth/popup-closed-by-user' && error?.message?.indexOf('popup-closed-by-user') === -1) {
        alert('Houve um erro ao tentar conectar com a conta Google. Verifique o console.');
      }
    }
  };

  const handleDisconnectGoogle = () => {
    disconnectGoogleCalendar();
    setGoogleConnected(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-monique font-normal text-creative-green flex items-center gap-3 pb-1">
            <Settings2 className="h-8 w-8 text-creative-green shrink-0" />
            <span>Configurações</span>
          </h1>
          <p className="text-[15px] font-medium text-slate-500 mt-1">Gerencie as informações da clínica e integrações de ferramentas.</p>
        </div>
      </div>

      {doc?.is_configured === false && (
        <div className="bg-brand-primary border border-brand-primary rounded-2xl p-6 text-white shadow-sm">
          <h2 className="text-xl font-bold mb-2">Bem-vindo(a) ao Cleanmind!</h2>
          <p className="text-sm text-white/80">
            Para liberar o acesso completo a todas as funcionalidades do sistema (Dashboard, Agenda, Financeiro e Prontuários), por favor preencha as informações básicas da sua clínica abaixo. 
            Não se preocupe, você poderá alterar esses dados a qualquer momento.
          </p>
        </div>
      )}

      {/* Tabs */}
      {doc?.is_configured !== false && (
        <div className="flex items-center space-x-4 border-b border-slate-200">
          <button
            onClick={() => setActiveSubTab('profile')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 cursor-pointer flex items-center space-x-2 ${
              activeSubTab === 'profile' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Perfil da Clínica</span>
          </button>
          <button
            onClick={() => setActiveSubTab('integrations')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 cursor-pointer flex items-center space-x-2 ${
              activeSubTab === 'integrations' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Integrações</span>
          </button>
          <button
            onClick={() => setActiveSubTab('whatsapp')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 cursor-pointer flex items-center space-x-2 ${
              activeSubTab === 'whatsapp' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeSubTab === 'profile' && (
          <div className="space-y-6">
             {/* Box 1: Cabeçalho da Clínica */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-start gap-4">
                <div className="w-20 h-20 bg-status-success rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                  {profileData.logo ? (
                    <img src={profileData.logo} alt="Logo da Clínica" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-10 h-10 text-slate-800" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      {isEditing ? (
                        <input type="text" name="name" value={profileData.name} onChange={handleChange} placeholder="Nome da Clínica" className={`text-2xl font-bold text-slate-900 border rounded px-2 py-1 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-status-success ${validationErrors.includes('name') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                      ) : (
                        <h2 className="text-2xl font-bold text-slate-900">{profileData.name || 'Nome da Clínica'}</h2>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="inline-flex items-center space-x-1 bg-status-success/20 text-brand-primary px-3 py-1 rounded-full text-xs font-semibold border border-status-success/50">
                          <Building className="w-3 h-3" />
                          <span>{profileData.specialty}</span>
                        </span>
                        <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-100">
                          <MessageSquare className="w-3 h-3" />
                          <span>{profileData.patients} Pacientes</span>
                        </span>
                        <span className="inline-flex items-center space-x-1 bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold border border-orange-100">
                          <Building2 className="w-3 h-3" />
                          <span>{profileData.professionals} Profissionais</span>
                        </span>
                      </div>
                    </div>
                    {isEditing ? (
                      <button onClick={handleSave} className="px-4 py-2 bg-slate-900 border border-transparent rounded-lg text-sm font-medium hover:bg-slate-800 text-white transition cursor-pointer">
                        Salvar Alterações
                      </button>
                    ) : (
                      <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-700 transition cursor-pointer">
                        Editar Perfil
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <textarea name="description" value={profileData.description} onChange={handleChange} rows={3} placeholder="Descreva sua clínica..." className={`text-sm text-slate-700 mt-4 leading-relaxed w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-status-success ${validationErrors.includes('description') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                  ) : (
                    <p className="text-sm text-slate-600 mt-4 leading-relaxed max-w-3xl">
                      {profileData.description || 'Nenhuma descrição adicionada.'}
                    </p>
                  )}
                </div>
             </div>

             {/* Box 1.5: Logo da Clínica */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-2">Logo da Clínica</h3>
                <p className="text-sm text-slate-500 mb-6">Esta logo será exibida no cabeçalho dos prontuários e documentos impressos.</p>
                
                {isEditing ? (
                  <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-brand-primary transition-colors cursor-pointer group">
                    <div className="w-12 h-12 bg-brand-primary/5 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-6 h-6 text-brand-primary" />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">Clique para enviar uma logo</span>
                    <span className="text-xs text-slate-500 mt-1">PNG, JPG ou SVG (Máx. 2MB)</span>
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  </label>
                ) : (
                  profileData.logo ? (
                    <div className="relative inline-block border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <img src={profileData.logo} alt="Logo da clínica" className="max-h-24 w-auto object-contain" />
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl p-8 flex flex-col items-center text-slate-400 bg-slate-50">
                      <Building2 className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm font-medium">Nenhuma logo configurada</span>
                    </div>
                  )
                )}
             </div>

             {/* Box 2: Informações Básicas */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-6">Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">CNPJ</span>
                    {isEditing ? (
                      <input type="text" name="cnpj" value={profileData.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('cnpj') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.cnpj || '00.000.000/0000-00'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Data de Fundação</span>
                    {isEditing ? (
                      <input type="text" name="founded" value={profileData.founded} onChange={handleChange} placeholder="DD/MM/AAAA" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('founded') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900 flex items-center space-x-2">
                         <CalendarDays className="w-4 h-4 text-slate-400" />
                         <span>{profileData.founded || 'Não informada'}</span>
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-xs text-slate-500 font-medium block mb-1">Especialidade Principal</span>
                    {isEditing ? (
                      <input type="text" name="specialty" value={profileData.specialty} onChange={handleChange} placeholder="Sua Especialidade" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('specialty') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.specialty || 'Não definida'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Número de Salas (Atendimento Presencial)</span>
                    {isEditing ? (
                      <input type="number" min="1" name="numberOfRooms" value={profileData.numberOfRooms} onChange={handleChange} className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('numberOfRooms') ? 'border-red-500 bg-red-50 outline-none' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.numberOfRooms} Salas</p>
                    )}
                  </div>
                </div>
             </div>

             {/* Box 3: Horário de Funcionamento */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-6">Horário de Funcionamento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div className="md:col-span-2">
                    <span className="text-xs text-slate-500 font-medium block mb-1">Dias de Funcionamento</span>
                    {isEditing ? (
                      <input type="text" name="businessDays" value={profileData.businessDays} onChange={handleChange} placeholder="Ex: Segunda a Sábado" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('businessDays') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.businessDays || 'Não configurado'}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-xs text-slate-500 font-medium block mb-1">Valor da Consulta Padrão (R$)</span>
                    {isEditing ? (
                      <input type="number" step="0.01" name="consultationPrice" value={profileData.consultationPrice} onChange={handleChange} placeholder="Ex: 350.00" className="text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 border-slate-300" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.consultationPrice ? `R$ ${parseFloat(profileData.consultationPrice).toFixed(2)}` : 'Não informado'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Horário de Abertura</span>
                    {isEditing ? (
                      <select name="businessHoursStart" value={profileData.businessHoursStart} onChange={handleChange} className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 pb-1 bg-transparent ${validationErrors.includes('businessHoursStart') ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}>
                         <option value="">Selecione...</option>
                         {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.businessHoursStart || '00:00'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Horário de Fechamento</span>
                    {isEditing ? (
                      <select name="businessHoursEnd" value={profileData.businessHoursEnd} onChange={handleChange} className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 pb-1 bg-transparent ${validationErrors.includes('businessHoursEnd') ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}>
                         <option value="">Selecione...</option>
                         {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.businessHoursEnd || '00:00'}</p>
                    )}
                  </div>
                </div>
             </div>

             {/* Box 4: Endereço */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-6">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div className="md:col-span-2">
                    <span className="text-xs text-slate-500 font-medium block mb-1">Rua / Avenida</span>
                    {isEditing ? (
                      <input type="text" name="address" value={profileData.address} onChange={handleChange} placeholder="Rua / Avenida, Número" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('address') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900 flex items-center space-x-2">
                         <MapPin className="w-4 h-4 text-slate-400" />
                         <span>{profileData.address || 'Endereço não informado'}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Bairro</span>
                    {isEditing ? (
                      <input type="text" name="neighborhood" value={profileData.neighborhood} onChange={handleChange} placeholder="Bairro" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('neighborhood') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.neighborhood || 'Não informado'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">CEP</span>
                    {isEditing ? (
                      <input type="text" name="zip" value={profileData.zip} onChange={handleChange} onBlur={handleCEPBlur} placeholder="00000-000" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('zip') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.zip || '00000-000'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Estado</span>
                    {isEditing ? (
                      <select name="state" value={profileData.state} onChange={handleChange} className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 pb-1 ${validationErrors.includes('state') ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-transparent'}`}>
                        <option value="">Selecione o Estado</option>
                        {statesList.map(s => (
                          <option key={s.id} value={s.sigla}>{s.nome}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.state || 'UF'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Cidade</span>
                    {isEditing ? (
                      <select name="city" value={profileData.city} onChange={handleChange} className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 pb-1 ${validationErrors.includes('city') ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-transparent'}`} disabled={!profileData.state}>
                        <option value="">Selecione a Cidade</option>
                        {citiesList.map(c => (
                          <option key={c.id} value={c.nome}>{c.nome}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.city || 'Não informada'}</p>
                    )}
                  </div>
                </div>
             </div>

             {/* Box 4: Informações de Contato */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-6">Informações de Contato</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Telefone</span>
                    {isEditing ? (
                      <input type="text" name="phone" value={profileData.phone} onChange={handleChange} placeholder="(00) 00000-0000" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('phone') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900 flex items-center space-x-2">
                         <Phone className="w-4 h-4 text-slate-400" />
                         <span>{profileData.phone || '(00) 00000-0000'}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Email</span>
                    {isEditing ? (
                      <input type="text" name="email" value={profileData.email} onChange={handleChange} placeholder="contato@clinica.com" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('email') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900 flex items-center space-x-2">
                         <Mail className="w-4 h-4 text-slate-400" />
                         <span>{profileData.email || 'Não informado'}</span>
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-xs text-slate-500 font-medium block mb-1">Website</span>
                    {isEditing ? (
                      <input type="text" name="website" value={profileData.website} onChange={handleChange} placeholder="www.seusite.com.br" className={`text-[15px] font-medium text-slate-900 border-b w-full focus:outline-none focus:border-slate-600 ${validationErrors.includes('website') ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-slate-300'}`} />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900 flex items-center space-x-2">
                         <Globe className="w-4 h-4 text-slate-400" />
                         <span>{profileData.website || 'Site não informado'}</span>
                      </p>
                    )}
                  </div>
                </div>
             </div>

             {/* Box 5: Personalização de Documentos */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-6">Personalização de Documentos</h3>
                <div className="grid grid-cols-1 gap-y-6">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Assinatura Digital / Texto Personalizado no Rodapé</span>
                    <p className="text-xs text-slate-400 mb-2">Este texto aparecerá no rodapé dos prontuários exportados e pode incluir seu nome, CRM ou outro identificador.</p>
                    {isEditing ? (
                      <textarea name="custom_signature" value={profileData.custom_signature} onChange={handleChange} rows={3} placeholder="Ex: Assinado digitalmente por Dr. João..." className="text-[14px] p-3 rounded-lg font-medium text-slate-900 border border-slate-300 w-full focus:outline-none focus:border-slate-600 resize-y" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900 whitespace-pre-wrap">{profileData.custom_signature || 'Nenhuma assinatura configurada.'}</p>
                    )}
                  </div>
                </div>
             </div>
          </div>
        )}

        {activeSubTab === 'integrations' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Gmail</h3>
                  <p className="text-sm text-slate-500">Envio automático de emails de confirmação de consultas e cobranças diretamente pelo seu e-mail.</p>
                </div>
              </div>
              <div>
                 {googleConnected ? (
                    <span className="text-brand-primary font-semibold px-4 py-2 border border-status-success/50 bg-status-success/20 rounded-lg flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-brand-primary block"></span>
                      <span>Conectado</span>
                    </span>
                 ) : (
                    <button 
                      onClick={handleConnectGoogle}
                      className="px-5 py-2.5 bg-brand-primary hover:bg-[#12221d] text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                    >
                      Conectar Gmail
                    </button>
                 )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6 text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Google Calendar (Exportação)</h3>
                  <p className="text-sm text-slate-500">Sincronize a agenda exportando automaticamente as sessões do CleanMind para o seu Google Calendar.</p>
                </div>
              </div>
              <div>
                {googleConnected ? (
                    <div className="flex items-center space-x-3">
                      <span className="text-brand-primary font-semibold px-4 py-2 border border-status-success/50 bg-status-success/20 rounded-lg flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-brand-primary block"></span>
                        <span>Conectado</span>
                      </span>
                      <button 
                        onClick={handleDisconnectGoogle}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-semibold transition cursor-pointer"
                      >
                        Desconectar
                      </button>
                    </div>
                 ) : (
                    <button 
                      onClick={handleConnectGoogle}
                      className="px-5 py-2.5 bg-brand-primary hover:bg-[#12221d] text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                    >
                      Conectar Calendário
                    </button>
                 )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="w-12 h-12 rounded-xl bg-status-success flex items-center justify-center shrink-0">
                  <MessageSquare className="w-6 h-6 text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">API do WhatsApp</h3>
                  <p className="text-sm text-slate-500">Notifique seus pacientes com lembretes automáticos e recebimentos de avisos de novas consultas via WhatsApp.</p>
                </div>
              </div>
              <div>
                <button className="px-5 py-2.5 bg-status-success border border-status-success text-brand-primary hover:bg-[#b0d292] rounded-lg text-sm font-semibold transition cursor-pointer flex items-center space-x-2">
                   <span>Configurar API</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'whatsapp' && (
          <div className="space-y-6">
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-6 border-b border-slate-100 pb-4">
                   <div className="w-10 h-10 rounded-lg bg-status-success flex items-center justify-center">
                     <MessageSquare className="w-5 h-5 text-brand-primary" />
                   </div>
                   <div>
                     <h3 className="font-bold text-lg text-slate-900">Mensagens do WhatsApp</h3>
                     <p className="text-sm text-slate-500">Personalize os lembretes automáticos e notificações para os pacientes.</p>
                   </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Lembrete de Consulta</label>
                  <p className="text-sm text-slate-500 mb-4">Escolha a mensagem que será enviada para o paciente como lembrete 24 horas antes do agendamento.</p>
                  <textarea 
                     className="w-full border border-slate-300 rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-status-success text-slate-700 resize-y"
                     rows={6}
                     defaultValue={`Olá {{nome_paciente}}, tudo bem?\n\nPassando para lembrar da nossa consulta marcada para {{data}} às {{hora}}.\n\nQualquer imprevisto, favor me avisar com antecedência.\nAté lá!`}
                  />
                  <div className="text-xs text-slate-500 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="font-semibold block mb-1">Variáveis disponíveis:</span>
                    <strong className="text-slate-700">{"{{nome_paciente}}"}</strong>, <strong className="text-slate-700">{"{{hora}}"}</strong>, <strong className="text-slate-700">{"{{data}}"}</strong>, <strong className="text-slate-700">{"{{nome_medico}}"}</strong>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Confirmação de Agendamento</label>
                  <textarea 
                     className="w-full border border-slate-300 rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-status-success text-slate-700 resize-y"
                     rows={5}
                     defaultValue={`Olá {{nome_paciente}}! Sua consulta com {{nome_medico}} foi agendada com sucesso para o dia {{data}} às {{hora}}. \n\nEm breve você receberá um lembrete.`}
                  />
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button onClick={() => alert('Mensagens salvas com sucesso!')} className="px-6 py-2.5 bg-slate-900 border border-transparent rounded-lg text-sm font-medium hover:bg-slate-800 text-white transition cursor-pointer shadow-sm">
                    Salvar Alterações
                  </button>
                </div>
             </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
