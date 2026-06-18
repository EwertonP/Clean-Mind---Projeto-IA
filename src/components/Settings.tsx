import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, Settings2, Link as LinkIcon, Mail, Calendar, MessageSquare, MapPin, Building, CalendarIcon as CalendarDays, Phone, Globe } from 'lucide-react';
import { connectGoogleCalendar, isGoogleCalendarConnected } from '../googleCalendar';
import { dataManager } from '../data';

export default function Settings() {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'integrations' | 'whatsapp'>('profile');
  const [googleConnected, setGoogleConnected] = useState(isGoogleCalendarConnected());
  const [isEditing, setIsEditing] = useState(false);

  // Clinic profile state
  const [profileData, setProfileData] = useState(() => {
    const defaultDoc = dataManager.getDoctor();
    return {
      name: defaultDoc?.clinic_name || '',
      specialty: defaultDoc?.specialty || '',
      patients: '47',
      professionals: '3',
      numberOfRooms: defaultDoc?.clinic_rooms?.length.toString() || '',
      description: defaultDoc?.clinic_description || '',
      cnpj: defaultDoc?.clinic_cnpj || '',
      founded: defaultDoc?.clinic_founded || '',
      address: defaultDoc?.clinic_street || '',
      neighborhood: defaultDoc?.clinic_neighborhood || '',
      zip: defaultDoc?.clinic_zip || '',
      city: defaultDoc?.clinic_city || '',
      state: defaultDoc?.clinic_state || '',
      phone: defaultDoc?.phone || '',
      email: defaultDoc?.email || '',
      website: defaultDoc?.clinic_website || '',
      businessHoursStart: defaultDoc?.business_hours?.start || '',
      businessHoursEnd: defaultDoc?.business_hours?.end || '',
      businessDays: defaultDoc?.business_hours?.days || '',
      custom_signature: defaultDoc?.custom_signature || ''
    };
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfileData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = () => {
    setIsEditing(false);
    // Em um app real, os dados do profile seriam salvos globalmente.
    // Aqui sincronizamos as salas pro doctor logado para a Agenda reconhecer:
    const sessionId = localStorage.getItem('cm_doctor_session');
    if (sessionId) {
      const docs = dataManager.getDoctors();
      const doc = docs.find(d => d.id === sessionId);
      if (doc) {
        const roomsNum = parseInt(profileData.numberOfRooms, 10) || 1;
        doc.clinic_name = profileData.name;
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
        doc.clinic_rooms = Array.from({length: roomsNum}, (_, i) => `Sala ${i + 1}`);
        doc.business_hours = {
          start: profileData.businessHoursStart,
          end: profileData.businessHoursEnd,
          days: profileData.businessDays
        };
        doc.is_configured = true;
        dataManager.saveDoctor(doc);
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Settings2 className="h-6 w-6 text-slate-600" />
            <span>Configurações</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie as informações da clínica e integrações de ferramentas.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-4 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeSubTab === 'profile' 
              ? 'border-[#192F28] text-[#192F28]' 
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
              ? 'border-[#192F28] text-[#192F28]' 
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
              ? 'border-[#192F28] text-[#192F28]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>WhatsApp</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeSubTab === 'profile' && (
          <div className="space-y-6">
             {/* Box 1: Cabeçalho da Clínica */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-start gap-4">
                <div className="w-20 h-20 bg-[#C1E2A4] rounded-2xl flex items-center justify-center shrink-0">
                  <Building2 className="w-10 h-10 text-slate-800" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      {isEditing ? (
                        <input type="text" name="name" value={profileData.name} onChange={handleChange} placeholder="Nome da Clínica" className="text-2xl font-bold text-slate-900 border border-slate-300 rounded px-2 py-1 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-[#C1E2A4]" />
                      ) : (
                        <h2 className="text-2xl font-bold text-slate-900">{profileData.name || 'Nome da Clínica'}</h2>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="inline-flex items-center space-x-1 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-semibold border border-green-100">
                          <Building className="w-3 h-3" />
                          <span>{profileData.specialty}</span>
                        </span>
                        <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold border border-blue-100">
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
                    <textarea name="description" value={profileData.description} onChange={handleChange} rows={3} placeholder="Descreva sua clínica..." className="text-sm text-slate-700 mt-4 leading-relaxed w-full border border-slate-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-[#C1E2A4]" />
                  ) : (
                    <p className="text-sm text-slate-600 mt-4 leading-relaxed max-w-3xl">
                      {profileData.description || 'Nenhuma descrição adicionada.'}
                    </p>
                  )}
                </div>
             </div>

             {/* Box 2: Informações Básicas */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-6">Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">CNPJ</span>
                    {isEditing ? (
                      <input type="text" name="cnpj" value={profileData.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.cnpj || '00.000.000/0000-00'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Data de Fundação</span>
                    {isEditing ? (
                      <input type="text" name="founded" value={profileData.founded} onChange={handleChange} placeholder="DD/MM/AAAA" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
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
                      <input type="text" name="specialty" value={profileData.specialty} onChange={handleChange} placeholder="Sua Especialidade" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.specialty || 'Não definida'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Número de Salas (Atendimento Presencial)</span>
                    {isEditing ? (
                      <input type="number" min="1" name="numberOfRooms" value={profileData.numberOfRooms} onChange={handleChange} className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
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
                      <input type="text" name="businessDays" value={profileData.businessDays} onChange={handleChange} placeholder="Ex: Segunda a Sábado" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.businessDays || 'Não configurado'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Horário de Abertura</span>
                    {isEditing ? (
                      <input type="time" name="businessHoursStart" value={profileData.businessHoursStart} onChange={handleChange} className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.businessHoursStart || '00:00'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Horário de Fechamento</span>
                    {isEditing ? (
                      <input type="time" name="businessHoursEnd" value={profileData.businessHoursEnd} onChange={handleChange} className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
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
                      <input type="text" name="address" value={profileData.address} onChange={handleChange} placeholder="Rua / Avenida, Número" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
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
                      <input type="text" name="neighborhood" value={profileData.neighborhood} onChange={handleChange} placeholder="Bairro" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.neighborhood || 'Não informado'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">CEP</span>
                    {isEditing ? (
                      <input type="text" name="zip" value={profileData.zip} onChange={handleChange} placeholder="00000-000" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.zip || '00000-000'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Cidade</span>
                    {isEditing ? (
                      <input type="text" name="city" value={profileData.city} onChange={handleChange} placeholder="Cidade" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.city || 'Não informada'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">Estado</span>
                    {isEditing ? (
                      <input type="text" name="state" value={profileData.state} onChange={handleChange} placeholder="UF" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{profileData.state || 'UF'}</p>
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
                      <input type="text" name="phone" value={profileData.phone} onChange={handleChange} placeholder="(00) 00000-0000" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
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
                      <input type="text" name="email" value={profileData.email} onChange={handleChange} placeholder="contato@clinica.com" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
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
                      <input type="text" name="website" value={profileData.website} onChange={handleChange} placeholder="www.seusite.com.br" className="text-[15px] font-medium text-slate-900 border-b border-slate-300 w-full focus:outline-none focus:border-slate-600" />
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
                    <span className="text-status-success font-semibold px-4 py-2 border border-green-200 bg-green-50 rounded-lg flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 block"></span>
                      <span>Conectado</span>
                    </span>
                 ) : (
                    <button 
                      onClick={handleConnectGoogle}
                      className="px-5 py-2.5 bg-[#192F28] hover:bg-[#12221d] text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                    >
                      Conectar Gmail
                    </button>
                 )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Google Calendar</h3>
                  <p className="text-sm text-slate-500">Sincronize a agenda da clínica e visualize os agendamentos lado a lado com seus compromissos pessoais.</p>
                </div>
              </div>
              <div>
                {googleConnected ? (
                    <span className="text-status-success font-semibold px-4 py-2 border border-green-200 bg-green-50 rounded-lg flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 block"></span>
                      <span>Conectado</span>
                    </span>
                 ) : (
                    <button 
                      onClick={handleConnectGoogle}
                      className="px-5 py-2.5 bg-[#192F28] hover:bg-[#12221d] text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                    >
                      Conectar Calendário
                    </button>
                 )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">API do WhatsApp</h3>
                  <p className="text-sm text-slate-500">Notifique seus pacientes com lembretes automáticos e recebimentos de avisos de novas consultas via WhatsApp.</p>
                </div>
              </div>
              <div>
                <button className="px-5 py-2.5 bg-white border border-green-300 text-green-700 hover:bg-green-50 rounded-lg text-sm font-semibold transition cursor-pointer flex items-center space-x-2">
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
                   <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                     <MessageSquare className="w-5 h-5 text-green-600" />
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
                     className="w-full border border-slate-300 rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] text-slate-700 resize-y"
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
                     className="w-full border border-slate-300 rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#C1E2A4] text-slate-700 resize-y"
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
