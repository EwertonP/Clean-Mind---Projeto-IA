import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, LogOut, Video, Phone as PhoneIcon, MoreVertical, Plus, Mic, MicOff } from 'lucide-react';
import { Patient, dataManager } from '../data';
import { useStore } from '../store';

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface PatientMobileAppProps {
  patient: Patient;
  onLogout: () => void;
}

export default function PatientMobileApp({ patient, onLogout }: PatientMobileAppProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const moods = ['😀', '🙂', '😐', '☹️', '😭'];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsRecording(false);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setIsTranscribing(true);
          try {
            const response = await fetch('/api/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64Audio, mimeType: 'audio/webm' })
            });
            const data = await response.json();
            if (data.text) {
              const text = data.text.trim();
              if (text) {
                // Add the transcribed text to input, or send directly
                dataManager.addDiaryEntry(patient.id, `[Áudio Transcrito] ${text}`, patient.doctor_id);
              }
            } else {
              alert('Não foi possível transcrever o áudio.');
            }
          } catch (err) {
            console.error('Transcription error:', err);
            alert('Erro ao enviar áudio.');
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  // Load diary entries specifically for this patient
  useEffect(() => {
    let unsub = () => {};
    // Dynamic import to avoid breaking when offline or if db changes
    import('firebase/firestore').then(({ collection, query, where, onSnapshot }) => {
      import('../firebase').then(({ db }) => {
        const q = query(collection(db, 'diary'), where('patient_id', '==', patient.id));
        unsub = onSnapshot(q, (snapshot) => {
          const entries = snapshot.docs.map(d => d.data() as any);
          const sorted = entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setMessages(sorted);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        });
      });
    });
    return () => unsub();
  }, [patient.id]);

  const handleSend = () => {
    if (!inputText.trim() && !selectedMood) return;

    const finalContent = selectedMood ? `[${selectedMood}] ${inputText.trim()}`.trim() : inputText.trim();
    if (!finalContent) return;

    dataManager.addDiaryEntry(patient.id, finalContent, patient.doctor_id);
    setInputText('');
    setSelectedMood(null);
    
    // Auto-optimistic UI for smoothness
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F0F4EC] max-w-md mx-auto shadow-2xl relative overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-[#F0F4EC] pt-12 pb-4 px-6 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm font-semibold text-slate-500">12:00</div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <div className="w-4 h-4 border-2 border-current rounded-sm"></div>
            <div className="w-4 h-4 border-2 border-current rounded-full"></div>
            <div className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-[10px] border-b-current"></div>
          </div>
        </div>

        <div className="flex justify-between items-center bg-white/60 p-2 pr-4 rounded-full backdrop-blur-md border border-white/40 shadow-sm">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center font-bold text-status-success text-sm overflow-hidden shrink-0">
               {patient.photo_url ? (
                 <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
               ) : (
                 patient.name?.substring(0, 2).toUpperCase()
               )}
             </div>
             <div>
                <h2 className="font-bold text-slate-800 text-[15px]">{patient.name}</h2>
                <div className="text-[11px] font-semibold text-[#7fb742]">Diário Pessoal</div>
             </div>
           </div>
           
           <div className="flex items-center gap-4 text-slate-600">
             <button onClick={onLogout} title="Sair da Conta" className="hover:text-red-500 transition-colors">
               <LogOut className="w-5 h-5" />
             </button>
           </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 pt-4 space-y-6">
        <div className="text-center">
          <span className="text-[11px] font-medium text-slate-400 bg-white/50 px-3 py-1 rounded-full shadow-sm">
             Hoje, {new Date().toLocaleDateString('pt-BR')}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="self-start max-w-[85%] bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100/50">
            <p className="text-[14px] text-slate-600 leading-relaxed">
              Olá, {patient.name.split(' ')[0]}! Sou o assistente terapêutico acompanhando seu diário. 
              Pode escrever livremente como foi o seu dia, os seus sentimentos ou angústias. Tudo é privado e seguro.
            </p>
          </div>

          {messages.map((msg, index) => {
            return (
              <div key={msg.id || index} className="self-end max-w-[85%] flex flex-col items-end">
                 <div className="bg-[#D1E6B9] p-4 rounded-2xl rounded-tr-sm shadow-sm text-slate-800">
                   <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                 </div>
                 <div className="text-[10px] text-slate-400 mt-1.5 font-medium mr-1 tracking-wide">
                   {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                 </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#F0F4EC] via-[#F0F4EC]/90 to-transparent flex flex-col gap-2">
        <div className="flex justify-center gap-2 mb-1">
          {moods.map((mood) => (
            <button
              key={mood}
              onClick={() => setSelectedMood(mood === selectedMood ? null : mood)}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all shadow-sm ${
                mood === selectedMood
                  ? 'bg-brand-primary text-white scale-110 border-2 border-brand-primary/20'
                  : 'bg-white hover:bg-slate-50 border border-slate-100'
              }`}
            >
              {mood}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-full p-1.5 pl-5 pr-2 flex items-center shadow-lg border border-slate-100/50 gap-1.5">
           <textarea
             value={inputText}
             onChange={(e) => setInputText(e.target.value)}
             onKeyDown={handleKeyDown}
             placeholder={isRecording ? "Gravando áudio..." : isTranscribing ? "Transcrevendo áudio..." : "Escreva como você está se sentindo..."}
             className="flex-1 bg-transparent border-none focus:outline-none resize-none h-11 py-3 text-[14px] text-slate-700 placeholder:text-slate-400 font-medium disabled:opacity-50"
             rows={1}
             disabled={isRecording || isTranscribing}
           />
           <button 
             onClick={toggleRecording}
             type="button"
             disabled={isTranscribing}
             className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm disabled:opacity-50 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
           >
             {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
           </button>
           <button 
             onClick={handleSend}
             disabled={(!inputText.trim() && !selectedMood) || isTranscribing || isRecording}
             className="w-11 h-11 rounded-full bg-brand-primary text-white flex items-center justify-center shrink-0 disabled:opacity-50 disabled:bg-slate-300 transition-colors shadow-sm"
           >
             {isTranscribing ? (
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
             ) : (
               <Send className="w-5 h-5 ml-0.5" />
             )}
           </button>
        </div>
      </div>
    </div>
  );
}
