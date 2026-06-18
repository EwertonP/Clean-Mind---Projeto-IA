/**
 * CleanMind Database Schema & RLS Policies (Supabase / PostgreSQL)
 * Designed for healthcare privacy and strict LGPD compliance.
 */

export const SUPABASE_SQL_SCHEMA = `-- CleanMind - Sistema de Registro Eletrônico de Saúde (SRES)
-- Script de Configuração do Banco de Dados para Supabase / PostgreSQL
-- Em conformidade com a LGPD (Lei Geral de Proteção de Dados) e Anvisa RDC 657/2022

-- 1. HABILITAR EXTENSÕES DE SEGURANÇA
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE MÉDICOS (users_doctors)
-- Vinculado diretamente ao auth.users do Supabase Auth
CREATE TABLE IF NOT EXISTS public.users_doctors (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    crp_crm VARCHAR(50) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    plan_type VARCHAR(50) DEFAULT 'free' CHECK (plan_type IN ('free', 'premium', 'pro')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ativar Row Level Security
ALTER TABLE public.users_doctors ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para users_doctors
CREATE POLICY "Médicos podem ler seu próprio perfil"
    ON public.users_doctors FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Médicos podem atualizar seu próprio perfil"
    ON public.users_doctors FOR UPDATE
    USING (auth.uid() = id);


-- 3. TABELA DE PACIENTES (patients)
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES public.users_doctors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL, -- WhatsApp do paciente
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ativar RLS para patients
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para patients
CREATE POLICY "Médicos podem ver apenas seus pacientes"
    ON public.patients FOR SELECT
    USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem inserir seus próprios pacientes"
    ON public.patients FOR INSERT
    WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem atualizar seus próprios pacientes"
    ON public.patients FOR UPDATE
    USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem deletar seus próprios pacientes"
    ON public.patients FOR DELETE
    USING (auth.uid() = doctor_id);


-- 4. TABELA DE AGENDAMENTOS (appointments)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users_doctors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration INTEGER NOT NULL, -- em minutos
    type VARCHAR(50) DEFAULT 'online' CHECK (type IN ('online', 'presencial')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ativar RLS para appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para appointments
CREATE POLICY "Médicos podem visualizar seus agendamentos"
    ON public.appointments FOR SELECT
    USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem criar agendamentos"
    ON public.appointments FOR INSERT
    WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem atualizar seus agendamentos"
    ON public.appointments FOR UPDATE
    USING (auth.uid() = doctor_id);


-- 5. TABELA DE FATURAMENTO / COBRANÇAS (billing)
CREATE TABLE IF NOT EXISTS public.billing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users_doctors(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'canceled')),
    nfe_status VARCHAR(50) DEFAULT 'not_issued' CHECK (nfe_status IN ('not_issued', 'issued', 'failed', 'processing')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ativar RLS para billing
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para billing
CREATE POLICY "Médicos podem visualizar suas cobranças"
    ON public.billing FOR SELECT
    USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem registrar cobranças"
    ON public.billing FOR INSERT
    WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem atualizar cobranças"
    ON public.billing FOR UPDATE
    USING (auth.uid() = doctor_id);


-- 6. TABELA DE DIÁRIO DO PACIENTE (diary_entries)
-- Dados sensíveis de saúde mental. Apenas psicólogo tem acesso às análises geradas.
CREATE TABLE IF NOT EXISTS public.diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- Mensagem enviada pelo paciente pelo WhatsApp
    sentiment_score NUMERIC(3, 2), -- -1.00 (Extremamente negativo) a +1.00 (Extremamente positivo)
    crisis_flag BOOLEAN DEFAULT FALSE, -- Alerta de ideação suicida ou crise de pânico
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ativar RLS para diary_entries
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para diary_entries
CREATE POLICY "Médicos podem consultar os diários de seus pacientes"
    ON public.diary_entries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.patients p
            WHERE p.id = diary_entries.patient_id AND p.doctor_id = auth.uid()
        )
    );

-- Nota: O webhook da API do WhatsApp ou backend automatizado (serviço confiável) insere os dados
-- via service_role, bypassando políticas de RLS ou usando políticas específicas de insert se autenticado.


-- 7. TABELA DE PRONTUÁRIOS MÉDICOS (medical_records)
-- Dados altamente confidenciais em conformidade com as regras NGS2 de assinatura e imutabilidade
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users_doctors(id) ON DELETE CASCADE,
    evolution_text TEXT NOT NULL, -- Texto bruto da evolução clínica
    ai_summary TEXT, -- Resumo gerado pela IA (Clinical Decision Support)
    signature_status VARCHAR(50) DEFAULT 'unsigned' CHECK (signature_status IN ('unsigned', 'signed_icp')),
    signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ativar RLS para medical_records
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para medical_records
CREATE POLICY "Médicos podem visualizar seus prontuários"
    ON public.medical_records FOR SELECT
    USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem criar prontuários"
    ON public.medical_records FOR INSERT
    WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem atualizar prontuários não assinados"
    ON public.medical_records FOR UPDATE
    USING (auth.uid() = doctor_id AND signature_status = 'unsigned');


-- 8. ÍNDICES DE PERFORMANCE E SEGURANÇA
CREATE INDEX IF NOT EXISTS idx_patients_doctor ON public.patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_diary_entries_patient ON public.diary_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON public.medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_doctor ON public.billing(doctor_id);

-- 9. GATILHOS (TRIGGERS) PARA AUDITORIA (Exigência de Compliance em Saúde)
-- Registra imutabilidade uma vez que o prontuário for assinado digitalmente
CREATE OR REPLACE FUNCTION protect_signed_records() 
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.signature_status = 'signed_icp' THEN
        RAISE EXCEPTION 'Registros assinados digitalmente são imutáveis e não podem ser modificados.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_medical_records
    BEFORE UPDATE ON public.medical_records
    FOR EACH ROW
    EXECUTE FUNCTION protect_signed_records();
`;
