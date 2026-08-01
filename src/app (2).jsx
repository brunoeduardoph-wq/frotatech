import React, { useState, useMemo, useEffect, createContext, useContext } from "react";
import {
  ClipboardCheck, Wrench, Siren, Fuel, CircleDot, Droplets,
  ClipboardList, LayoutDashboard, Sparkles, ChevronRight, Plus,
  MapPin, Clock, AlertTriangle, CheckCircle2, XCircle, Gauge,
  Truck, Search, Bell, Settings, X, Link2, RefreshCw, LogOut, Loader2, UserPlus
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import Papa from "papaparse";

/* ============================================================
   SUPABASE — conexão via fetch direto ao PostgREST/GoTrue.
   (o pacote @supabase/supabase-js não roda no preview de artifact;
   fora daqui, num app real, prefira o SDK oficial supabase-js)
   ============================================================ */
const SUPABASE_URL = "https://qviyfhuxdnvmoepkoicb.supabase.co";
const SUPABASE_KEY = "sb_publishable_sPzozZLxJ1BukDJoM3EYZA_Ey0ejRtf";

async function sbAuth(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Falha no login");
  return data; // { access_token, user, ... }
}

async function sbSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Falha ao criar usuário");
  if (!data.access_token) {
    throw new Error("Usuário criado, mas exige confirmação por e-mail. Desative 'Confirm email' em Authentication → Providers → Email no Supabase.");
  }
  return data;
}

/* ---------- login por CPF + data de nascimento ----------
   O Supabase Auth exige e-mail, então mapeamos CPF -> e-mail sintético
   (ex: 12345678900@frotatech.app) e a senha inicial é a data de
   nascimento em dígitos (ddMMyyyy). O CPF real fica salvo em profiles.cpf. */
function soDigitos(v) { return (v || "").replace(/\D/g, ""); }
function cpfParaEmail(cpf) { return `${soDigitos(cpf)}@frotatech.app`; }
function nascParaSenha(dataISO) {
  // dataISO vem do <input type="date"> como yyyy-mm-dd
  const [y, m, d] = dataISO.split("-");
  return `${d}${m}${y}`;
}

async function sbSelect(table, query = "", token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Erro ao ler ${table}`);
  return res.json();
}

async function sbInsert(table, payload, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Erro ao gravar em ${table}`);
  return data;
}

async function sbUpdate(table, query, payload, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Erro ao atualizar ${table}`);
  return data;
}

async function sbUpdatePassword(novaSenha, token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: novaSenha }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Erro ao trocar senha");
  return data;
}

// Chama a Edge Function segura (roda no servidor, valida admin/gestor lá,
// e só ela toca na service_role key — o app nunca vê essa chave).
async function cadastrarFuncionarioSeguro(payload, token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cadastrar-funcionario`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao cadastrar funcionário");
  return data;
}

/* ============================================================
   FROTATECH — design tokens
   base: #0A0D11 | surface: #12161C | raised: #1B212A
   gold: #F2B705 | alert: #E63946 | ok: #2ECC71
   display: Space Grotesk | body: Inter | mono: JetBrains Mono
   signature: "Pulso da Frota" — animated route/heartbeat line
   ============================================================ */

const COLORS = {
  bg: "#0A0D11",
  surface: "#12161C",
  raised: "#1B212A",
  border: "#232A34",
  gold: "#F2B705",
  goldDim: "#7A620A",
  alert: "#E63946",
  ok: "#2ECC71",
  textPrimary: "#EDEFF2",
  textMuted: "#8A94A6",
};

const NAV = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard },
  { id: "checklist", label: "Checklist", icon: ClipboardCheck },
  { id: "manutencao", label: "Manutenção", icon: Wrench },
  { id: "socorro", label: "Socorro", icon: Siren },
  { id: "combustivel", label: "Combustível", icon: Fuel },
  { id: "pneus", label: "Pneus", icon: CircleDot },
  { id: "lubrificacao", label: "Lubrificação", icon: Droplets },
  { id: "inspecoes", label: "Inspeções", icon: ClipboardList },
  { id: "ia", label: "IA & Integrações", icon: Sparkles },
  { id: "funcionarios", label: "Funcionários", icon: UserPlus, adminOnly: true },
];

const MOBILE_PRIMARY = ["dashboard", "checklist", "socorro", "manutencao", "ia"];

const FleetContext = createContext(null);
const useFleet = () => useContext(FleetContext);

/* ---------- dados de exemplo (usados como placeholder até o Supabase carregar) ---------- */
const VEICULOS_SEED = [
  { id: "v1", placa: "QCT-4471", categoria: "Caminhão Basculante", linha: "Pesada", km: 128430, status: "em_uso" },
  { id: "v2", placa: "PVL-0092", categoria: "Escavadeira XCMG 220", linha: "Amarela", km: 0, horas: 4210, status: "manutencao" },
  { id: "v3", placa: "QCT-1187", categoria: "Rolo Compactador", linha: "Amarela", km: 0, horas: 1890, status: "disponivel" },
  { id: "v4", placa: "RTX-8820", categoria: "Caminhonete Utilitária", linha: "Leve", km: 61230, status: "em_uso" },
  { id: "v5", placa: "QCT-5563", categoria: "Motoniveladora", linha: "Amarela", km: 0, horas: 3105, status: "parado" },
];

const STATUS_MAP = {
  em_uso: { label: "Em uso", color: COLORS.ok },
  manutencao: { label: "Manutenção", color: COLORS.alert },
  disponivel: { label: "Disponível", color: COLORS.gold },
  parado: { label: "Parado", color: COLORS.textMuted },
};

// (não usados diretamente — mantidos como referência do formato esperado)
const OS_LIST_EXEMPLO = [
  { id: "OS-2201", veiculo: "PVL-0092", tipo: "Preventiva", prioridade: "Alta", status: "Em execução", tecnico: "Branquinho" },
  { id: "OS-2198", veiculo: "QCT-5563", tipo: "Corretiva", prioridade: "Urgente", status: "Aguardando peça", tecnico: "Teodoro" },
  { id: "OS-2195", veiculo: "RTX-8820", tipo: "Preventiva", prioridade: "Média", status: "Aberta", tecnico: "—" },
  { id: "OS-2190", veiculo: "QCT-4471", tipo: "Corretiva", prioridade: "Baixa", status: "Concluída", tecnico: "João" },
];

const SOS_ATIVOS_EXEMPLO = [
  { id: "SOS-0031", veiculo: "QCT-4471", motorista: "Carlos Silva", tipo: "Mecânica", tempo: "6 min", local: "BR-101, km 212" },
];

const INTEGRACOES = [
  { nome: "Evoluma", desc: "GPS e telemetria da frota", status: "conectado" },
  { nome: "Prolog", desc: "Manutenção e checklists legados", status: "conectado" },
  { nome: "CRTI", desc: "Controle de rastreamento e inspeções", status: "erro" },
  { nome: "Evoluma Posto", desc: "Abastecimentos e notas fiscais", status: "nao_configurado" },
];

const IA_ALERTAS = [
  { titulo: "Padrão de consumo anômalo", veiculo: "QCT-4471", sev: "alta", desc: "Consumo 18% acima da média da categoria nos últimos 7 dias." },
  { titulo: "Manutenção preditiva sugerida", veiculo: "PVL-0092", sev: "media", desc: "Histórico indica troca de filtro hidráulico em ~120h de uso." },
  { titulo: "Operador com reincidência", veiculo: "QCT-1187", sev: "media", desc: "3 itens críticos reprovados nos últimos 5 checklists." },
];

const FUEL_TREND = [
  { dia: "Seg", litros: 820 }, { dia: "Ter", litros: 910 }, { dia: "Qua", litros: 760 },
  { dia: "Qui", litros: 1040 }, { dia: "Sex", litros: 980 }, { dia: "Sáb", litros: 430 }, { dia: "Dom", litros: 120 },
];

const OS_POR_TIPO = [
  { name: "Preventiva", value: 14, color: COLORS.gold },
  { name: "Corretiva", value: 6, color: COLORS.alert },
  { name: "Preditiva", value: 3, color: COLORS.ok },
];

/* ---------- shared UI bits ---------- */
function PulsoDaFrota({ variant = "normal" }) {
  const color = variant === "sos" ? COLORS.alert : COLORS.gold;
  return (
    <svg viewBox="0 0 400 40" width="100%" height="40" preserveAspectRatio="none">
      <polyline
        points="0,20 60,20 80,20 92,6 104,34 116,20 140,20 200,20 216,10 228,30 240,20 400,20"
        fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        opacity="0.9"
      >
        {variant === "sos" && (
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />
        )}
      </polyline>
    </svg>
  );
}

function Card({ children, style, className }) {
  return (
    <div
      className={className}
      style={{
        background: COLORS.raised,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
      color, background: `${color}1A`, border: `1px solid ${color}44`,
      borderRadius: 999, padding: "3px 10px", fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {children}
    </span>
  );
}

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, letterSpacing: 1.5, color: COLORS.gold, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 4 }}>
          {eyebrow}
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, margin: 0, color: COLORS.textPrimary }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function GoldButton({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: danger ? COLORS.alert : COLORS.gold,
        color: "#0A0D11",
        border: "none",
        borderRadius: 10,
        padding: "10px 16px",
        fontWeight: 700,
        fontSize: 13,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/* ---------- modules ---------- */
function Dashboard() {
  const { veiculos } = useFleet();
  return (
    <div>
      <SectionHeader eyebrow="Visão geral · agora" title="Painel da frota" />
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>Pulso da frota — 192 veículos monitorados</span>
          <Badge color={COLORS.ok}>178 operando normalmente</Badge>
        </div>
        <PulsoDaFrota />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Disponibilidade", value: "91,4%", icon: Gauge, color: COLORS.gold },
          { label: "OS abertas", value: "14", icon: Wrench, color: COLORS.alert },
          { label: "SOS ativos", value: "1", icon: Siren, color: COLORS.alert },
          { label: "Checklists hoje", value: "146/192", icon: ClipboardCheck, color: COLORS.ok },
        ].map((k) => (
          <Card key={k.label}>
            <k.icon size={18} color={k.color} />
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, marginTop: 10, color: COLORS.textPrimary }}>{k.value}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>{k.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10 }}>Consumo de combustível — 7 dias (L)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={FUEL_TREND}>
              <defs>
                <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="dia" stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />
              <Area type="monotone" dataKey="litros" stroke={COLORS.gold} fill="url(#fuelGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10 }}>OS por tipo (mês)</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={OS_POR_TIPO} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={3}>
                {OS_POR_TIPO.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 12 }}>Frota — status em tempo real</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {veiculos.map((v) => (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Truck size={16} color={COLORS.textMuted} />
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: COLORS.textPrimary }}>{v.placa || v.identificador_interno}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>{v.categoria}</div>
                </div>
              </div>
              <Badge color={(STATUS_MAP[v.status] || STATUS_MAP.disponivel).color}>{(STATUS_MAP[v.status] || STATUS_MAP.disponivel).label}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Checklist() {
  const { veiculos, token, user } = useFleet();
  const [selected, setSelected] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const itens = ["Nível de óleo", "Freios", "Pneus e calibragem", "Luzes e sinalização", "Fluído de arrefecimento", "Cinto de segurança", "Extintor / EPI"];

  async function concluir() {
    setSaving(true);
    setError("");
    try {
      // Resumo das respostas como texto — numa versão futura, cada item vira uma
      // linha em checklist_respostas ligada a um checklist_templates cadastrado.
      const resumo = Object.entries(respostas).map(([item, status]) => `${item}: ${status}`).join(" | ");
      const temCritico = Object.values(respostas).includes("critico");
      await sbInsert("checklists", [{
        veiculo_id: selected.id,
        motorista_operador_id: user.id,
        tipo: "inicio_turno",
        km_horimetro: selected.km_atual || null,
        observacoes_gerais: resumo,
        aprovado: temCritico ? false : true,
      }], token);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!selected) {
    return (
      <div>
        <SectionHeader eyebrow="Início / fim de turno" title="Checklist" />
        <Card>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 12 }}>Selecione um veículo para iniciar</div>
          <div style={{ display: "grid", gap: 8 }}>
            {veiculos.map((v) => (
              <button key={v.id} onClick={() => { setSelected(v); setRespostas({}); setSaved(false); setError(""); }} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
                padding: 12, color: COLORS.textPrimary, cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{v.placa || v.identificador_interno} — {v.categoria}</span>
                <ChevronRight size={16} color={COLORS.textMuted} />
              </button>
            ))}
            {veiculos.length === 0 && <div style={{ fontSize: 13, color: COLORS.textMuted }}>Nenhum veículo cadastrado ainda na tabela `veiculos`.</div>}
          </div>
        </Card>
      </div>
    );
  }

  if (saved) {
    return (
      <div>
        <SectionHeader eyebrow={selected.placa || selected.identificador_interno} title="Checklist enviado" />
        <Card style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.ok }}>
          <CheckCircle2 size={20} /> Registrado no Supabase com sucesso.
        </Card>
        <div style={{ marginTop: 14 }}>
          <GoldButton onClick={() => setSelected(null)}>Novo checklist</GoldButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader eyebrow={selected.placa || selected.identificador_interno} title="Checklist de início de turno" action={<button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer" }}><X size={20} /></button>} />
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {itens.map((item) => (
            <div key={item} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: 14 }}>{item}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { key: "ok", icon: CheckCircle2, color: COLORS.ok },
                  { key: "atencao", icon: AlertTriangle, color: COLORS.gold },
                  { key: "critico", icon: XCircle, color: COLORS.alert },
                ].map((opt) => (
                  <button key={opt.key} onClick={() => setRespostas((r) => ({ ...r, [item]: opt.key }))}
                    style={{
                      background: respostas[item] === opt.key ? `${opt.color}22` : "transparent",
                      border: `1px solid ${respostas[item] === opt.key ? opt.color : COLORS.border}`,
                      borderRadius: 8, padding: 6, cursor: "pointer", display: "flex",
                    }}>
                    <opt.icon size={16} color={opt.color} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && <div style={{ color: COLORS.alert, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ marginTop: 16 }}>
          <GoldButton onClick={concluir}>
            {saving ? <Loader2 size={15} className="ft-spin" /> : <CheckCircle2 size={15} />}
            {saving ? "Enviando..." : "Concluir e liberar veículo"}
          </GoldButton>
        </div>
      </Card>
    </div>
  );
}

function Manutencao() {
  const { osList, veiculos } = useFleet();
  const prioridadeColor = { urgente: COLORS.alert, alta: COLORS.alert, media: COLORS.gold, baixa: COLORS.textMuted };
  const placaDe = (id) => (veiculos.find((v) => v.id === id) || {}).placa || "—";
  return (
    <div>
      <SectionHeader eyebrow="PCM" title="Ordens de serviço" action={<GoldButton><Plus size={15} /> Nova OS</GoldButton>} />
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}` }}>
            <span>OS</span><span>Veículo</span><span>Tipo</span><span>Prioridade</span><span>Status</span>
          </div>
          {osList.map((os) => (
            <div key={os.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{os.numero_os}</span>
              <span>{placaDe(os.veiculo_id)}</span>
              <span>{os.tipo}</span>
              <span style={{ color: prioridadeColor[os.prioridade] || COLORS.textMuted }}>{os.prioridade}</span>
              <span style={{ color: COLORS.textMuted }}>{os.status}</span>
            </div>
          ))}
          {osList.length === 0 && <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "12px 0" }}>Nenhuma OS cadastrada ainda na tabela `ordens_servico`.</div>}
        </div>
      </Card>
    </div>
  );
}

function Socorro() {
  const { sosList, veiculos, token, user, refreshSos } = useFleet();
  const [triggered, setTriggered] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const meuVeiculo = veiculos[0]; // numa versão futura: veículo vinculado ao usuário logado

  function acionarSOS() {
    setSending(true);
    setError("");
    const enviar = async (lat, lng) => {
      try {
        await sbInsert("sos_chamados", [{
          veiculo_id: meuVeiculo?.id,
          solicitante_id: user.id,
          tipo: "mecanica",
          latitude: lat,
          longitude: lng,
          descricao: "Chamado acionado pelo app FrotaTech",
        }], token);
        setTriggered(true);
        refreshSos();
      } catch (e) {
        setError(e.message);
      } finally {
        setSending(false);
      }
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => enviar(pos.coords.latitude, pos.coords.longitude),
        () => enviar(0, 0) // sem permissão de GPS — grava mesmo assim
      );
    } else {
      enviar(0, 0);
    }
  }

  return (
    <div>
      <SectionHeader eyebrow="Emergência" title="Socorro em rota" />
      <Card style={{ marginBottom: 20, borderColor: sosList.length ? `${COLORS.alert}66` : COLORS.border }}>
        <PulsoDaFrota variant={sosList.length ? "sos" : "normal"} />
        <div style={{ marginTop: 10, fontSize: 13, color: COLORS.textMuted }}>
          {sosList.length} chamado(s) ativo(s) no momento
        </div>
      </Card>

      {sosList.map((s) => (
        <Card key={s.id} style={{ marginBottom: 16, border: `1px solid ${COLORS.alert}55` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <Badge color={COLORS.alert}>{s.tipo}</Badge>
            <span style={{ fontSize: 12, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> {new Date(s.acionado_em).toLocaleTimeString("pt-BR")}</span>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, marginBottom: 4 }}>{s.status}</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> {s.latitude?.toFixed(4)}, {s.longitude?.toFixed(4)}</div>
        </Card>
      ))}

      <Card>
        <div style={{ fontSize: 14, marginBottom: 10 }}>Botão de pânico — motorista / operador</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 14 }}>
          Ao acionar, a localização GPS e o veículo são enviados automaticamente e gravados no Supabase.
        </div>
        {error && <div style={{ color: COLORS.alert, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {!triggered ? (
          <button onClick={acionarSOS} disabled={sending} style={{
            width: 90, height: 90, borderRadius: "50%", background: COLORS.alert, border: "none",
            color: "#fff", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14,
            cursor: sending ? "wait" : "pointer", boxShadow: `0 0 0 8px ${COLORS.alert}22`,
          }}>
            {sending ? "..." : "SOS"}
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.ok }}>
            <CheckCircle2 size={20} /> Chamado enviado — aguardando atendimento
          </div>
        )}
      </Card>
    </div>
  );
}

function SeletorVeiculo({ value, onChange }) {
  const { veiculos } = useFleet();
  return (
    <select value={value} onChange={onChange}
      style={{ width: "100%", marginTop: 4, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }}>
      <option value="">Selecione um veículo</option>
      {veiculos.map((v) => (
        <option key={v.id} value={v.id}>{v.placa || v.identificador_interno} — {v.categoria}</option>
      ))}
    </select>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: COLORS.textMuted }}>{label}</label>
      {children}
    </div>
  );
}
const campoInputStyle = { width: "100%", marginTop: 4, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary };

function CAMPOS_ABASTECIMENTO() {
  return [
    { key: "placa", label: "Veículo (placa ou código)", obrigatorio: true, palavras: ["placa", "veiculo", "veículo", "identificador"] },
    { key: "litros", label: "Litros", obrigatorio: true, palavras: ["litro", "qtd", "quantidade"] },
    { key: "valor_litro", label: "Valor por litro (R$)", obrigatorio: false, palavras: ["valor unit", "preco", "preço", "unitario", "unitário", "r$/l"] },
    { key: "valor_total", label: "Valor total (R$)", obrigatorio: false, palavras: ["total", "valor total"] },
    { key: "km_horimetro", label: "Km / Horímetro", obrigatorio: false, palavras: ["km", "hodometro", "hodômetro", "horimetro", "horímetro"] },
    { key: "posto", label: "Posto / local", obrigatorio: false, palavras: ["posto", "local", "tanque"] },
    { key: "data", label: "Data do abastecimento", obrigatorio: false, palavras: ["data", "dia"] },
  ];
}

function adivinharColunaPorIndice(exemplos, palavras) {
  // exemplos: array de { indice, rotulo (minúsculo, ex: "coluna 3: cp-06 - tpu-8e60") }
  const achada = exemplos.find((c) => palavras.some((p) => c.rotulo.includes(p)));
  return achada ? achada.indice : "";
}

function ImportarCSVCombustivel({ onImportado }) {
  const { token, veiculos } = useFleet();
  const [aberto, setAberto] = useState(false);
  const [linhasBrutas, setLinhasBrutas] = useState([]); // array de arrays
  const [primeiraLinhaCabecalho, setPrimeiraLinhaCabecalho] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [mapa, setMapa] = useState({});
  const [extrairPlacaDoTexto, setExtrairPlacaDoTexto] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  const campos = CAMPOS_ABASTECIMENTO();
  const linhasDados = primeiraLinhaCabecalho ? linhasBrutas.slice(1) : linhasBrutas;
  const numColunas = linhasBrutas[0] ? linhasBrutas[0].length : 0;
  const opcoesColuna = Array.from({ length: numColunas }, (_, i) => {
    const exemplo = (linhasDados[0] && linhasDados[0][i] !== undefined) ? String(linhasDados[0][i]) : "";
    const rotuloBase = primeiraLinhaCabecalho && linhasBrutas[0][i] ? String(linhasBrutas[0][i]) : `Coluna ${i + 1}`;
    return { indice: i, rotulo: `${rotuloBase.toLowerCase()} (ex: ${exemplo.slice(0, 30)})`, label: `${rotuloBase} — ex: "${exemplo.slice(0, 30)}"` };
  });

  function lerArquivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    setNomeArquivo(file.name);
    setResultado(null);
    setError("");
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      delimiter: "", // autodetecta ; , ou tab
      complete: (res) => {
        const linhas = res.data;
        setLinhasBrutas(linhas);
        // heurística simples: se a primeira célula da 1ª linha é só texto (não numérico) e
        // a da 2ª linha é numérica, provavelmente a 1ª linha é cabeçalho
        const l0 = linhas[0] || [];
        const l1 = linhas[1] || [];
        const provavelCabecalho = l0[0] && isNaN(parseFloat(l0[0])) && l1[0] && !isNaN(parseFloat(l1[0]));
        setPrimeiraLinhaCabecalho(!!provavelCabecalho);
        const dados = provavelCabecalho ? linhas.slice(1) : linhas;
        const exemplos = (l0.length ? l0 : linhas[0] || []).map((_, i) => {
          const exemplo = dados[0] && dados[0][i] !== undefined ? String(dados[0][i]) : "";
          const rotuloBase = provavelCabecalho && l0[i] ? String(l0[i]) : `coluna ${i + 1}`;
          return { indice: i, rotulo: `${rotuloBase.toLowerCase()} ${exemplo.toLowerCase()}` };
        });
        const novoMapa = {};
        campos.forEach((c) => { novoMapa[c.key] = adivinharColunaPorIndice(exemplos, c.palavras); });

        // fallback: quando não há cabeçalho, adivinha pelo FORMATO do valor da 1ª linha de dados
        const linhaExemplo = dados[0] || [];
        const usados = new Set(Object.values(novoMapa).filter((v) => v !== ""));
        const livre = (i) => !usados.has(i);
        if (novoMapa.data === "") {
          const i = linhaExemplo.findIndex((v, idx) => livre(idx) && /^\d{2}\/\d{2}\/\d{4}/.test(String(v || "")));
          if (i !== -1) { novoMapa.data = i; usados.add(i); }
        }
        if (novoMapa.placa === "") {
          const i = linhaExemplo.findIndex((v, idx) => livre(idx) && / - /.test(String(v || "")) && /[A-Za-z]/.test(String(v || "")));
          if (i !== -1) { novoMapa.placa = i; usados.add(i); }
        }
        const colunasReais = [];
        linhaExemplo.forEach((v, idx) => {
          if (livre(idx) && /^R\$/i.test(String(v || "").trim())) colunasReais.push(idx);
        });
        if (novoMapa.valor_litro === "" && colunasReais[0] !== undefined) { novoMapa.valor_litro = colunasReais[0]; usados.add(colunasReais[0]); }
        if (novoMapa.valor_total === "" && colunasReais[1] !== undefined) { novoMapa.valor_total = colunasReais[1]; usados.add(colunasReais[1]); }
        if (novoMapa.litros === "") {
          const i = linhaExemplo.findIndex((v, idx) => {
            if (!livre(idx)) return false;
            const s = String(v || "").trim();
            if (!/^\d+(\.\d+)?$/.test(s)) return false;
            const n = parseFloat(s);
            return n > 0 && n < 5000; // litros plausíveis; evita casar com IDs grandes
          });
          if (i !== -1) { novoMapa.litros = i; usados.add(i); }
        }
        if (novoMapa.posto === "") {
          const i = linhaExemplo.findIndex((v, idx) => livre(idx) && /tanque|posto|patio|pátio/i.test(String(v || "")));
          if (i !== -1) { novoMapa.posto = i; usados.add(i); }
        }

        setMapa(novoMapa);
        // se a coluna de veículo tiver "-" ou " - " no meio do valor, sugere extrair a placa do texto
        const idxVeiculo = novoMapa.placa;
        const exemploVeiculo = idxVeiculo !== "" && dados[0] ? String(dados[0][idxVeiculo] || "") : "";
        setExtrairPlacaDoTexto(/[A-Za-z]{2,4}-\d{2}\s*-\s*/.test(exemploVeiculo));
      },
      error: (err) => setError("Não consegui ler o arquivo: " + err.message),
    });
  }

  function normalizarPlaca(v) {
    return (v || "").toString().trim().toUpperCase().replace(/[\s-]/g, "");
  }

  function extrairPlacaOficial(valor) {
    // formato Evoluma: "CP-06 - TPU-8E60" → pega a parte depois do último " - "
    const partes = valor.split(" - ");
    return partes.length > 1 ? partes[partes.length - 1] : valor;
  }

  function paraNumero(v) {
    if (v === undefined || v === null || v === "") return null;
    let s = v.toString().trim().replace(/^R\$\s*/i, "").trim();
    if (s === "" || s === "-") return null;
    if (s.includes(",")) {
      // formato brasileiro: ponto = milhar, vírgula = decimal
      s = s.replace(/\./g, "").replace(",", ".");
    }
    // senão, assume que o ponto já é o separador decimal (ex: 374.68)
    s = s.replace(/[^\d.-]/g, "");
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function parseDataBR(v) {
    const m = v.toString().match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return undefined;
    const [, d, mo, y, h = "00", mi = "00", s = "00"] = m;
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).toISOString();
  }

  async function confirmarImportacao() {
    if (mapa.placa === "" || mapa.placa === undefined || mapa.litros === "" || mapa.litros === undefined) {
      setError("Mapeie pelo menos as colunas de veículo e litros.");
      return;
    }
    setImportando(true); setError(""); setResultado(null);

    // índice de busca: tenta primeiro pela placa oficial, depois pelo código interno da frota
    const porPlacaOficial = {};
    const porCodigoInterno = {};
    veiculos.forEach((v) => {
      if (v.placa_oficial) porPlacaOficial[normalizarPlaca(v.placa_oficial)] = v.id;
      const codigo = normalizarPlaca(v.placa || v.identificador_interno);
      if (codigo) porCodigoInterno[codigo] = v.id;
    });

    const payload = [];
    const semVeiculo = new Set();
    for (const linha of linhasDados) {
      let bruto = (linha[mapa.placa] || "").toString().trim();
      if (!bruto) continue;
      const candidato = extrairPlacaDoTexto ? extrairPlacaOficial(bruto) : bruto;
      const chave = normalizarPlaca(candidato);
      const veiculo_id = porPlacaOficial[chave] || porCodigoInterno[chave] || porCodigoInterno[normalizarPlaca(bruto.split(" - ")[0] || "")];
      if (!veiculo_id) { semVeiculo.add(bruto); continue; }

      const litros = paraNumero(linha[mapa.litros]);
      if (!litros) continue;
      const valor_litro = mapa.valor_litro !== "" && mapa.valor_litro !== undefined ? paraNumero(linha[mapa.valor_litro]) : null;
      let valor_total = mapa.valor_total !== "" && mapa.valor_total !== undefined ? paraNumero(linha[mapa.valor_total]) : null;
      if (!valor_total && valor_litro) valor_total = litros * valor_litro;

      payload.push({
        veiculo_id, litros,
        valor_litro: valor_litro || 0,
        valor_total: valor_total || 0,
        km_horimetro: mapa.km_horimetro !== "" && mapa.km_horimetro !== undefined ? paraNumero(linha[mapa.km_horimetro]) : null,
        posto: mapa.posto !== "" && mapa.posto !== undefined ? (linha[mapa.posto] || null) : null,
        fonte_integracao: "evoluma_csv",
        ...(mapa.data !== "" && mapa.data !== undefined && linha[mapa.data] ? { registrado_em: parseDataBR(linha[mapa.data]) } : {}),
      });
    }

    try {
      const tamanhoLote = 200;
      let inseridos = 0;
      for (let i = 0; i < payload.length; i += tamanhoLote) {
        const lote = payload.slice(i, i + tamanhoLote);
        await sbInsert("abastecimentos", lote, token);
        inseridos += lote.length;
      }
      setResultado({ inseridos, ignorados: linhasDados.length - payload.length, semVeiculo: Array.from(semVeiculo) });
      onImportado();
    } catch (e) {
      setError(e.message);
    } finally {
      setImportando(false);
    }
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} style={{
        background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 10, color: COLORS.textMuted,
        padding: "10px 16px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
      }}>
        <Link2 size={14} /> Importar CSV do Evoluma
      </button>
    );
  }

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Importar abastecimentos (CSV do Evoluma)</div>
        <button onClick={() => setAberto(false)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer" }}><X size={18} /></button>
      </div>

      <input type="file" accept=".csv,.txt" onChange={lerArquivo}
        style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 14 }} />

      {linhasBrutas.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>
            {nomeArquivo} — {linhasDados.length} linhas detectadas ({numColunas} colunas). Confirme o mapeamento:
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, marginBottom: 14 }}>
            <input type="checkbox" checked={primeiraLinhaCabecalho} onChange={(e) => setPrimeiraLinhaCabecalho(e.target.checked)} />
            A primeira linha do arquivo é um cabeçalho (nomes de coluna)
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 12, marginBottom: 10 }}>
            {campos.map((c) => (
              <Campo key={c.key} label={c.label + (c.obrigatorio ? " *" : "")}>
                <select value={mapa[c.key] ?? ""} onChange={(e) => setMapa((m) => ({ ...m, [c.key]: e.target.value === "" ? "" : Number(e.target.value) }))} style={campoInputStyle}>
                  <option value="">— não usar —</option>
                  {opcoesColuna.map((o) => <option key={o.indice} value={o.indice}>{o.label}</option>)}
                </select>
              </Campo>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, marginBottom: 14 }}>
            <input type="checkbox" checked={extrairPlacaDoTexto} onChange={(e) => setExtrairPlacaDoTexto(e.target.checked)} />
            A coluna do veículo vem no formato "código - placa" (ex: CP-06 - TPU-8E60) — extrair só a placa
          </label>

          {error && <div style={{ color: COLORS.alert, fontSize: 12, marginBottom: 10 }}>{error}</div>}

          {resultado && (
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
              <div style={{ color: COLORS.ok, marginBottom: 4 }}>✓ {resultado.inseridos} abastecimentos importados com sucesso.</div>
              {resultado.ignorados > 0 && <div style={{ color: COLORS.textMuted }}>{resultado.ignorados} linhas ignoradas (sem litros ou veículo não encontrado).</div>}
              {resultado.semVeiculo.length > 0 && (
                <div style={{ color: COLORS.gold, marginTop: 6 }}>
                  Veículos não encontrados na frota: {resultado.semVeiculo.slice(0, 15).join(", ")}{resultado.semVeiculo.length > 15 ? "..." : ""}
                </div>
              )}
            </div>
          )}

          <GoldButton onClick={confirmarImportacao}>
            {importando ? <Loader2 size={15} className="ft-spin" /> : <Plus size={15} />}
            {importando ? "Importando..." : `Confirmar importação (${linhasDados.length} linhas)`}
          </GoldButton>
        </>
      )}
    </Card>
  );
}

function Combustivel() {
  const { token, veiculos, refresh } = useFleet();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({ veiculo_id: "", litros: "", valor_litro: "", posto: "", km_horimetro: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await sbSelect("abastecimentos", "select=id,litros,valor_litro,valor_total,posto,registrado_em,veiculos(placa,identificador_interno)&order=registrado_em.desc&limit=50", token);
      setLista(dados);
    } catch (e) { /* silencioso */ } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function registrar(e) {
    e.preventDefault();
    if (!form.veiculo_id || !form.litros) { setError("Selecione o veículo e informe os litros."); return; }
    setSaving(true); setError("");
    try {
      const litros = parseFloat(form.litros);
      const valor_litro = parseFloat(form.valor_litro || 0);
      await sbInsert("abastecimentos", [{
        veiculo_id: form.veiculo_id,
        litros, valor_litro,
        valor_total: litros * valor_litro,
        km_horimetro: form.km_horimetro ? parseFloat(form.km_horimetro) : null,
        posto: form.posto || null,
      }], token);
      setForm({ veiculo_id: "", litros: "", valor_litro: "", posto: "", km_horimetro: "" });
      carregar();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <SectionHeader eyebrow="Evoluma Posto" title="Combustível" action={<ImportarCSVCombustivel onImportado={carregar} />} />
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12 }}>
          <Campo label="Veículo"><SeletorVeiculo value={form.veiculo_id} onChange={(e) => setForm((f) => ({ ...f, veiculo_id: e.target.value }))} /></Campo>
          <Campo label="Litros"><input style={campoInputStyle} type="number" value={form.litros} onChange={(e) => setForm((f) => ({ ...f, litros: e.target.value }))} /></Campo>
          <Campo label="R$ por litro"><input style={campoInputStyle} type="number" step="0.01" value={form.valor_litro} onChange={(e) => setForm((f) => ({ ...f, valor_litro: e.target.value }))} /></Campo>
          <Campo label="Km/Horímetro"><input style={campoInputStyle} type="number" value={form.km_horimetro} onChange={(e) => setForm((f) => ({ ...f, km_horimetro: e.target.value }))} /></Campo>
          <Campo label="Posto"><input style={campoInputStyle} value={form.posto} onChange={(e) => setForm((f) => ({ ...f, posto: e.target.value }))} /></Campo>
        </div>
        {error && <div style={{ color: COLORS.alert, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ marginTop: 14 }}>
          <GoldButton onClick={registrar}>{saving ? <Loader2 size={15} className="ft-spin" /> : <Plus size={15} />} {saving ? "Registrando..." : "Registrar abastecimento"}</GoldButton>
        </div>
      </Card>
      <Card>
        {carregando ? <div style={{ color: COLORS.textMuted, fontSize: 13 }}>Carregando...</div> : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}` }}>
              <span>Veículo</span><span>Litros</span><span>R$/L</span><span>Total</span><span>Posto</span>
            </div>
            {lista.map((a) => (
              <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                <span>{a.veiculos?.placa || a.veiculos?.identificador_interno || "—"}</span>
                <span>{a.litros} L</span>
                <span>R$ {Number(a.valor_litro).toFixed(2)}</span>
                <span>R$ {Number(a.valor_total).toFixed(2)}</span>
                <span>{a.posto || "—"}</span>
              </div>
            ))}
            {lista.length === 0 && <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "10px 0" }}>Nenhum abastecimento registrado ainda.</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

function Pneus() {
  const { token } = useFleet();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({ numero_fogo: "", marca: "", modelo: "", medida: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await sbSelect("pneus", "select=id,numero_fogo,marca,modelo,medida,status&order=numero_fogo.asc&limit=100", token);
      setLista(dados);
    } catch (e) { /* silencioso */ } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function registrar(e) {
    e.preventDefault();
    if (!form.numero_fogo) { setError("Informe o número de fogo."); return; }
    setSaving(true); setError("");
    try {
      await sbInsert("pneus", [{ numero_fogo: form.numero_fogo, marca: form.marca || null, modelo: form.modelo || null, medida: form.medida || null, status: "novo" }], token);
      setForm({ numero_fogo: "", marca: "", modelo: "", medida: "" });
      carregar();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  const statusColor = { novo: COLORS.ok, em_uso: COLORS.gold, recapado: COLORS.textMuted, sucata: COLORS.alert };

  return (
    <div>
      <SectionHeader eyebrow="Controle" title="Pneus" />
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12 }}>
          <Campo label="Número de fogo"><input style={campoInputStyle} value={form.numero_fogo} onChange={(e) => setForm((f) => ({ ...f, numero_fogo: e.target.value }))} /></Campo>
          <Campo label="Marca"><input style={campoInputStyle} value={form.marca} onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))} /></Campo>
          <Campo label="Modelo"><input style={campoInputStyle} value={form.modelo} onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))} /></Campo>
          <Campo label="Medida"><input style={campoInputStyle} value={form.medida} onChange={(e) => setForm((f) => ({ ...f, medida: e.target.value }))} /></Campo>
        </div>
        {error && <div style={{ color: COLORS.alert, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ marginTop: 14 }}>
          <GoldButton onClick={registrar}>{saving ? <Loader2 size={15} className="ft-spin" /> : <Plus size={15} />} {saving ? "Cadastrando..." : "Cadastrar pneu"}</GoldButton>
        </div>
      </Card>
      <Card>
        {carregando ? <div style={{ color: COLORS.textMuted, fontSize: 13 }}>Carregando...</div> : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}` }}>
              <span>Fogo</span><span>Marca</span><span>Modelo</span><span>Medida</span><span>Status</span>
            </div>
            {lista.map((p) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.numero_fogo}</span>
                <span>{p.marca || "—"}</span>
                <span>{p.modelo || "—"}</span>
                <span>{p.medida || "—"}</span>
                <Badge color={statusColor[p.status] || COLORS.textMuted}>{p.status}</Badge>
              </div>
            ))}
            {lista.length === 0 && <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "10px 0" }}>Nenhum pneu cadastrado ainda.</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

function Lubrificacao() {
  const { token } = useFleet();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({ veiculo_id: "", produto_utilizado: "", km_horimetro: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await sbSelect("lubrificacoes", "select=id,produto_utilizado,km_horimetro,registrado_em,veiculos(placa,identificador_interno)&order=registrado_em.desc&limit=50", token);
      setLista(dados);
    } catch (e) { /* silencioso */ } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function registrar(e) {
    e.preventDefault();
    if (!form.veiculo_id || !form.produto_utilizado) { setError("Selecione o veículo e informe o produto."); return; }
    setSaving(true); setError("");
    try {
      await sbInsert("lubrificacoes", [{
        veiculo_id: form.veiculo_id,
        produto_utilizado: form.produto_utilizado,
        km_horimetro: form.km_horimetro ? parseFloat(form.km_horimetro) : null,
      }], token);
      setForm({ veiculo_id: "", produto_utilizado: "", km_horimetro: "" });
      carregar();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <SectionHeader eyebrow="PCM" title="Lubrificação" />
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12 }}>
          <Campo label="Veículo"><SeletorVeiculo value={form.veiculo_id} onChange={(e) => setForm((f) => ({ ...f, veiculo_id: e.target.value }))} /></Campo>
          <Campo label="Produto utilizado"><input style={campoInputStyle} value={form.produto_utilizado} onChange={(e) => setForm((f) => ({ ...f, produto_utilizado: e.target.value }))} /></Campo>
          <Campo label="Km/Horímetro"><input style={campoInputStyle} type="number" value={form.km_horimetro} onChange={(e) => setForm((f) => ({ ...f, km_horimetro: e.target.value }))} /></Campo>
        </div>
        {error && <div style={{ color: COLORS.alert, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ marginTop: 14 }}>
          <GoldButton onClick={registrar}>{saving ? <Loader2 size={15} className="ft-spin" /> : <Plus size={15} />} {saving ? "Registrando..." : "Registrar aplicação"}</GoldButton>
        </div>
      </Card>
      <Card>
        {carregando ? <div style={{ color: COLORS.textMuted, fontSize: 13 }}>Carregando...</div> : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}` }}>
              <span>Veículo</span><span>Produto</span><span>Km/Horímetro</span><span>Data</span>
            </div>
            {lista.map((l) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                <span>{l.veiculos?.placa || l.veiculos?.identificador_interno || "—"}</span>
                <span>{l.produto_utilizado}</span>
                <span>{l.km_horimetro ?? "—"}</span>
                <span>{new Date(l.registrado_em).toLocaleDateString("pt-BR")}</span>
              </div>
            ))}
            {lista.length === 0 && <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "10px 0" }}>Nenhuma lubrificação registrada ainda.</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

function Inspecoes() {
  const { token } = useFleet();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({ veiculo_id: "", tipo: "", nota_geral: "", km_horimetro: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await sbSelect("inspecoes", "select=id,tipo,nota_geral,km_horimetro,data_inspecao,veiculos(placa,identificador_interno)&order=data_inspecao.desc&limit=50", token);
      setLista(dados);
    } catch (e) { /* silencioso */ } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function registrar(e) {
    e.preventDefault();
    if (!form.veiculo_id || !form.tipo) { setError("Selecione o veículo e informe o tipo de inspeção."); return; }
    setSaving(true); setError("");
    try {
      await sbInsert("inspecoes", [{
        veiculo_id: form.veiculo_id,
        tipo: form.tipo,
        nota_geral: form.nota_geral ? parseFloat(form.nota_geral) : null,
        km_horimetro: form.km_horimetro ? parseFloat(form.km_horimetro) : null,
      }], token);
      setForm({ veiculo_id: "", tipo: "", nota_geral: "", km_horimetro: "" });
      carregar();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <SectionHeader eyebrow="Campo" title="Inspeções" />
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12 }}>
          <Campo label="Veículo"><SeletorVeiculo value={form.veiculo_id} onChange={(e) => setForm((f) => ({ ...f, veiculo_id: e.target.value }))} /></Campo>
          <Campo label="Tipo de inspeção"><input style={campoInputStyle} placeholder="ex: quinzenal_maquinas_pesadas" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} /></Campo>
          <Campo label="Nota geral (0-10)"><input style={campoInputStyle} type="number" step="0.1" value={form.nota_geral} onChange={(e) => setForm((f) => ({ ...f, nota_geral: e.target.value }))} /></Campo>
          <Campo label="Km/Horímetro"><input style={campoInputStyle} type="number" value={form.km_horimetro} onChange={(e) => setForm((f) => ({ ...f, km_horimetro: e.target.value }))} /></Campo>
        </div>
        {error && <div style={{ color: COLORS.alert, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ marginTop: 14 }}>
          <GoldButton onClick={registrar}>{saving ? <Loader2 size={15} className="ft-spin" /> : <Plus size={15} />} {saving ? "Registrando..." : "Registrar inspeção"}</GoldButton>
        </div>
      </Card>
      <Card>
        {carregando ? <div style={{ color: COLORS.textMuted, fontSize: 13 }}>Carregando...</div> : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}` }}>
              <span>Veículo</span><span>Tipo</span><span>Nota</span><span>Data</span>
            </div>
            {lista.map((i) => (
              <div key={i.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                <span>{i.veiculos?.placa || i.veiculos?.identificador_interno || "—"}</span>
                <span>{i.tipo}</span>
                <span>{i.nota_geral ?? "—"}</span>
                <span>{new Date(i.data_inspecao).toLocaleDateString("pt-BR")}</span>
              </div>
            ))}
            {lista.length === 0 && <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "10px 0" }}>Nenhuma inspeção registrada ainda.</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

function IaIntegracoes() {
  const statusColor = { conectado: COLORS.ok, erro: COLORS.alert, nao_configurado: COLORS.textMuted };
  const statusLabel = { conectado: "Conectado", erro: "Erro de conexão", nao_configurado: "Não configurado" };
  const sevColor = { alta: COLORS.alert, media: COLORS.gold, baixa: COLORS.textMuted };
  return (
    <div>
      <SectionHeader eyebrow="Inteligência artificial" title="IA & Integrações" />

      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10 }}>Fontes de dados externas</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 12, marginBottom: 24 }}>
        {INTEGRACOES.map((it) => (
          <Card key={it.nome}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link2 size={15} color={COLORS.gold} />
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15 }}>{it.nome}</span>
              </div>
              <RefreshCw size={13} color={COLORS.textMuted} />
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>{it.desc}</div>
            <Badge color={statusColor[it.status]}>{statusLabel[it.status]}</Badge>
          </Card>
        ))}
      </div>

      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10 }}>Alertas gerados por IA</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {IA_ALERTAS.map((a, i) => (
          <Card key={i} style={{ borderLeft: `3px solid ${sevColor[a.sev]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15 }}>{a.titulo}</span>
              <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{a.veiculo}</span>
            </div>
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>{a.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function entrar(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await sbAuth(cpfParaEmail(cpf), nascParaSenha(nascimento));
      onLogin(data);
    } catch (e) {
      setError("CPF ou data de nascimento incorretos, ou sua conta ainda não foi cadastrada pelo administrador.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: COLORS.bg, fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap');
      `}</style>
      <div style={{ width: 320, background: COLORS.raised, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: COLORS.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Truck size={17} color="#0A0D11" />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: COLORS.textPrimary }}>FrotaTech</span>
        </div>

        <label style={{ fontSize: 12, color: COLORS.textMuted }}>CPF</label>
        <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00"
          style={{ width: "100%", marginTop: 4, marginBottom: 14, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }} />

        <label style={{ fontSize: 12, color: COLORS.textMuted }}>Data de nascimento</label>
        <input value={nascimento} onChange={(e) => setNascimento(e.target.value)} type="date"
          style={{ width: "100%", marginTop: 4, marginBottom: 18, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }} />

        {error && <div style={{ color: COLORS.alert, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <button type="button" onClick={entrar} disabled={loading} style={{
          width: "100%", background: COLORS.gold, color: "#0A0D11", border: "none", borderRadius: 10,
          padding: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer",
        }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 14, lineHeight: 1.5 }}>
          Sua conta é criada pelo administrador no painel. Se ainda não tem acesso, procure seu gestor.
        </div>
      </div>
    </div>
  );
}

function CadastroFuncionario() {
  const { token } = useFleet();
  const [form, setForm] = useState({ nome: "", cpf: "", nascimento: "", telefone: "", role: "motorista" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ultimoCriado, setUltimoCriado] = useState(null);
  const [funcionarios, setFuncionarios] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [busca, setBusca] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function carregarFuncionarios() {
    setCarregandoLista(true);
    try {
      const lista = await sbSelect("profiles", "select=id,full_name,role,cpf,telefone,criado_em&order=full_name.asc", token);
      setFuncionarios(lista);
    } catch (e) {
      // silencioso — a lista é um extra, não bloqueia o cadastro
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => { carregarFuncionarios(); }, []);

  async function cadastrar(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await cadastrarFuncionarioSeguro({
        nome: form.nome,
        cpf: form.cpf,
        nascimento: form.nascimento,
        telefone: form.telefone,
        role: form.role,
      }, token);
      setUltimoCriado({ nome: form.nome, cpf: form.cpf });
      setForm({ nome: "", cpf: "", nascimento: "", telefone: "", role: "motorista" });
      carregarFuncionarios();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const roleLabel = { motorista: "Motorista", operador: "Operador", mecanico: "Mecânico", supervisor: "Supervisor", gestor: "Gestor", admin: "Administrador" };
  const filtrados = funcionarios.filter((f) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return (f.full_name || "").toLowerCase().includes(termo) || (f.cpf || "").includes(termo.replace(/\D/g, ""));
  });

  return (
    <div>
      <SectionHeader eyebrow="Administração" title="Cadastro de funcionários" />
      <Card>
        <div style={{ display: "grid", gap: 14, maxWidth: 420 }}>
          <div>
            <label style={{ fontSize: 12, color: COLORS.textMuted }}>Nome completo</label>
            <input value={form.nome} onChange={set("nome")} required
              style={{ width: "100%", marginTop: 4, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: COLORS.textMuted }}>CPF</label>
            <input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" required
              style={{ width: "100%", marginTop: 4, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: COLORS.textMuted }}>Data de nascimento (vira a senha inicial)</label>
            <input value={form.nascimento} onChange={set("nascimento")} type="date" required
              style={{ width: "100%", marginTop: 4, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: COLORS.textMuted }}>Telefone</label>
            <input value={form.telefone} onChange={set("telefone")} placeholder="(48) 90000-0000"
              style={{ width: "100%", marginTop: 4, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: COLORS.textMuted }}>Papel no sistema</label>
            <select value={form.role} onChange={set("role")}
              style={{ width: "100%", marginTop: 4, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }}>
              <option value="motorista">Motorista</option>
              <option value="operador">Operador</option>
              <option value="mecanico">Mecânico</option>
              <option value="supervisor">Supervisor</option>
              <option value="gestor">Gestor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {error && <div style={{ color: COLORS.alert, fontSize: 12 }}>{error}</div>}
          {ultimoCriado && (
            <div style={{ color: COLORS.ok, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={14} /> {ultimoCriado.nome} cadastrado(a) com sucesso.
            </div>
          )}
          <div>
            <GoldButton onClick={cadastrar}>
              {saving ? <Loader2 size={15} className="ft-spin" /> : <Plus size={15} />}
              {saving ? "Cadastrando..." : "Cadastrar funcionário"}
            </GoldButton>
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 28, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: COLORS.textMuted }}>Funcionários cadastrados ({funcionarios.length})</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 10px", minWidth: 220 }}>
          <Search size={14} color={COLORS.textMuted} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou CPF"
            style={{ background: "none", border: "none", outline: "none", color: COLORS.textPrimary, fontSize: 13, width: "100%" }} />
        </div>
      </div>

      <Card>
        {carregandoLista ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.textMuted, fontSize: 13 }}>
            <Loader2 size={14} className="ft-spin" /> Carregando funcionários...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}` }}>
              <span>Nome</span><span>CPF</span><span>Telefone</span><span>Papel</span>
            </div>
            {filtrados.map((f) => (
              <div key={f.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                <span>{f.full_name}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted }}>{f.cpf}</span>
                <span style={{ color: COLORS.textMuted }}>{f.telefone || "—"}</span>
                <Badge color={f.role === "admin" || f.role === "gestor" ? COLORS.gold : COLORS.textMuted}>{roleLabel[f.role] || f.role}</Badge>
              </div>
            ))}
            {filtrados.length === 0 && (
              <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "12px 0" }}>
                {busca ? "Nenhum funcionário encontrado com esse termo." : "Nenhum funcionário cadastrado ainda."}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function TrocaSenhaObrigatoria({ onTrocada }) {
  const { token, user } = useFleet();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function trocar(e) {
    e.preventDefault();
    setError("");
    if (senha.length < 6) {
      setError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setError("As senhas não conferem.");
      return;
    }
    setSaving(true);
    try {
      await sbUpdatePassword(senha, token);
      await sbUpdate("profiles", `id=eq.${user.id}`, { senha_temporaria: false }, token);
      onTrocada();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: COLORS.bg, fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ width: 340, background: COLORS.raised, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: COLORS.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Truck size={17} color="#0A0D11" />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: COLORS.textPrimary }}>FrotaTech</span>
        </div>

        <div style={{ fontSize: 14, color: COLORS.textPrimary, marginBottom: 4, fontWeight: 600 }}>Troque sua senha</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
          Por segurança, você precisa definir uma senha própria antes de continuar — a data de nascimento era só temporária.
        </div>

        <label style={{ fontSize: 12, color: COLORS.textMuted }}>Nova senha</label>
        <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password"
          style={{ width: "100%", marginTop: 4, marginBottom: 14, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }} />

        <label style={{ fontSize: 12, color: COLORS.textMuted }}>Confirme a nova senha</label>
        <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} type="password"
          style={{ width: "100%", marginTop: 4, marginBottom: 18, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.textPrimary }} />

        {error && <div style={{ color: COLORS.alert, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <button type="button" onClick={trocar} disabled={saving} style={{
          width: "100%", background: COLORS.gold, color: "#0A0D11", border: "none", borderRadius: 10,
          padding: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer",
        }}>
          {saving ? "Salvando..." : "Definir nova senha"}
        </button>
      </div>
    </div>
  );
}

const SCREENS = {
  dashboard: Dashboard,
  checklist: Checklist,
  manutencao: Manutencao,
  socorro: Socorro,
  combustivel: Combustivel,
  pneus: Pneus,
  lubrificacao: Lubrificacao,
  inspecoes: Inspecoes,
  ia: IaIntegracoes,
  funcionarios: CadastroFuncionario,
};

function AppShell() {
  const [active, setActive] = useState("dashboard");
  const fleet = useFleet();
  const Screen = SCREENS[active];

  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      background: COLORS.bg,
      color: COLORS.textPrimary,
      minHeight: "100vh",
      display: "flex",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 8px; }
        .ft-spin { animation: ft-spin 1s linear infinite; }
        @keyframes ft-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Sidebar (desktop) */}
      <aside className="ft-sidebar" style={{
        width: 220, borderRight: `1px solid ${COLORS.border}`, padding: "24px 14px",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 28 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: COLORS.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Truck size={16} color="#0A0D11" />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>FrotaTech</span>
        </div>
        {NAV.filter((n) => !n.adminOnly || fleet.isAdmin).map((n) => (
          <button key={n.id} onClick={() => setActive(n.id)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
            background: active === n.id ? COLORS.raised : "transparent",
            border: "none", color: active === n.id ? COLORS.gold : COLORS.textMuted,
            fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left",
          }}>
            <n.icon size={17} />
            {n.label}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <header style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 24px", borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.textMuted, fontSize: 13 }}>
            <Search size={15} /> Buscar veículo, OS, motorista...
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Bell size={17} color={COLORS.textMuted} />
            <Settings size={17} color={COLORS.textMuted} />
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>{fleet.profile?.full_name || fleet.user?.email?.split("@")[0]}</span>
            <button onClick={fleet.logout} title="Sair" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
              <LogOut size={17} color={COLORS.textMuted} />
            </button>
          </div>
        </header>
        <div style={{ padding: "24px 24px 90px 24px", maxWidth: 1100 }}>
          {fleet.loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.textMuted, fontSize: 13 }}>
              <Loader2 size={16} className="ft-spin" /> Carregando dados da frota...
            </div>
          ) : <Screen />}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="ft-bottomnav" style={{
        display: "none", position: "fixed", bottom: 0, left: 0, right: 0,
        background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`,
        padding: "8px 4px", justifyContent: "space-around",
      }}>
        {NAV.filter((n) => MOBILE_PRIMARY.includes(n.id)).map((n) => (
          <button key={n.id} onClick={() => setActive(n.id)} style={{
            background: "none", border: "none", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 3, color: active === n.id ? COLORS.gold : COLORS.textMuted,
            fontSize: 10, cursor: "pointer", padding: 4,
          }}>
            <n.icon size={19} />
            {n.label}
          </button>
        ))}
      </nav>

      <style>{`
        @media (max-width: 780px) {
          .ft-sidebar { display: none; }
          .ft-bottomnav { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

export default function FrotaTechApp() {
  const [session, setSession] = useState(null); // { access_token, user }
  const [profile, setProfile] = useState(null);
  const [veiculos, setVeiculos] = useState(VEICULOS_SEED);
  const [osList, setOsList] = useState([]);
  const [sosList, setSosList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  async function loadData(token, userId) {
    setLoading(true);
    setLoadError("");
    try {
      const [v, o, s, p] = await Promise.all([
        sbSelect("veiculos", "select=*&order=placa.asc", token),
        sbSelect("ordens_servico", "select=*&order=data_abertura.desc&limit=20", token),
        sbSelect("sos_chamados", "select=*&status=in.(acionado,a_caminho,em_atendimento)&order=acionado_em.desc", token),
        sbSelect("profiles", `select=*&id=eq.${userId}`, token),
      ]);
      setVeiculos(v.length ? v : VEICULOS_SEED);
      setOsList(o);
      setSosList(s);
      setProfile(p[0] || null);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(data) {
    setSession(data);
    loadData(data.access_token, data.user.id);
  }

  function logout() {
    setSession(null);
    setProfile(null);
    setVeiculos(VEICULOS_SEED);
    setOsList([]);
    setSosList([]);
  }

  if (!session) return <Login onLogin={handleLogin} />;

  const isAdmin = profile?.role === "admin" || profile?.role === "gestor";

  const contextValue = {
    token: session.access_token,
    user: session.user,
    profile, isAdmin,
    veiculos, osList, sosList, loading, loadError,
    refresh: () => loadData(session.access_token, session.user.id),
    refreshSos: async () => setSosList(await sbSelect("sos_chamados", "select=*&status=in.(acionado,a_caminho,em_atendimento)&order=acionado_em.desc", session.access_token)),
    logout,
  };

  if (!loading && profile?.senha_temporaria) {
    return (
      <FleetContext.Provider value={contextValue}>
        <TrocaSenhaObrigatoria onTrocada={() => setProfile((p) => ({ ...p, senha_temporaria: false }))} />
      </FleetContext.Provider>
    );
  }

  return (
    <FleetContext.Provider value={contextValue}>
      <AppShell />
    </FleetContext.Provider>
  );
}
