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
  const [isGlowing, setIsGlowing] = useState(false);

  const triggerGlow = () => {
    setIsGlowing(true);
    setTimeout(() => {
      setIsGlowing(false);
    }, 1200); // 1.2s border glow effect
  };
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const moods = ['😀', '🙂', '😐', '☹️', '😭'];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const maxRecordingTime = 60; // 60 seconds
  const timerRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64; 
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      const drawWave = () => {
        if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;
        
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        ctx.clearRect(0, 0, width, height);
        
        const barWidth = 3;
        const gap = 2;
        const numBars = Math.floor(width / (barWidth + gap));
        
        let x = 0;
        ctx.fillStyle = '#ef4444'; // text-red-500
        
        for (let i = 0; i < numBars; i++) {
          const dataIndex = Math.floor((i / numBars) * dataArrayRef.current.length);
          const value = dataArrayRef.current[dataIndex];
          
          const percent = value / 255;
          const minHeight = 2;
          const barHeight = Math.max(minHeight, percent * height);
          
          const y = (height - barHeight) / 2;
          
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
          
          x += barWidth + gap;
        }
        
        animationFrameRef.current = requestAnimationFrame(drawWave);
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(console.error);
        }
        setRecordingTime(0);
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
                dataManager.addDiaryEntry(patient.id, text, patient.doctor_id, base64Audio);
                triggerGlow();
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

      drawWave();
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxRecordingTime) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
            return maxRecordingTime;
          }
          return prev + 0.1;
        });
      }, 100);
    } catch (err) {
      console.error("Microphone error", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  // Load diary entries specifically for this patient
  useEffect(() => {
    if (!patient || !patient.id) return;
    let unsub = () => {};
    // Dynamic import to avoid breaking when offline or if db changes
    import('firebase/firestore').then(({ collection, query, where, onSnapshot }) => {
      import('../firebase').then(({ db }) => {
        const q = query(collection(db, 'diary'), where('patient_id', '==', patient.id));
        unsub = onSnapshot(q, (snapshot) => {
          const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          const sorted = entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setMessages(sorted);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }, (error) => {
          console.error("Error loading diary entries from firestore", error);
        });
      });
    });
    return () => unsub();
  }, [patient?.id]);

  const handleSend = () => {
    if (!inputText.trim() && !selectedMood) return;

    const finalContent = selectedMood ? `[${selectedMood}] ${inputText.trim()}`.trim() : inputText.trim();
    if (!finalContent) return;

    dataManager.addDiaryEntry(patient.id, finalContent, patient.doctor_id);
    setInputText('');
    setSelectedMood(null);
    triggerGlow();
    
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

  const groupMessagesByDate = (messages: any[]) => {
    const groups: { [key: string]: any[] } = {};
    messages.forEach(msg => {
      const date = new Date(msg.created_at);
      const dateString = date.toLocaleDateString('pt-BR');
      if (!groups[dateString]) {
        groups[dateString] = [];
      }
      groups[dateString].push(msg);
    });
    return groups;
  };

  const formatDateHeader = (dateString: string) => {
    const today = new Date().toLocaleDateString('pt-BR');
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString('pt-BR');

    if (dateString === today) return 'HOJE';
    if (dateString === yesterday) return 'ONTEM';
    return dateString;
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className={`flex flex-col h-screen bg-[#efeae2] max-w-md mx-auto relative overflow-hidden font-sans bg-[url('https://web.whatsapp.com/img/bg-chat-tile-light_04fcacde539c58cca6745483d4858c52.png')] bg-repeat opacity-95 transition-all duration-300 ${
      isGlowing 
        ? 'ring-4 ring-creative-lime shadow-[0_0_40px_rgba(199,241,80,0.8)] scale-[1.01]' 
        : 'shadow-2xl'
    }`}>
      {/* Header */}
      <div className="bg-[#f0f2f5] pt-12 pb-4 px-6 sticky top-0 z-20 shadow-sm border-b border-[#d1d7db]">
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm font-semibold text-slate-500">12:00</div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <div className="w-4 h-4 border-2 border-current rounded-sm"></div>
            <div className="w-4 h-4 border-2 border-current rounded-full"></div>
            <div className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-[10px] border-b-current"></div>
          </div>
        </div>

        <div className="flex justify-between items-center bg-[#f0f2f5] p-2 pr-0">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center font-bold text-status-success text-sm overflow-hidden shrink-0">
               {patient.photo_url ? (
                 <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
               ) : (
                 patient.name?.substring(0, 2).toUpperCase()
               )}
             </div>
             <div>
                <h2 className="font-bold text-[#111b21] text-[16px]">{patient.name}</h2>
                <div className="text-2xl font-monique font-normal text-creative-green leading-none pt-0.5">Diário Pessoal</div>
             </div>
           </div>
           
           <div className="flex items-center gap-4 text-[#54656f]">
             <button onClick={onLogout} title="Sair da Conta" className="hover:text-red-500 transition-colors p-1 rounded-lg cursor-pointer">
               <LogOut className="w-5 h-5" />
             </button>
           </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4 space-y-4">
        {Object.keys(groupedMessages).length === 0 && (
           <>
             <div className="text-center mt-2 mb-2">
               <span className="text-[12.5px] font-medium text-[#54656f] bg-white px-3 py-1.5 rounded-lg shadow-sm">
                  HOJE
               </span>
             </div>
             <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               transition={{ type: "spring", stiffness: 350, damping: 22 }}
               className="self-start max-w-[85%] bg-white p-2 px-3 rounded-xl rounded-tl-none shadow-sm text-[#111b21] relative flex flex-col gap-1 origin-top-left"
             >
               <p className="text-[14.2px] leading-relaxed">
                 Olá, {patient.name.split(' ')[0]}! Sou o assistente terapêutico acompanhando seu diário. 
                 Pode escrever livremente como foi o seu dia, os seus sentimentos ou angústias. Tudo é privado e seguro.
               </p>
               <div className="text-[11px] text-[#667781] font-medium self-end flex items-center gap-1 shrink-0 pt-1">
                 {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
               </div>
             </motion.div>
           </>
        )}

        {Object.entries(groupedMessages).map(([date, msgs], groupIndex) => (
          <div key={date} className="flex flex-col gap-4">
            <div className="text-center mt-2 mb-2">
              <span className="text-[12.5px] font-medium text-[#54656f] bg-white px-3 py-1.5 rounded-lg shadow-sm">
                 {formatDateHeader(date)}
              </span>
            </div>

            {groupIndex === 0 && (
               <motion.div 
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ type: "spring", stiffness: 350, damping: 22 }}
                 className="self-start max-w-[85%] bg-white p-2 px-3 rounded-xl rounded-tl-none shadow-sm text-[#111b21] relative flex flex-col gap-1 origin-top-left"
               >
                 <p className="text-[14.2px] leading-relaxed">
                   Olá, {patient.name.split(' ')[0]}! Sou o assistente terapêutico acompanhando seu diário. 
                   Pode escrever livremente como foi o seu dia, os seus sentimentos ou angústias. Tudo é privado e seguro.
                 </p>
                 <div className="text-[11px] text-[#667781] font-medium self-end flex items-center gap-1 shrink-0 pt-1">
                   12:00
                 </div>
               </motion.div>
            )}
            
            {msgs.map((msg: any, index: number) => {
              // Usually the patient is "self-end", we will assume all diary entries are from the patient
              // unless msg.doctor_id matches something? Right now we just make them self-end
              return (
                <motion.div 
                  key={msg.id || index} 
                  initial={{ scale: 0.3, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="self-end max-w-[85%] flex flex-col items-end origin-bottom-right"
                >
                   <div className="bg-[#dcf8c6] p-2 px-3 rounded-xl rounded-tr-none shadow-sm text-[#111b21] relative flex gap-2 flex-wrap min-w-[120px]">
                     {msg.audio_url ? (
                       <div className="flex flex-col gap-1 w-full">
                         <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                               {patient.photo_url ? (
                                 <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
                               ) : (
                                 <div className="w-full h-full bg-slate-300 flex items-center justify-center text-xs text-white">
                                   {patient.name?.substring(0, 2).toUpperCase()}
                                 </div>
                               )}
                            </div>
                            <audio controls src={msg.audio_url} className="w-[180px] h-9" />
                         </div>
                       </div>
                     ) : (
                       <span className="text-[14.2px] leading-relaxed whitespace-pre-wrap flex-1">{msg.content}</span>
                     )}
                     <div className="text-[11px] text-[#667781] font-medium self-end flex items-center gap-1 shrink-0 ml-auto pt-1">
                       {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                       <svg viewBox="0 0 16 11" width="16" height="11" className="text-[#53bdeb] fill-current">
                         <path d="M11.8 1.6L5.4 7.9 2.5 5 1.1 6.4 5.4 10.7 13.2 3z"></path>
                         <path d="M16 3L14.6 1.6 9.4 6.9 10.8 8.3z"></path>
                       </svg>
                     </div>
                   </div>
                </motion.div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 w-full bg-[#f0f2f5] flex flex-col p-2 gap-2">
        {/* Mood Selector (WhatsApp doesn't have this, but keeping functionality visible) */}
        <div className="flex justify-center gap-2 overflow-x-auto pb-1 no-scrollbar px-2">
          {moods.map((mood) => (
            <button
              key={mood}
              onClick={() => setSelectedMood(mood === selectedMood ? null : mood)}
              className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg transition-all shadow-sm ${
                mood === selectedMood
                  ? 'bg-brand-primary text-white scale-110 border-2 border-brand-primary/20'
                  : 'bg-white hover:bg-slate-50 border border-slate-100'
              }`}
            >
              {mood}
            </button>
          ))}
        </div>
        
        <div className="flex items-end gap-2 w-full px-2 pb-2">
          <div className="flex-1 bg-white rounded-[24px] min-h-[44px] flex items-center shadow-sm border border-[#fff] px-3 pb-1">
             {isRecording ? (
               <div className="flex-1 flex items-center gap-2 py-2.5 h-[44px]">
                 <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"></div>
                 <canvas ref={canvasRef} width="160" height="24" className="w-full h-[24px] opacity-80"></canvas>
               </div>
             ) : (
               <textarea
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 onKeyDown={handleKeyDown}
                 placeholder={isTranscribing ? "Transcrevendo..." : "Mensagem"}
                 className="flex-1 bg-transparent border-none focus:outline-none resize-none py-2.5 text-[15px] text-[#111b21] placeholder:text-[#667781] placeholder:font-normal max-h-[120px]"
                 rows={1}
                 disabled={isTranscribing}
               />
             )}
          </div>
          
          <div className="flex gap-2 shrink-0 pb-1 items-center">
            {isRecording && (
               <div className="text-[#54656f] font-medium text-[15px] font-mono">
                 {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{Math.floor(recordingTime % 60).toString().padStart(2, '0')}
               </div>
            )}
            {(!inputText.trim() && !selectedMood && !isTranscribing) || isRecording ? (
              <div className="relative flex items-center justify-center">
                {isRecording && (
                  <svg className="absolute inset-0 w-[44px] h-[44px] -rotate-90 pointer-events-none" viewBox="0 0 44 44">
                    <circle
                      cx="22"
                      cy="22"
                      r="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-red-200"
                    />
                    <circle
                      cx="22"
                      cy="22"
                      r="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="125.6"
                      strokeDashoffset={125.6 - (125.6 * (recordingTime / maxRecordingTime))}
                      className="text-red-500 transition-all duration-100 ease-linear"
                    />
                  </svg>
                )}
                <button 
                  onClick={toggleRecording}
                  type="button"
                  disabled={isTranscribing}
                  className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 ${isRecording ? 'bg-red-500 text-white' : 'bg-[#00a884] text-white hover:bg-[#008f6f]'}`}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSend}
                disabled={isTranscribing}
                className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shrink-0 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isTranscribing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5 ml-0.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
