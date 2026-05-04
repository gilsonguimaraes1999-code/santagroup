import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Globe, LogOut, LayoutDashboard, Settings, 
  Users, User, Shield, Trash2, Search, Type, Image as ImageIcon,
  ChevronRight, CircleAlert, CircleCheck, Circle, Copy, Pen, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PromoType, Promotion, Account, Country, AppSettings, LinkByCity, City 
} from './types';
import { DEFAULT_COUNTRIES } from './constants';
import * as api from './services/api';

// Branding / Theme Colors are handled via Tailwind classes: 
// brand-primary (#e5c12f), background (#050505)

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [auth, setAuth] = useState<{
    isAuthenticated: boolean;
    role: 'OWNER' | 'ADMIN' | 'COMERCIAL' | 'visitante';
    name?: string;
  }>(() => {
    const role = localStorage.getItem('sg_hub_role') as any;
    const name = localStorage.getItem('sg_hub_name');
    return {
      isAuthenticated: localStorage.getItem('sg_hub_auth') === 'true',
      role: role || 'visitante',
      name: name || undefined
    };
  });

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [countries, setCountries] = useState<Country[]>(DEFAULT_COUNTRIES);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [view, setView] = useState<'dashboard' | 'details' | 'form' | 'settings' | 'countries' | 'accounts'>('dashboard');
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<{
    interface: boolean | null;
    locais: boolean | null;
    contas: boolean | null;
    promocao: boolean | null;
    configuracao: boolean | null;
  } | null>(null);

  const [saveProgress, setSaveProgress] = useState<{
    status: 'idle' | 'saving' | 'success' | 'error';
    steps: {
      validating: boolean | null;
      id: boolean | null;
      script: boolean | null;
      sheet: boolean | null;
      panel: boolean | null;
    };
    errorMsg?: string;
  } | null>(null);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaultSettings: AppSettings = {
      appTitle: "Manual do Vendedor",
      sidebarTitle: "SANTAGROUP",
      sidebarSubtitle: "MANUAL DO VENDEDOR",
      dashboardTitle: "Manual Comercial",
      dashboardSubtitle: "Bem-vindo ao Comercial SantaGroup. Selecione uma promoção para ver os detalhes.",
      loginTitle: "SG HUB Manager",
      loginSubtitle: "Acesse o gerenciador de ofertas",
      loginFooter: "Painel Premium de Gestão de Ofertas Hub SantaGroup",
      logoUrl: null,
      useLogoImage: false
    };
    const saved = localStorage.getItem('sg_hub_settings');
    if (saved) {
      try { return { ...defaultSettings, ...JSON.parse(saved) }; } catch { return defaultSettings; }
    }
    return defaultSettings;
  });

  // Data Loading and Sync
  const performBootstrap = async () => {
    setIsSyncing(true);
    setBootstrapStatus({
      interface: null,
      locais: null,
      contas: null,
      promocao: null,
      configuracao: null
    });

    try {
      const global = await api.getGlobalData();
      
      // Update check-in items (simulated for UI feedback)
      const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      setBootstrapStatus(prev => ({ ...prev!, interface: true }));
      await wait(300);
      setBootstrapStatus(prev => ({ ...prev!, locais: true }));
      setCountries(global.countries || DEFAULT_COUNTRIES);
      await wait(300);
      setBootstrapStatus(prev => ({ ...prev!, contas: true }));
      setAccounts(global.accounts || []);
      await wait(300);
      setBootstrapStatus(prev => ({ ...prev!, promocao: true }));
      setPromotions(global.promotions || []);
      await wait(300);
      setBootstrapStatus(prev => ({ ...prev!, configuracao: true }));
      if (global.settings) setSettings(s => ({ ...s, ...global.settings }));
      await wait(600);

      setIsDataLoaded(true);
      setBootstrapStatus(null); // Close the checklist
    } catch (error) {
      console.error("Bootstrap Error:", error);
      // Mark errors in checklist
      setBootstrapStatus(prev => ({
        interface: prev?.interface ?? false,
        locais: prev?.locais ?? false,
        contas: prev?.contas ?? false,
        promocao: prev?.promocao ?? false,
        configuracao: prev?.configuracao ?? false
      }));
      setTimeout(() => setBootstrapStatus(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Initial bootstrap to get settings/data
    performBootstrap().finally(() => setIsInitializing(false));
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated && !isDataLoaded && !isInitializing && !isSyncing) {
      performBootstrap();
    }
  }, [auth.isAuthenticated, isInitializing]);

  // Persistence
  useEffect(() => {
    document.title = String(settings.appTitle || "SG Hub");
  }, [settings.appTitle]);

  useEffect(() => {
    localStorage.setItem('sg_hub_settings', JSON.stringify(settings));
    localStorage.setItem('sg_hub_promotions', JSON.stringify(promotions));
    localStorage.setItem('sg_hub_countries', JSON.stringify(countries));
    
    // Only owner syncs back to cloud to avoid conflicts
    // Use proper API calls for settings
    if (isDataLoaded && !isSyncing && auth.role === 'OWNER') {
      api.setGlobalData({ promotions, countries, settings }).catch(console.error);
    }
  }, [promotions, countries, settings, isDataLoaded, isSyncing, auth.role]);

  useEffect(() => {
    localStorage.setItem('sg_hub_role', auth.role);
    localStorage.setItem('sg_hub_auth', auth.isAuthenticated.toString());
    if (auth.name) localStorage.setItem('sg_hub_name', auth.name);
    else localStorage.removeItem('sg_hub_name');
  }, [auth]);

  const handleLogin = async (user: string, pass: string) => {
    if (user === 'owner' && pass === 'sg-owner-2026') {
      await performBootstrap();
      setAuth({ isAuthenticated: true, role: 'OWNER', name: 'Owner' });
      return { success: true };
    }
    try {
      const res = await api.login(user, pass);
      const roleRaw = String(res.cargo || res.role || '').toUpperCase();
      let role: any = 'visitante';
      if (roleRaw === 'OWNER') role = 'OWNER';
      else if (['ADMIN', 'ADMINISTRADOR'].includes(roleRaw)) role = 'ADMIN';
      else if (['COMERCIAL', 'VENDEDOR'].includes(roleRaw)) role = 'COMERCIAL';

      await performBootstrap();
      setAuth({
        isAuthenticated: true,
        role,
        name: String(res.nome || res.name || user || "")
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Usuário ou senha incorretos.' };
    }
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, role: 'visitante' });
    setView('dashboard');
  };

  const filteredPromotions = useMemo(() => {
    let list = promotions;
    if (auth.role === 'visitante' || auth.role === 'COMERCIAL') {
      list = list.filter(p => p.status === 'ativo');
    }
    return list.filter(p => 
      p.nome_interno.toLowerCase().includes(search.toLowerCase()) ||
      p.tipo.toLowerCase().includes(search.toLowerCase())
    );
  }, [promotions, auth.role, search]);

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center z-[200]">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-full border-4 border-[#e5c12f] border-t-transparent animate-spin mx-auto" />
          <div className="space-y-2">
            <h1 className="text-white text-xl font-black uppercase tracking-widest">Sincronizando Sistema</h1>
            <p className="text-[#a8a8a8] text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Conectando ao SantaGroup Apps Script...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginPage onLogin={handleLogin} settings={settings} />;
  }

  return (
    <div id="app-root" className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row font-sans selection:bg-[#e5c12f] selection:text-black">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-[#0e0e0e] border-b md:border-b-0 md:border-r border-white/5 p-8 flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center gap-4 mb-12">
          {settings.useLogoImage && settings.logoUrl ? (
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/5">
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 bg-[#e5c12f] rounded-2xl flex items-center justify-center font-black text-2xl text-black shadow-xl shadow-[#e5c12f]/20 shrink-0">
              {String(settings.sidebarTitle || 'S').charAt(0)}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-black text-lg tracking-tight text-white leading-none truncate">{String(settings.sidebarTitle || "")}</span>
            <span className="text-[9px] font-black tracking-widest text-[#a8a8a8] mt-1 opacity-50 truncate uppercase">{String(settings.sidebarSubtitle || "")}</span>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1">
          <NavItem icon={<LayoutDashboard size={20} />} label="Início" active={view === 'dashboard' || view === 'details'} onClick={() => setView('dashboard')} />
          {['OWNER', 'ADMIN'].includes(auth.role) && (
            <>
              <NavItem icon={<Plus size={20} />} label="Criar Promoção" active={view === 'form'} onClick={() => { setEditingPromo(null); setView('form'); }} />
              <NavItem icon={<Globe size={20} />} label="Gerenciar Locais" active={view === 'countries'} onClick={() => setView('countries')} />
              <NavItem icon={<Users size={20} />} label="Contas de Acesso" active={view === 'accounts'} onClick={() => setView('accounts')} />
              <NavItem icon={<Settings size={20} />} label="Configurações" active={view === 'settings'} onClick={() => setView('settings')} />
            </>
          )}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-3 px-3 py-4 bg-white/5 rounded-2xl">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${['OWNER', 'ADMIN'].includes(auth.role) ? 'bg-[#e5c12f] text-black' : 'bg-white/10 text-[#a8a8a8]'}`}>
              {['OWNER', 'ADMIN'].includes(auth.role) ? <Shield size={20} /> : <User size={20} />}
            </div>
            <div className="text-sm min-w-0">
              <p className="font-bold text-white uppercase leading-none mb-1 truncate">{String(auth.name || auth.role || "")}</p>
              <p className="text-[10px] uppercase font-black text-[#a8a8a8] tracking-tighter opacity-70 truncate">
                {auth.role === 'OWNER' ? 'ADMIN MASTER' : auth.role === 'ADMIN' ? 'GERENTE' : 'SISTEMA COMERCIAL'}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest border border-red-500/10 hover:border-red-500 shadow-xl shadow-red-500/5 hover:shadow-red-500/20">
            <LogOut size={16} /> Sair da conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-6xl mx-auto space-y-12">
              <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 pt-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-[#e5c12f] tracking-[0.3em]">MANUAL</span>
                  <h1 className="text-5xl font-black tracking-tighter text-white">{String(settings.dashboardTitle || "")}</h1>
                  <p className="text-[#a8a8a8] text-base max-w-xl leading-relaxed">{String(settings.dashboardSubtitle || "")}</p>
                </div>
                {['OWNER', 'ADMIN'].includes(auth.role) && (
                  <button onClick={() => { setEditingPromo(null); setView('form'); }} className="bg-[#e5c12f] hover:bg-[#f0d44a] text-black px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-[#e5c12f]/20 active:scale-95 flex items-center gap-3">
                    <Plus size={20} /> Nova Promoção
                  </button>
                )}
              </header>

              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a8a8a8]" size={20} />
                <input 
                  type="text" 
                  placeholder="Pesquisar por nome ou tipo..." 
                  className="w-full bg-[#16161a] border border-white/5 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#e5c12f]/50 transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {filteredPromotions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPromotions.map(promo => (
                    <PromoCard 
                      key={promo.id} 
                      promo={promo} 
                      role={auth.role}
                      onEdit={() => { setEditingPromo(promo); setView('form'); }}
                      onDelete={() => setDeleteConfirm(promo.id)}
                      onToggleStatus={async () => {
                        try {
                          const newStatus = promo.status === 'ativo' ? 'inativo' : 'ativo';
                          const updatedPromo = { ...promo, status: newStatus };
                          await api.updatePromotion(promo.id, updatedPromo);
                          setPromotions(prev => prev.map(p => p.id === promo.id ? updatedPromo : p));
                        } catch (err: any) {
                          alert(`Erro ao atualizar status: ${err.message}`);
                        }
                      }}
                      onView={() => { setSelectedPromo(promo); setView('details'); }}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-[#16161a] rounded-2xl border border-white/5 p-20 text-center flex flex-col items-center gap-4">
                  <CircleAlert size={48} className="text-white/10" />
                  <p className="text-lg text-[#a8a8a8]">Nenhuma promoção encontrada.</p>
                </div>
              )}
            </motion.div>
          )}

          {view === 'details' && selectedPromo && (
            <PromoDetails key="details" promo={selectedPromo} countries={countries} onBack={() => setView('dashboard')} />
          )}

          {view === 'form' && (
            <PromoForm 
              key="form" 
              initialData={editingPromo} 
              countries={countries} 
              onSave={async (promo) => {
                setSaveProgress({
                  status: 'saving',
                  steps: { validating: null, id: null, script: null, sheet: null, panel: null }
                });

                const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

                try {
                  // 1. Validating
                  setSaveProgress(p => p ? ({ ...p, steps: { ...p.steps, validating: null } }) : p);
                  await wait(400);
                  if (!promo.nome_interno) throw new Error("Nome interno é obrigatório.");
                  setSaveProgress(p => p ? ({ ...p, steps: { ...p.steps, validating: true } }) : p);

                  // 2. ID Generation/Confirmation
                  setSaveProgress(p => p ? ({ ...p, steps: { ...p.steps, id: null } }) : p);
                  await wait(400);
                  const finalId = promo.id || Math.random().toString(36).substr(2, 9);
                  const finalPromo = { ...promo, id: finalId };
                  setSaveProgress(p => p ? ({ ...p, steps: { ...p.steps, id: true } }) : p);

                  // 3. Sending to Apps Script
                  setSaveProgress(p => p ? ({ ...p, steps: { ...p.steps, script: null } }) : p);
                  await wait(400);
                  let res;
                  if (editingPromo) {
                    res = await api.updatePromotion(finalId, finalPromo);
                  } else {
                    res = await api.createPromotion(finalPromo);
                  }
                  setSaveProgress(p => p ? ({ ...p, steps: { ...p.steps, script: true } }) : p);

                  // 4. Saving in sheet (Confirmed by response)
                  setSaveProgress(p => p ? ({ ...p, steps: { ...p.steps, sheet: true } }) : p);

                  // 5. Updating panel
                  setSaveProgress(p => p ? ({ ...p, steps: { ...p.steps, panel: null } }) : p);
                  await wait(400);
                  const refreshed = await api.getGlobalData();
                  if (refreshed && refreshed.promotions) {
                    setPromotions(refreshed.promotions);
                  } else {
                    // Fallback to local update if getGlobalData fails
                    setPromotions(prev => editingPromo 
                      ? prev.map(p => p.id === finalId ? finalPromo : p)
                      : [finalPromo, ...prev]
                    );
                  }
                  setSaveProgress(p => p ? ({ ...p, steps: { ...p.steps, panel: true } }) : p);
                  
                  setSaveProgress(p => p ? ({ ...p, status: 'success' }) : p);
                  await wait(1500);
                  setSaveProgress(null);
                  setView('dashboard');
                } catch (err: any) {
                  setSaveProgress(p => p ? ({ 
                    ...p, 
                    status: 'error', 
                    errorMsg: err.message || 'Falha ao salvar promoção no Apps Script' 
                  }) : p);
                }
              }} 
              onCancel={() => setView('dashboard')} 
            />
          )}

          {view === 'settings' && (
            <SettingsPage 
              key="settings" 
              settings={settings} 
              onSave={async (s) => { 
                const updated = { ...settings, ...s };
                setSettings(updated); 
                try {
                   await api.updateSettings(updated);
                } catch (err) {
                   alert("Erro ao salvar configurações no servidor.");
                }
              }} 
              onBack={() => setView('dashboard')} 
            />
          )}

          {view === 'countries' && (
            <CountriesPage key="countries" countries={countries} setCountries={setCountries} onBack={() => setView('dashboard')} />
          )}

          {view === 'accounts' && (
            <AccountsPage key="accounts" accounts={accounts} setAccounts={setAccounts} onBack={() => setView('dashboard')} />
          )}
        </AnimatePresence>

        {/* Global Loading Checklist */}
        <AnimatePresence>
          {bootstrapStatus && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#111] border border-white/10 rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black tracking-tighter">Sincronizando Sistema</h3>
                  <p className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-widest opacity-50">Carregando dados SG do servidor...</p>
                </div>

                <div className="space-y-3">
                  <ChecklistItem label="INTERFACE" status={bootstrapStatus.interface} />
                  <ChecklistItem label="LOCAIS" status={bootstrapStatus.locais} />
                  <ChecklistItem label="CONTAS" status={bootstrapStatus.contas} />
                  <ChecklistItem label="PROMOÇÕES" status={bootstrapStatus.promocao} />
                  <ChecklistItem label="CONFIGURAÇÃO" status={bootstrapStatus.configuracao} />
                </div>
                
                <div className="pt-4 flex justify-center">
                  <div className="w-8 h-8 rounded-full border-4 border-[#e5c12f] border-t-transparent animate-spin" />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Premium Saving Checklist */}
        <AnimatePresence>
          {saveProgress && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#111] border border-white/10 rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black tracking-tighter">
                    {editingPromo ? 'Atualizando' : 'Criando'} Promoção
                  </h3>
                  <p className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-widest opacity-50">Sincronizando com Banco de Dados Apps Script</p>
                </div>

                <div className="space-y-3">
                  <ChecklistItem label="VALIDANDO DADOS DA PROMOÇÃO" status={saveProgress?.steps.validating ?? null} />
                  <ChecklistItem label="GERANDO ID DA PROMOÇÃO" status={saveProgress?.steps.id ?? null} />
                  <ChecklistItem label="ENVIANDO AO APPS SCRIPT" status={saveProgress?.steps.script ?? null} />
                  <ChecklistItem label="GRAVANDO NA ABA PROMOÇÕES" status={saveProgress?.steps.sheet ?? null} />
                  <ChecklistItem label="ATUALIZANDO LISTA NO PAINEL" status={saveProgress?.steps.panel ?? null} />
                </div>
                
                {saveProgress.status === 'error' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-2">
                    <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">❌ Falha ao salvar no Apps Script</p>
                    <p className="text-white/70 text-xs leading-relaxed">{saveProgress.errorMsg}</p>
                    <button onClick={() => setSaveProgress(null)} className="w-full py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest mt-2 hover:bg-red-400 transition-colors">Fechar e Corrigir</button>
                  </motion.div>
                )}

                {saveProgress.status === 'saving' && (
                  <div className="pt-4 flex justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-[#e5c12f] border-t-transparent animate-spin" />
                  </div>
                )}

                {saveProgress.status === 'success' && (
                   <div className="pt-4 flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                        <CircleCheck size={32} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Sucesso absoluto!</p>
                   </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1c1c21] border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Excluir Promoção</h3>
                <p className="text-[#a8a8a8] text-sm leading-relaxed">Tem certeza que deseja excluir esta promoção? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all">Cancelar</button>
                <button onClick={async () => { 
                  try {
                    await api.deletePromotion(deleteConfirm);
                    setPromotions(promotions.filter(p => p.id !== deleteConfirm));
                    setDeleteConfirm(null);
                  } catch (err: any) {
                    alert(`Erro ao excluir: ${err.message}`);
                    setDeleteConfirm(null);
                  }
                }} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20">Excluir</button>
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  id?: string;
}

function NavItem({ icon, label, active, onClick, id }: NavItemProps) {
  return (
    <button 
      id={id}
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-sm font-medium ${active ? 'bg-[#e5c12f] text-black font-bold shadow-lg shadow-[#e5c12f]/20' : 'text-[#a8a8a8] hover:text-white hover:bg-white/5'}`}
    >
      <div className={active ? 'text-black' : 'text-[#a8a8a8] opacity-70 group-hover:opacity-100'}>{icon}</div>
      <span className="truncate">{label}</span>
    </button>
  );
}

function ChecklistItem({ label, status }: { label: string, status: boolean | null }) {
  return (
    <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#a8a8a8]">{label}</span>
      {status === null ? (
        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      ) : status ? (
        <CircleCheck size={18} className="text-emerald-500" />
      ) : (
        <X size={18} className="text-red-500" />
      )}
    </div>
  );
}

function LoginPage({ onLogin, settings }: { onLogin: (u: string, p: string) => Promise<{ success: boolean, error?: string }>, settings: AppSettings }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await onLogin(user, pass);
    setLoading(false);
    if (!res.success) {
      setError(res.error || "Acesso negado.");
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] flex items-center justify-center p-4 font-sans selection:bg-[#e5c12f] selection:text-black">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-[#111111] border border-white/5 rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#e5c12f]/20 to-transparent" />
        <div className="text-center mb-12">
          {settings.useLogoImage && settings.logoUrl ? (
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-[#e5c12f]/20 mx-auto mb-6 shadow-2xl relative group">
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-[#e5c12f] rounded-[2rem] flex items-center justify-center font-black text-4xl text-black mx-auto mb-8 shadow-[0_0_50px_-10px_rgba(229,193,47,0.4)]">
              {String(settings.sidebarTitle || 'S').charAt(0)}
            </div>
          )}
          <h1 className="text-3xl font-black tracking-tighter text-white mb-2">{String(settings.loginTitle || "")}</h1>
          <p className="text-[#a8a8a8] text-sm opacity-50 uppercase font-black tracking-widest leading-relaxed px-4">{String(settings.loginSubtitle || "")}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-[0.2em] px-2 opacity-40">USUÁRIO</label>
            <input 
              type="text" 
              className="w-full bg-black border border-white/10 rounded-2xl px-6 py-5 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] transition-all text-white font-bold" 
              value={user} 
              onChange={e => setUser(e.target.value)} 
              placeholder="Digite seu usuário..." 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-[0.2em] px-2 opacity-40">SENHA</label>
            <input 
              type="password" 
              className="w-full bg-black border border-white/10 rounded-2xl px-6 py-5 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] transition-all text-white font-bold" 
              value={pass} 
              onChange={e => setPass(e.target.value)} 
              placeholder="••••••••" 
            />
          </div>
          {error && <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-5 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black rounded-2xl flex items-center gap-4 uppercase tracking-widest">{error}</motion.div>}
          <button type="submit" className="w-full bg-[#e5c12f] hover:bg-[#f0d44a] text-black font-black py-6 rounded-2xl shadow-xl transition-all active:scale-[0.98] mt-2 uppercase tracking-[0.2em] text-xs">
            {loading ? "Verificando..." : "Acessar Painel"}
          </button>
        </form>
        <div className="mt-12 text-center border-t border-white/5 pt-8 text-[10px] text-[#a8a8a8] uppercase font-black tracking-widest opacity-20 leading-relaxed">{String(settings.loginFooter || "")}</div>
      </motion.div>
    </div>
  );
}

interface PromoCardProps {
  promo: Promotion;
  role: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void | Promise<void>;
  onView: () => void;
  key?: React.Key;
}

function PromoCard({ promo, role, onEdit, onDelete, onToggleStatus, onView }: PromoCardProps) {
  return (
    <div id={`promo-card-${promo.id}`} className="bg-[#16161a] rounded-2xl border border-white/5 p-4 flex flex-col gap-3 group transition-all hover:bg-[#1c1c21] hover:border-white/10 hover:shadow-xl shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-0.5 max-w-[70%]">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${promo.status === 'ativo' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/20'}`} />
            <h3 className="font-bold text-sm truncate uppercase tracking-tight">{String(promo.nome_interno || "")}</h3>
          </div>
          <p className="text-[10px] uppercase font-bold text-[#a8a8a8] tracking-widest">{promo.tipo.replace('_', ' ')}</p>
        </div>
        {['OWNER', 'ADMIN'].includes(role) && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onToggleStatus} className={`p-1.5 rounded-lg transition-colors ${promo.status === 'ativo' ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-[#a8a8a8] hover:bg-white/5'}`}><CircleCheck size={14} /></button>
            <button onClick={onEdit} className="p-1.5 rounded-lg text-[#a8a8a8] hover:text-white hover:bg-white/5 transition-colors"><Pen size={14} /></button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3 text-[9px] text-[#a8a8a8] font-bold uppercase">
          <span className="flex items-center gap-1"><LayoutDashboard size={10} /> {new Date(promo.data_criacao).toLocaleDateString()}</span>
          <span className="flex items-center gap-1"><Globe size={10} /> {promo.links_por_cidade?.length || 0} Cidades</span>
        </div>
        <button onClick={onView} className="bg-[#e5c12f]/10 text-[#e5c12f] hover:bg-[#e5c12f] text-[10px] font-black uppercase px-3 py-2 rounded-lg transition-all hover:text-white">Ver Detalhes</button>
      </div>
    </div>
  );
}

interface PromoDetailsProps {
  promo: Promotion;
  countries: Country[];
  onBack: () => void;
  key?: React.Key;
}

function PromoDetails({ promo, countries, onBack }: PromoDetailsProps) {
  const blocks = [];
  if (promo.tipo === PromoType.VIP_MENSAL) {
    blocks.push({ title: "Nome do VIP Mensal", value: promo.nome });
    blocks.push({ title: "Cupom do VIP Mensal", value: promo.cupom });
    blocks.push({ title: "Descrição do VIP Mensal", value: promo.descricao });
    blocks.push({ title: "Validade do VIP Mensal", value: promo.validade });
    if (promo.imagem) blocks.push({ title: "Imagem do VIP Mensal", value: promo.imagem });
  } else if (promo.tipo === PromoType.OFERTA_FLASH) {
    blocks.push({ title: "Título da Oferta Flash", value: promo.titulo });
    blocks.push({ title: "Subtítulo da Oferta Flash", value: promo.subtitulo });
    blocks.push({ title: "Produto da Oferta Flash", value: promo.produto });
    blocks.push({ title: "Preço Antigo da Oferta Flash", value: promo.preco_antigo });
    blocks.push({ title: "Preço da Oferta Flash", value: promo.preco });
    blocks.push({ title: "Duração da Oferta Flash", value: promo.duracao });
    if (promo.imagem) blocks.push({ title: "Imagem da Oferta Flash", value: promo.imagem });
  } else if (promo.tipo === PromoType.BATTLEPASS) {
    if (promo.imagem) blocks.push({ title: "BattlePass Imagem", value: promo.imagem });
    blocks.push({ title: "BattlePass Nome", value: promo.nome });
    blocks.push({ title: "BattlePass Descrição", value: promo.descricao });
    if (promo.miniatura) blocks.push({ title: "BattlePass Miniatura Imagem", value: promo.miniatura });
  } else if (promo.tipo === PromoType.LINK_EXCLUSIVO) {
     if (promo.imagem) blocks.push({ title: "Imagem Link Exclusivo", value: promo.imagem });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8 pb-32">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-[#16161a] border border-white/5 rounded-xl hover:bg-white/5 transition-all active:scale-95 group">
            <ChevronRight size={24} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{String(promo.nome_interno || "")}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#e5c12f] bg-[#e5c12f]/10 px-2 py-0.5 rounded">{promo.tipo.replace('_', ' ')}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${promo.status === 'ativo' ? 'text-emerald-400 bg-emerald-400/10' : 'text-[#a8a8a8] bg-white/5'}`}>{promo.status}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {blocks.map((b, i) => <DetailBlock key={i} title={String(b.title || "")} value={String(b.value || "")} />)}
        
        {promo.links_por_cidade && promo.links_por_cidade.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-2">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-widest">Links por Cidade</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="grid grid-cols-1 gap-3">
              {countries.map(country => {
                const group = promo.links_por_cidade.filter(l => l.countryId === country.id);
                if (group.length === 0) return null;
                return (
                  <div key={country.id} className="space-y-3">
                    <div className="flex items-center gap-2 px-2">
                      <Globe size={14} className="text-[#e5c12f]" />
                      <span className="text-xs font-black uppercase tracking-widest text-white/50">{String(country.nome || "")}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {group.map(link => {
                        const city = country.cidades.find(c => c.id === link.cityId);
                        return city ? <LinkRow key={link.cityId} cityName={String(city.nome || "")} url={String(link.url || "")} /> : null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DetailBlock({ title, value }: { title: string, value: string, key?: React.Key }) {
  const [copied, setCopied] = useState(false);
  const isImage = typeof value === 'string' && value.trim() !== '' && (value.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || value.includes('iilli.io') || title.toLowerCase().includes('imagem') || title.toLowerCase().includes('miniatura'));

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#1c1c21] border border-white/5 rounded-2xl overflow-hidden shadow-lg hover:border-white/10 transition-colors">
      <div className="px-6 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-widest">{title}</span>
        <button onClick={handleCopy} className={`flex items-center gap-2 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-[#e5c12f] text-white hover:opacity-90'}`}>
          {copied ? <CircleCheck size={12} /> : <Copy size={12} />}
          {copied ? "Copiado!" : "Copiar Bloco"}
        </button>
      </div>
      <div className={`p-6 flex flex-col ${isImage ? 'md:flex-row' : ''} gap-6`}>
        {isImage && value && (
          <div className="shrink-0 w-24 h-24 rounded-xl border border-white/5 overflow-hidden bg-black/40 group relative">
            <img src={value} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <pre className="text-sm font-mono text-white bg-[#16161a] p-4 rounded-xl border border-white/5 overflow-x-auto whitespace-pre-wrap leading-relaxed h-full min-h-[60px] flex items-center">
            {typeof value === 'string' || typeof value === 'number' ? value : (value ? JSON.stringify(value) : <span className="opacity-30 italic">Sem conteúdo...</span>)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function LinkRow({ cityName, url }: { cityName: string, url: string, key?: React.Key }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-[#16161a] border border-white/5 rounded-2xl p-2 pl-6 flex items-center gap-4 hover:border-white/10 transition-colors group">
      <span className="font-bold text-sm text-white/90 min-w-[100px] shrink-0 uppercase tracking-tight">{String(cityName || "")}</span>
      <div className="flex-1 bg-black/40 rounded-xl px-4 py-3 border border-white/5 font-mono text-xs text-[#a8a8a8] truncate overflow-hidden">
        {url && typeof url === 'string' ? url : <span className="opacity-20 italic">Sem link configurado...</span>}
      </div>
      <button onClick={handleCopy} className={`shrink-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${copied ? 'bg-emerald-500 text-white' : 'bg-[#e5c12f] text-white hover:opacity-90 shadow-lg shadow-[#e5c12f]/10'}`}>
        {copied ? <CircleCheck size={14} /> : <Copy size={14} />}
        {copied ? "Copiado" : "Copiar Link"}
      </button>
    </div>
  );
}

// Sub-pages and complex components would ideally be in their own files, 
// but for the sake of clarity in this first batch, I'll define placeholders or simplified versions.

interface PromoFormProps {
  initialData: Promotion | null;
  countries: Country[];
  onSave: (p: Promotion) => Promise<void> | void;
  onCancel: () => void;
  key?: React.Key;
}

function PromoForm({ initialData, countries, onSave, onCancel }: PromoFormProps) {
  const [form, setForm] = useState<Partial<Promotion>>(initialData || {
    tipo: PromoType.VIP_MENSAL,
    nome_interno: '',
    status: 'ativo',
    links_por_cidade: [],
    nome: '',
    cupom: '',
    descricao: '',
    validade: '',
    imagem: '',
    titulo: '',
    subtitulo: '',
    produto: '',
    preco: '',
    preco_antigo: '',
    duracao: '',
    miniatura: ''
  });

  const [activeCountryId, setActiveCountryId] = useState(countries[0]?.id || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const switchType = (type: PromoType) => {
    setForm(prev => ({
      ...prev,
      tipo: type,
      // Keep shared fields
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nome_interno) e.nome_interno = "Obrigatório";
    if (form.tipo === PromoType.VIP_MENSAL && !form.nome) e.nome = "Obrigatório";
    if (form.tipo === PromoType.OFERTA_FLASH && !form.titulo) e.titulo = "Obrigatório";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        ...form,
        id: form.id || Math.random().toString(36).substr(2, 9),
        data_criacao: form.data_criacao || new Date().toISOString()
      } as Promotion);
    }
  };

  const handleLinkChange = (countryId: string, cityId: string, url: string) => {
    const links = [...(form.links_por_cidade || [])];
    const idx = links.findIndex(l => l.countryId === countryId && l.cityId === cityId);
    if (idx >= 0) {
      if (url) links[idx].url = url;
      else links.splice(idx, 1);
    } else if (url) {
      links.push({ countryId, cityId, url });
    }
    setForm({ ...form, links_por_cidade: links });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 pb-10">
      <div className="flex-1 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{initialData ? "Editar Promoção" : "Criar Promoção"}</h1>
            <p className="text-[#a8a8a8] mt-1 font-bold">Acesso OWNER</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors">Cancelar</button>
            <button onClick={handleSubmit} className="px-6 py-2 bg-[#e5c12f] text-black rounded-xl text-sm font-bold shadow-lg shadow-[#e5c12f]/20 hover:opacity-90 transition-all">
               {initialData ? "Atualizar" : "Salvar"} Promoção
            </button>
          </div>
        </header>

        <div className="bg-[#111] p-8 rounded-2xl border border-white/5 space-y-10 shadow-2xl">
          <section className="space-y-6">
            <h3 className="text-lg font-bold border-b border-white/5 pb-2 flex items-center gap-2">
              <Plus size={18} className="text-[#e5c12f]" /> Informações Gerais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#a8a8a8] uppercase tracking-widest text-[10px]">Nome Interno (Painel)</label>
                <input 
                  value={form.nome_interno} 
                  onChange={e => setForm({...form, nome_interno: e.target.value})} 
                  className={`w-full bg-black border ${errors.nome_interno ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] transition-all`} 
                  placeholder="Ex: Oferta Natal 2026"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#a8a8a8] uppercase tracking-widest text-[10px]">Tipo de Promoção</label>
                <select 
                  value={form.tipo} 
                  onChange={e => switchType(e.target.value as PromoType)} 
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] appearance-none"
                >
                  <option value={PromoType.VIP_MENSAL}>VIP Mensal</option>
                  <option value={PromoType.OFERTA_FLASH}>Oferta Flash</option>
                  <option value={PromoType.LINK_EXCLUSIVO}>Link Exclusivo</option>
                  <option value={PromoType.BATTLEPASS}>BattlePass Informação</option>
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-lg font-bold border-b border-white/5 pb-2 flex items-center gap-2">
              <Type size={18} className="text-[#e5c12f]" /> Conteúdo do Modal
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {form.tipo === PromoType.VIP_MENSAL && (
                <>
                  <FormField label="Nome do VIP" value={form.nome} onChange={v => setForm({...form, nome: v})} error={errors.nome} />
                  <FormField label="Cupom" value={form.cupom} onChange={v => setForm({...form, cupom: v})} />
                  <div className="md:col-span-2">
                    <label className="text-sm font-bold text-[#a8a8a8] uppercase tracking-widest text-[10px]">Descrição</label>
                    <textarea 
                      value={form.descricao} 
                      onChange={e => setForm({...form, descricao: e.target.value})}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] h-24 resize-none mt-2"
                      placeholder="Detalhes da promoção..."
                    />
                  </div>
                  <FormField label="Validade" value={form.validade} onChange={v => setForm({...form, validade: v})} />
                  <FormField label="Imagem URL" value={form.imagem} onChange={v => setForm({...form, imagem: v})} />
                </>
              )}

              {form.tipo === PromoType.OFERTA_FLASH && (
                <>
                  <FormField label="Título" value={form.titulo} onChange={v => setForm({...form, titulo: v})} error={errors.titulo} />
                  <FormField label="Subtítulo" value={form.subtitulo} onChange={v => setForm({...form, subtitulo: v})} />
                  <div className="md:col-span-2"><FormField label="Produto" value={form.produto} onChange={v => setForm({...form, produto: v})} /></div>
                  <FormField label="Preço Orig." value={form.preco_antigo} onChange={v => setForm({...form, preco_antigo: v})} />
                  <FormField label="Preço Oferta" value={form.preco} onChange={v => setForm({...form, preco: v})} />
                  <FormField label="Duração" value={form.duracao} onChange={v => setForm({...form, duracao: v})} />
                  <FormField label="Imagem URL" value={form.imagem} onChange={v => setForm({...form, imagem: v})} />
                </>
              )}

              {form.tipo === PromoType.BATTLEPASS && (
                <>
                  <FormField label="Nome do Passe" value={form.nome} onChange={v => setForm({...form, nome: v})} />
                  <FormField label="Miniatura URL" value={form.miniatura} onChange={v => setForm({...form, miniatura: v})} />
                  <div className="md:col-span-2">
                    <label className="text-sm font-bold text-[#a8a8a8] uppercase tracking-widest text-[10px]">Descrição</label>
                    <textarea 
                      value={form.descricao} 
                      onChange={e => setForm({...form, descricao: e.target.value})}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] h-24 resize-none mt-2"
                    />
                  </div>
                  <div className="md:col-span-2"><FormField label="Banner URL" value={form.imagem} onChange={v => setForm({...form, imagem: v})} /></div>
                </>
              )}

              {form.tipo === PromoType.LINK_EXCLUSIVO && (
                <div className="md:col-span-2"><FormField label="Imagem do Link" value={form.imagem} onChange={v => setForm({...form, imagem: v})} /></div>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-lg font-bold border-b border-white/5 pb-2 flex items-center gap-2">
              <Globe size={18} className="text-[#e5c12f]" /> Canais de Venda (Links)
            </h3>
            <div className="flex bg-black rounded-lg p-1 border border-white/10 overflow-x-auto">
              {countries.map(c => (
                <button key={c.id} type="button" onClick={() => setActiveCountryId(c.id)} className={`flex-1 min-w-[120px] py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg ${activeCountryId === c.id ? 'bg-[#e5c12f] text-black shadow-lg shadow-[#e5c12f]/20' : 'text-[#a8a8a8] hover:text-white hover:bg-white/5'}`}>{c.nome}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {countries.find(c => c.id === activeCountryId)?.cidades.map(city => {
                const link = form.links_por_cidade?.find(l => l.countryId === activeCountryId && l.cityId === city.id);
                return (
                  <div key={city.id} className="bg-white/5 p-4 rounded-xl space-y-2 border border-white/5">
                    <label className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-tighter opacity-50 px-1">{city.nome}</label>
                    <input 
                      value={link?.url || ""} 
                      onChange={e => handleLinkChange(activeCountryId, city.id, e.target.value)} 
                      placeholder="https://..." 
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#e5c12f] font-mono" 
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
      
      {/* Live Preview Column */}
      <div className="w-full lg:w-[450px] space-y-6 shrink-0 lg:sticky lg:top-4 h-fit">
        <h2 className="text-xl font-bold flex items-center gap-2"><ImageIcon size={20} className="text-[#e5c12f]" /> Modal Preview</h2>
        <div className="bg-[#0c0c0e] rounded-3xl border-4 border-[#252529] overflow-hidden shadow-2xl flex flex-col group">
           <div className="bg-[#1a1a1d] px-6 py-4 flex items-center justify-between border-b border-[#252529]">
             <span className="text-xs font-black tracking-[0.2em] text-[#5e5e62] uppercase">{form.tipo?.replace('_', ' ')}</span>
             <div className="flex gap-2">
               <div className="w-2.5 h-2.5 rounded-full bg-[#303033]" />
               <div className="w-2.5 h-2.5 rounded-full bg-[#e5c12f] shadow-[0_0_10px_#e5c12f]" />
             </div>
           </div>
           
           <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar">
              {form.imagem && (
                <div className="relative">
                  <img src={form.imagem} className="w-full aspect-video object-cover rounded-2xl border border-white/5" referrerPolicy="no-referrer" />
                  {form.miniatura && <img src={form.miniatura} className="absolute -bottom-3 -right-3 w-16 h-16 rounded-xl border-4 border-[#0c0c0e] shadow-xl" />}
                </div>
              )}
              
              <div className="space-y-4">
                {form.tipo === PromoType.OFERTA_FLASH && (
                  <div className="text-center space-y-1">
                    <h4 className="text-xl font-black italic uppercase tracking-tighter">{form.titulo || "TÍTULO DA OFERTA"}</h4>
                    <p className="text-[10px] text-[#e5c12f] font-bold uppercase tracking-widest">{form.subtitulo || "Subtítulo legal"}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  <PreviewItem label={form.tipo === PromoType.OFERTA_FLASH ? "PRODUTO" : "NOME"} value={form.produto || form.nome || "---"} />
                  {form.cupom && <PreviewItem label="CUPOM" value={form.cupom} highlight />}
                  {(form.preco || form.preco_antigo) && (
                    <div className="bg-[#e5c12f]/10 rounded-2xl p-5 border border-[#e5c12f]/20 flex flex-col items-center justify-center gap-1">
                      {form.preco_antigo && <span className="text-xs text-red-500 line-through font-bold">{form.preco_antigo}</span>}
                      <span className="text-3xl font-black text-white tracking-tight">{form.preco || "R$ 0,00"}</span>
                    </div>
                  )}
                  {form.descricao && (
                    <div className="bg-[#1a1a1d] rounded-xl p-4 border border-[#252529]">
                      <span className="text-[10px] text-[#5e5e62] uppercase font-black tracking-widest">Descrição</span>
                      <p className="mt-1 text-sm text-[#e1e1e4] leading-relaxed line-clamp-3">{String(form.descricao || "")}</p>
                    </div>
                  )}
                </div>
              </div>
           </div>

           <div className="p-6 bg-[#0c0c0e] border-t border-[#252529] grid grid-cols-2 gap-4">
              <div className="h-12 bg-[#1a1a1d] flex items-center justify-center rounded-xl font-black text-xs text-[#5e5e62] border border-[#252529] uppercase tracking-widest">Cancelar</div>
              <div className="h-12 bg-[#e5c12f] flex items-center justify-center rounded-xl font-black text-xs text-black shadow-lg shadow-[#e5c12f]/20 uppercase tracking-widest">Confirmar</div>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

function PreviewItem({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className="bg-[#1a1a1d] rounded-xl px-4 py-3 border border-[#252529]">
      <span className="text-[10px] text-[#5e5e62] uppercase font-black tracking-widest block mb-0.5">{label}</span>
      <span className={`font-bold block truncate text-sm ${highlight ? 'text-[#e5c12f]' : 'text-white'}`}>{String(value || "")}</span>
    </div>
  );
}

function FormField({ label, value, onChange, error, type = "text" }: { label: string, value?: string, onChange: (v: string) => void, error?: string, type?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-[#a8a8a8] uppercase tracking-widest text-[10px] px-1">{label}</label>
      <input 
        type={type} 
        value={typeof value === 'string' ? value : ""} 
        onChange={e => onChange(e.target.value)} 
        className={`w-full bg-black border ${error ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] transition-all text-white font-medium`} 
        placeholder={`Digite ${label.toLowerCase()}...`} 
      />
    </div>
  );
}

interface SettingsPageProps {
  settings: AppSettings;
  onSave: (s: Partial<AppSettings>) => void;
  onBack: () => void;
  key?: React.Key;
}

function SettingsPage({ settings, onSave, onBack }: SettingsPageProps) {
  const [temp, setTemp] = useState(settings);
  const [isUploading, setIsUploading] = useState(false);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const url = await api.uploadLogo(base64);
        setTemp(prev => ({ ...prev, logoUrl: url, useLogoImage: true }));
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar imagem.");
      setIsUploading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto pb-32">
      <header className="flex items-center justify-between py-8 border-b border-white/5 mb-10 sticky top-0 bg-[#050505]/80 backdrop-blur-md z-30 px-4 -mx-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white">Aparência do Painel</h1>
          <p className="text-[10px] font-black uppercase text-[#e5c12f] tracking-[0.3em] mt-1 opacity-60">Personalize a identidade do Hub</p>
        </div>
        <button 
          onClick={() => { onSave(temp); onBack(); }} 
          className="bg-[#e5c12f] text-black font-black px-10 py-5 rounded-2xl text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-[#e5c12f]/20 active:scale-95"
        >
          Salvar Alterações
        </button>
      </header>

      <div className="space-y-8">
        {/* Card 1 — Identidade Visual */}
        <section className="bg-[#111] border border-white/5 rounded-[2rem] p-8 space-y-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#e5c12f] opacity-20" />
          <h2 className="text-xl font-bold flex items-center gap-3"><ImageIcon size={20} className="text-[#e5c12f]" /> Identidade Visual</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden relative">
                  {temp.logoUrl ? <img src={temp.logoUrl} className="w-full h-full object-cover" /> : <ImageIcon className="opacity-20" size={32} />}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border-2 border-[#e5c12f] border-t-transparent animate-spin" />
                    </div>
                  )}
                </div>
                <input type="file" id="logo-input" className="hidden" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleFileUpload} />
                <label 
                  htmlFor="logo-input"
                  className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all cursor-pointer block"
                >
                  {isUploading ? 'Enviando...' : 'Carregar Logo (GIF/PNG)'}
                </label>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5 cursor-pointer" onClick={() => setTemp({...temp, useLogoImage: !temp.useLogoImage})}>
                <div className={`w-6 h-6 rounded-lg border-2 border-[#e5c12f] flex items-center justify-center transition-all ${temp.useLogoImage ? 'bg-[#e5c12f]' : 'bg-transparent'}`}>
                  {temp.useLogoImage && <CircleCheck size={14} className="text-black" />}
                </div>
                <span className="text-sm font-bold opacity-80 uppercase tracking-widest text-[10px]">Usar imagem/GIF como logo</span>
              </div>
              {temp.logoUrl && (
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[#a8a8a8] opacity-40 mb-1">URL ImgBB</p>
                  <p className="text-[10px] font-mono truncate text-[#e5c12f]">{String(temp.logoUrl || "")}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Card 2 — Interface e Navegação */}
        <section className="bg-[#111] border border-white/5 rounded-[2rem] p-8 space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#e5c12f] opacity-20" />
          <h2 className="text-xl font-bold flex items-center gap-3"><LayoutDashboard size={20} className="text-[#e5c12f]" /> Interface e Navegação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Título da Aba (Browser)" value={temp.appTitle} onChange={v => setTemp({ ...temp, appTitle: v })} />
            <FormField label="Título Principal Sidebar" value={temp.sidebarTitle} onChange={v => setTemp({ ...temp, sidebarTitle: v })} />
            <div className="md:col-span-2">
              <FormField label="Subtítulo Sidebar" value={temp.sidebarSubtitle} onChange={v => setTemp({ ...temp, sidebarSubtitle: v })} />
            </div>
          </div>
        </section>

        {/* Card 3 — Textos do Painel */}
        <section className="bg-[#111] border border-white/5 rounded-[2rem] p-8 space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#e5c12f] opacity-20" />
          <h2 className="text-xl font-bold flex items-center gap-3"><Type size={20} className="text-[#e5c12f]" /> Textos do Dashboard</h2>
          <div className="grid grid-cols-1 gap-6">
            <FormField label="Título do Dashboard" value={temp.dashboardTitle} onChange={v => setTemp({ ...temp, dashboardTitle: v })} />
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#a8a8a8] uppercase tracking-widest text-[10px] px-1">Subtítulo do Dashboard</label>
              <textarea 
                value={temp.dashboardSubtitle} 
                onChange={e => setTemp({ ...temp, dashboardSubtitle: e.target.value })}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] h-24 resize-none transition-all text-sm leading-relaxed"
              />
            </div>
          </div>
        </section>

        {/* Card 4 — Login */}
        <section className="bg-[#111] border border-white/5 rounded-[2rem] p-8 space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#e5c12f] opacity-20" />
          <h2 className="text-xl font-bold flex items-center gap-3"><Shield size={20} className="text-[#e5c12f]" /> Configurações de Login</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Título Login" value={temp.loginTitle} onChange={v => setTemp({ ...temp, loginTitle: v })} />
            <FormField label="Subtítulo Login" value={temp.loginSubtitle} onChange={v => setTemp({ ...temp, loginSubtitle: v })} />
            <div className="md:col-span-2">
              <FormField label="Texto Rodapé Login" value={temp.loginFooter} onChange={v => setTemp({ ...temp, loginFooter: v })} />
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

interface CountriesPageProps {
  countries: Country[];
  setCountries: React.Dispatch<React.SetStateAction<Country[]>>;
  onBack: () => void;
  key?: React.Key;
}

function CountriesPage({ countries, setCountries, onBack }: CountriesPageProps) {
  const [newCountry, setNewCountry] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newCityNames, setNewCityNames] = useState<Record<string, string>>({});
  
  const addCountry = () => {
    if (!newCountry.trim()) return;
    setCountries(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), nome: newCountry, cidades: [] }]);
    setNewCountry('');
  };

  const deleteCountry = (id: string) => {
    if (window.confirm("Excluir este país e todas as suas cidades?")) setCountries(prev => prev.filter(c => c.id !== id));
  };

  const addCity = (countryId: string) => {
    const cityName = newCityNames[countryId];
    if (!cityName?.trim()) return;
    
    setCountries(prev => prev.map(c => {
      if (c.id === countryId) {
        return {
          ...c,
          cidades: [...c.cidades, { id: Math.random().toString(36).substr(2, 9), nome: cityName }]
        };
      }
      return c;
    }));
    
    setNewCityNames(prev => ({ ...prev, [countryId]: '' }));
  };

  const deleteCity = (countryId: string, cityId: string) => {
    setCountries(prev => prev.map(c => {
      if (c.id === countryId) {
        return {
          ...c,
          cidades: c.cidades.filter(city => city.id !== cityId)
        };
      }
      return c;
    }));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8 pb-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Locais</h1>
          <p className="text-[#a8a8a8] mt-1">Configure países e cidades para os links das promoções.</p>
        </div>
        <button onClick={onBack} className="bg-white/5 border border-white/10 px-6 py-3 rounded-xl hover:bg-white/10 transition-all font-black text-xs uppercase tracking-widest">Voltar</button>
      </header>

      <div className="bg-[#111] p-8 rounded-2xl border border-white/5 space-y-8">
        <div className="flex gap-4">
          <input value={newCountry} onChange={e => setNewCountry(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCountry()} placeholder="Novo País..." className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] text-white font-bold" />
          <button onClick={addCountry} className="bg-[#e5c12f] hover:bg-[#f0d44a] text-black px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all">Adicionar País</button>
        </div>

        <div className="space-y-4">
          {countries.map(c => (
            <div key={c.id} className="border border-white/5 rounded-2xl overflow-hidden bg-white/5">
              <div className="p-6 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="p-1 hover:text-[#e5c12f] transition-colors">
                    {expandedId === c.id ? <X size={20} /> : <Plus size={20} />}
                  </button>
                  <div className="flex items-center gap-3">
                    <Globe className="text-[#e5c12f]" />
                    <span className="font-bold text-lg">{String(c.nome || "")}</span>
                    <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-[#a8a8a8] uppercase font-black">{c.cidades?.length || 0} cidades</span>
                  </div>
                </div>
                <button onClick={() => deleteCountry(c.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 rounded-lg"><Trash2 size={20} /></button>
              </div>
              
              <AnimatePresence>
                {expandedId === c.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-black/20 border-t border-white/5">
                    <div className="p-6 space-y-6">
                      <div className="flex gap-2">
                        <input 
                          value={String(newCityNames[c.id] || '')} 
                          onChange={e => setNewCityNames({ ...newCityNames, [c.id]: e.target.value })} 
                          onKeyDown={e => e.key === 'Enter' && addCity(c.id)}
                          placeholder="Nome da cidade..." 
                          className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e5c12f]" 
                        />
                        <button onClick={() => addCity(c.id)} className="bg-white/10 hover:bg-white/15 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">Adicionar</button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {c.cidades?.map(city => (
                          <div key={city.id} className="bg-white/5 px-4 py-3 rounded-xl flex items-center justify-between border border-white/5 group/city">
                            <span className="text-xs font-bold">{String(city.nome || "")}</span>
                            <button onClick={() => deleteCity(c.id, city.id)} className="text-red-500 opacity-0 group-hover/city:opacity-100 transition-all"><X size={14} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface AccountsPageProps {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  onBack: () => void;
  key?: React.Key;
}

function AccountsPage({ accounts: initialAccounts, setAccounts, onBack }: AccountsPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [formData, setFormData] = useState<Partial<Account>>({ 
    name: '', username: '', password: '', active: true, role: 'visitante', permissions: [] 
  });
  const [accs, setAccs] = useState<Account[]>(initialAccounts);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    steps: {
      connection: boolean | null;
      searching: boolean | null;
      processing: boolean | null;
      validating: boolean | null;
      rendering: boolean | null;
    };
    errorMsg?: string;
    count?: number;
  } | null>(null);

  const [actionStatus, setActionStatus] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    type: 'create' | 'update' | 'delete';
    steps: {
      validating: boolean | null;
      script: boolean | null;
      sheet: boolean | null;
      reloading: boolean | null;
      panel: boolean | null;
    };
    errorMsg?: string;
  } | null>(null);

  const fetchAccounts = async (isManualRestart = false) => {
    setLoadingStatus({
      status: 'loading',
      steps: { connection: null, searching: null, processing: null, validating: null, rendering: null }
    });

    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      // 1. Connection
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, connection: null } }) : p);
      await wait(400);
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, connection: true } }) : p);

      // 2. Searching Sheet
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, searching: null } }) : p);
      const response = await api.listAccounts();
      await wait(400);
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, searching: true } }) : p);

      // 3. Processing
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, processing: null }, count: response.length }) : p);
      await wait(400);
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, processing: true } }) : p);

      // 4. Validating
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, validating: null } }) : p);
      await wait(400);
      // Basic validation logic
      const validated = response.filter(a => !!a.username);
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, validating: true } }) : p);

      // 5. Rendering
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, rendering: null } }) : p);
      await wait(400);
      setAccs(validated);
      setAccounts(validated);
      setLoadingStatus(p => p ? ({ ...p, steps: { ...p.steps, rendering: true } }) : p);

      await wait(600);
      setLoadingStatus(null);
    } catch (err: any) {
      setLoadingStatus(p => p ? ({ 
        ...p, 
        status: 'error', 
        errorMsg: err.message || 'Falha ao carregar contas do Apps Script'
      }) : p);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (editingAcc) {
      setFormData(editingAcc);
      setIsModalOpen(true);
    } else {
      setFormData({ name: '', username: '', password: '', active: true, role: 'visitante', permissions: [] });
    }
  }, [editingAcc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setActionStatus({
      status: 'loading',
      type: editingAcc ? 'update' : 'create',
      steps: { validating: null, script: null, sheet: null, reloading: null, panel: null }
    });

    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      // 1. Validating
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, validating: null } }) : p);
      await wait(400);
      if (!formData.name || !formData.username || !formData.role) {
         throw new Error("Preencha todos os campos obrigatórios.");
      }
      if (!editingAcc && !formData.password) {
         throw new Error("Senha é obrigatória para novas contas.");
      }
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, validating: true } }) : p);

      // 2. Sending to Script
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, script: null } }) : p);
      await wait(400);
      if (editingAcc) {
        await api.updateAccount(editingAcc.id, {
          ...formData,
          updatedAt: new Date().toISOString()
        });
      } else {
        await api.createAccount(formData);
      }
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, script: true } }) : p);

      // 3. Saving in Sheet (Confirmed by previous success)
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, sheet: true } }) : p);

      // 4. Reloading
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, reloading: null } }) : p);
      await wait(400);
      const response = await api.listAccounts();
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, reloading: true } }) : p);

      // 5. Updating Panel
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, panel: null } }) : p);
      await wait(400);
      setAccs(response);
      setAccounts(response);
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, panel: true } }) : p);

      await wait(600);
      setActionStatus(null);
      setIsModalOpen(false);
      setEditingAcc(null);
    } catch (err: any) {
      setActionStatus(p => p ? ({ 
        ...p, 
        status: 'error', 
        errorMsg: err.message || 'Falha ao salvar no Apps Script' 
      }) : p);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteId(null);
    setActionStatus({
      status: 'loading',
      type: 'delete',
      steps: { validating: null, script: null, sheet: null, reloading: null, panel: null }
    });

    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      // 1. Validating ID
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, validating: null } }) : p);
      await wait(400);
      if (!id) throw new Error("ID da conta não encontrado.");
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, validating: true } }) : p);

      // 2. Sending deletion
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, script: null } }) : p);
      await wait(400);
      await api.deleteAccount(id);
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, script: true } }) : p);

      // 3. Removing from Sheet
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, sheet: true } }) : p);

      // 4. Reloading
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, reloading: null } }) : p);
      await wait(400);
      const response = await api.listAccounts();
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, reloading: true } }) : p);

      // 5. Updating panel
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, panel: null } }) : p);
      await wait(400);
      setAccs(response);
      setAccounts(response);
      setActionStatus(p => p ? ({ ...p, steps: { ...p.steps, panel: true } }) : p);

      await wait(600);
      setActionStatus(null);
    } catch (err: any) {
       setActionStatus(p => p ? ({ 
        ...p, 
        status: 'error', 
        errorMsg: err.message || 'Falha ao excluir no Apps Script' 
      }) : p);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-4 bg-[#111] border border-white/5 rounded-2xl hover:bg-white/5 transition-all"><ChevronRight size={24} className="rotate-180" /></button>
          <div>
            <span className="text-[10px] font-black uppercase text-[#e5c12f] tracking-[0.3em]">EQUIPE E ACESSO</span>
            <h1 className="text-5xl font-black tracking-tighter">Contas</h1>
          </div>
        </div>
        <button onClick={() => { setEditingAcc(null); setIsModalOpen(true); }} className="bg-[#e5c12f] text-black font-black px-10 py-5 rounded-2xl text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-3 shadow-xl shadow-[#e5c12f]/20">
          <Plus size={18} /> Nova Conta
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accs.map(acc => (
          <div key={acc.id} className="bg-[#111] border border-white/5 rounded-[2rem] p-8 space-y-6 relative overflow-hidden group hover:border-[#e5c12f]/30 hover:shadow-[0_0_40px_-15px_rgba(229,193,47,0.2)] transition-all shadow-2xl">
            {!acc.active && (
              <div className="absolute top-0 right-0 bg-red-500/10 text-red-500 text-[8px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-widest border-b border-l border-red-500/20">SUSPENSO</div>
            )}
            {acc.role === 'OWNER' && (
              <div className="absolute top-0 right-0 bg-[#e5c12f]/10 text-[#e5c12f] text-[8px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-widest border-b border-l border-[#e5c12f]/20">SISTEMA</div>
            )}
            
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-2xl font-black transition-all group-hover:scale-110 ${acc.active ? 'bg-[#e5c12f]/10 text-[#e5c12f]' : 'bg-white/5 text-[#a8a8a8]'}`}>
                {(acc.name || acc.username || '?').charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white text-xl truncate leading-tight">{String(acc.name || "")}</h3>
                <p className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-widest opacity-40 mt-1">@{String(acc.username || "")}</p>
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-white/5">
               <div className="flex items-center justify-between">
                 <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Tipo de Acesso</span>
                 <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${acc.role === 'OWNER' ? 'bg-[#e5c12f] text-black shadow-lg shadow-[#e5c12f]/10' : 'bg-white/10 text-white'}`}>
                   {String(acc.role || 'VISITANTE')}
                 </span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Status da Conta</span>
                 <span className={`text-[10px] font-black uppercase tracking-widest ${acc.active ? 'text-emerald-400' : 'text-red-500'}`}>
                   {acc.active ? 'Ativo agora' : 'Desativado'}
                 </span>
               </div>
            </div>

            <div className="flex items-center gap-2 pt-4 group-hover:translate-y-0 transition-transform">
               <button onClick={() => setEditingAcc(acc)} className="flex-1 bg-white/5 hover:bg-[#e5c12f] hover:text-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest border border-white/5">
                 <Pen size={14} /> Editar
               </button>
               <button onClick={() => setDeleteId(acc.id)} className="p-4 text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20">
                 <Trash2 size={18} />
               </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {loadingStatus && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black tracking-tighter">Sincronizando Equipe</h3>
                <p className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-widest opacity-50">Carregando contas de acesso...</p>
              </div>

              <div className="space-y-3">
                <ChecklistItem label="CONECTANDO AO APPS SCRIPT" status={loadingStatus?.steps.connection ?? null} />
                <ChecklistItem label="BUSCANDO ABA CONTAS" status={loadingStatus?.steps.searching ?? null} />
                <ChecklistItem label={loadingStatus?.count !== undefined ? `${loadingStatus.count} CONTAS ENCONTRADAS` : "PROCESSANDO CONTAS"} status={loadingStatus?.steps.processing ?? null} />
                <ChecklistItem label="VALIDANDO STATUS E PERMISSÕES" status={loadingStatus?.steps.validating ?? null} />
                <ChecklistItem label="RENDERIZANDO CARDS NO PAINEL" status={loadingStatus?.steps.rendering ?? null} />
              </div>
              
              {loadingStatus.status === 'error' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-2">
                  <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">❌ Falha ao carregar do Apps Script</p>
                  <p className="text-white/70 text-xs leading-relaxed">{loadingStatus.errorMsg}</p>
                  <button onClick={() => setLoadingStatus(null)} className="w-full py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest mt-2 hover:bg-red-400 transition-colors">Fechar</button>
                </motion.div>
              )}

              {loadingStatus.status === 'loading' && (
                <div className="pt-4 flex justify-center">
                  <div className="w-8 h-8 rounded-full border-4 border-[#e5c12f] border-t-transparent animate-spin" />
                </div>
              )}
            </motion.div>
          </div>
        )}

        {actionStatus && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] flex items-center justify-center p-4">
             <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black tracking-tighter">
                  {actionStatus.type === 'create' ? 'Criando Conta' : actionStatus.type === 'update' ? 'Atualizando Conta' : 'Deletando Conta'}
                </h3>
                <p className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-widest opacity-50">Sincronizando com Banco de Dados</p>
              </div>

              <div className="space-y-3">
                <ChecklistItem label="VALIDANDO DADOS" status={actionStatus?.steps.validating ?? null} />
                <ChecklistItem label="ENVIANDO APPS SCRIPT" status={actionStatus?.steps.script ?? null} />
                <ChecklistItem label={actionStatus?.type === 'delete' ? "REMOVENDO DA PLANILHA" : "GRAVANDO NA PLANILHA"} status={actionStatus?.steps.sheet ?? null} />
                <ChecklistItem label="RECARREGANDO CONTAS" status={actionStatus?.steps.reloading ?? null} />
                <ChecklistItem label="ATUALIZANDO PAINEL" status={actionStatus?.steps.panel ?? null} />
              </div>
              
              {actionStatus.status === 'error' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-2">
                  <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">❌ Erro no Processo</p>
                  <p className="text-white/70 text-xs leading-relaxed">{actionStatus.errorMsg}</p>
                  <button onClick={() => setActionStatus(null)} className="w-full py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest mt-2 hover:bg-red-400 transition-colors">Fechar</button>
                </motion.div>
              )}

              {actionStatus.status === 'loading' && (
                <div className="pt-4 flex justify-center">
                  <div className="w-8 h-8 rounded-full border-4 border-[#e5c12f] border-t-transparent animate-spin" />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation for Accounts */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1c1c21] border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Excluir Conta?</h3>
                <p className="text-[#a8a8a8] text-sm leading-relaxed">Tem certeza que deseja deletar esta conta permanentemente? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all">Cancelar</button>
                <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20">Excluir</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111] border border-white/5 rounded-[2.5rem] p-12 max-w-lg w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#e5c12f]" />
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-3xl font-black tracking-tighter text-white">{editingAcc ? "EDITAR CONTA" : "NOVA CONTA"}</h3>
                <p className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-[0.3em] mt-1 opacity-50">Configurações de Acesso SG</p>
              </div>
              <button 
                onClick={() => { setIsModalOpen(false); setEditingAcc(null); }} 
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#a8a8a8] hover:bg-white/10 transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {editingAcc && (
                <div className="space-y-2 opacity-50">
                  <label className="text-[9px] font-black uppercase text-[#a8a8a8] tracking-widest">ID Único</label>
                  <input readOnly value={editingAcc.id} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-[#a8a8a8] outline-none" />
                </div>
              )}
              
              <FormField label="Nome Completo" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Nome de Usuário" value={formData.username} onChange={v => setFormData({ ...formData, username: v })} />
                <FormField label="Senha de Acesso" type="password" value={formData.password} onChange={v => setFormData({ ...formData, password: v })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#a8a8a8] uppercase tracking-widest text-[10px] px-1">Cargo / Hierarquia</label>
                  <select 
                    value={formData.role} 
                    onChange={e => setFormData({ ...formData, role: e.target.value as any })} 
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#e5c12f] text-white font-bold appearance-none hover:border-[#e5c12f]/40 transition-colors"
                  >
                    <option value="visitante">Visitante</option>
                    <option value="COMERCIAL">Comercial</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="OWNER">Owner</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <div 
                    onClick={() => setFormData({...formData, active: !formData.active})}
                    className="flex items-center gap-3 bg-black/40 p-4 rounded-xl border border-white/5 cursor-pointer hover:bg-black/60 transition-all"
                  >
                    <div className={`w-10 h-5 rounded-full relative transition-all duration-300 ${formData.active ? 'bg-[#e5c12f]' : 'bg-white/10'}`}>
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${formData.active ? 'left-6 bg-black' : 'left-1'}`} />
                    </div>
                    <span className="text-[9px] font-black uppercase text-white/50 tracking-widest">{formData.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/5">
                <h4 className="text-[10px] font-black uppercase text-[#a8a8a8] tracking-[0.2em] opacity-40">Datas</h4>
                <div className="flex justify-between text-[10px] font-bold text-[#a8a8a8]/60">
                   <span>Criado em: {formData.createdAt ? new Date(formData.createdAt).toLocaleString() : 'Pendente'}</span>
                   {formData.updatedAt && <span>Último ajuste: {new Date(formData.updatedAt).toLocaleTimeString()}</span>}
                </div>
              </div>

              <button type="submit" className="w-full bg-[#e5c12f] text-black font-black py-6 rounded-2xl text-xs uppercase tracking-widest shadow-2xl shadow-[#e5c12f]/20 transition-all hover:opacity-90 active:scale-95 group flex items-center justify-center gap-3">
                {editingAcc ? "Atualizar Registro" : "Criar Novo Usuário"}
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
