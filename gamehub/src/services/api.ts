import { Promotion, Account, Country, AppSettings } from "../types";

const API_URL = '/api/apps-script';

export async function callProxy(action: string, params: Record<string, any> = {}, method: 'GET' | 'POST' = 'GET', silent: boolean = false) {
  try {
    let url = `${API_URL}?action=${action}`;
    let options: RequestInit = {
      method,
      cache: "no-store",
    };

    if (method === 'GET') {
      const searchParams = new URLSearchParams();
      searchParams.append('action', action);
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      url = `${API_URL}?${searchParams.toString()}`;
    } else {
      options.headers = {
        'Content-Type': 'application/json',
      };
      options.body = JSON.stringify({ action, ...params });
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Erro na resposta do servidor.");
    }

    return data.data;
  } catch (error: any) {
    if (!silent) {
      console.error(`API Error (${action}):`, error);
    }
    throw error;
  }
}

export async function getGlobalData() {
  try {
    // Try the new unified bootstrap action first, silently to avoid console noise if unimplemented
    return await callProxy('bootstrapData', {}, 'GET', true);
  } catch (e: any) {
    console.warn('bootstrapData failed, trying legacy fallback...', e.message);
    
    // Legacy fallback: Try to gather data manually if bootstrapData is not implemented
    try {
      // Try older combined action
      const data = await callProxy('getGlobalData');
      
      // If accounts are missing, fetch them separately
      if (!data.accounts) {
        try {
          data.accounts = await listAccounts();
        } catch (err) {
          console.error('Failed to legacy-load accounts', err);
          data.accounts = [];
        }
      }
      
      // Ensure settings are loaded - always try to refresh them from the dedicated action
      try {
        const settingsData = await callProxy('getSettings', {}, 'GET', true);
        if (settingsData) data.settings = settingsData;
      } catch (err) {
        // If getSettings fails, try getConfiguracao
        try {
          const configData = await callProxy('getConfiguracao', {}, 'GET', true);
          if (configData) data.settings = configData;
        } catch (err2) {
          console.warn('Dedicated settings load failed');
        }
      }

      return data;
    } catch (e2: any) {
      console.error('Unified data fetch failed completely', e2.message);
      // Final attempt: individually fetch the bare minimums
      const [promotionsResult, accounts] = await Promise.all([
        callProxy('getGlobalData').catch(() => ({ promotions: [], countries: [], settings: {} })),
        callProxy('listarContas').catch(() => [])
      ]);
      
      const promotionsData = promotionsResult as any;
      
      return {
        promotions: promotionsData.promotions || [],
        countries: promotionsData.countries || [],
        accounts: Array.isArray(accounts) ? accounts.map(parseAccount) : [],
        settings: promotionsData.settings || {}
      };
    }
  }
}

export async function uploadLogo(base64: string): Promise<string> {
  const response = await fetch('/api/upload-logo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 })
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data.url;
}

export async function saveSettings(settings: AppSettings) {
  return await callProxy('saveConfiguracao', { settings }, 'POST');
}

export async function setGlobalData(data: { promotions: Promotion[], countries: Country[], settings: AppSettings }) {
  // We'll keep this but the user wants saveConfiguracao for settings specifically
  return await callProxy('setGlobalData', { data }, 'POST');
}

export async function listAccounts(): Promise<Account[]> {
  const data = await callProxy('listarContas');
  return Array.isArray(data) ? data.map(parseAccount) : [];
}

export async function listPromotions(): Promise<Promotion[]> {
  const data = await callProxy('listarPromocoes');
  return Array.isArray(data) ? data : [];
}

export async function createPromotion(promo: Promotion) {
  return await callProxy('criarPromocao', { promo }, 'POST');
}

export async function updatePromotion(id: string, promo: Promotion) {
  return await callProxy('atualizarPromocao', { id, promo }, 'POST');
}

export async function deletePromotion(id: string) {
  return await callProxy('deletarPromocao', { id }, 'POST');
}

export async function createAccount(acc: Partial<Account>): Promise<Account> {
  const data = await callProxy('criarConta', {
    usuario: acc.username,
    senha: acc.password,
    nome: acc.name,
    status: acc.active ? 'ativo' : 'inativo',
    cargo: acc.role || 'visitante',
    permissoes: acc.permissions || []
  });
  return parseAccount({ ...data, senha: acc.password });
}

export async function updateAccount(id: string, acc: Partial<Account>): Promise<Account> {
  const data = await callProxy('atualizarConta', {
    id,
    usuario: acc.username,
    senha: acc.password,
    nome: acc.name,
    status: acc.active ? 'ativo' : 'inativo',
    cargo: acc.role || 'visitante',
    permissoes: acc.permissions || []
  });
  return parseAccount({ ...data, id });
}

export async function deleteAccount(id: string) {
  return await callProxy('deletarConta', { id }, 'POST');
}

export async function updateSettings(settings: AppSettings) {
  return await callProxy('atualizarConfiguracao', { settings }, 'POST');
}

export async function login(username: string, password: string) {
  return await callProxy('login', { usuario: username, senha: password });
}

function parseAccount(raw: any): Account {
  const status = raw.status || raw.STATUS || (raw.active ? "ativo" : "inativo");
  const roleRaw = String(raw.cargo || raw.CARGO || raw.role || "visitante");
  let role: Account['role'] = 'visitante';
  
  if (['OWNER', 'OWNER'].includes(roleRaw.toUpperCase())) role = 'OWNER';
  else if (['ADMIN', 'ADMINISTRADOR'].includes(roleRaw.toUpperCase())) role = 'ADMIN';
  else if (['COMERCIAL', 'VENDEDOR'].includes(roleRaw.toUpperCase())) role = 'COMERCIAL';

  return {
    id: String(raw.id || raw.ID || ""),
    name: String(raw.nome || raw.NOME || raw.name || ""),
    username: String(raw.usuario || raw.USUARIO || raw.username || ""),
    password: String(raw.senha || raw.SENHA || raw.password || ""),
    active: String(status).toLowerCase() !== "inativo" && String(status).toLowerCase() !== "false",
    createdAt: String(raw.criadoEm || raw.CRIADO_EM || raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.atualizadoEm || raw.ATUALIZADO_EM || raw.updatedAt || ""),
    role,
    permissions: Array.isArray(raw.permissoes) ? raw.permissoes : []
  };
}
