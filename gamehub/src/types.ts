export enum PromoType {
  VIP_MENSAL = "vip_mensal",
  OFERTA_FLASH = "oferta_flash",
  LINK_EXCLUSIVO = "link_exclusivo",
  BATTLEPASS = "battlepass",
}

export interface City {
  id: string;
  nome: string;
}

export interface Country {
  id: string;
  nome: string;
  cidades: City[];
}

export interface LinkByCity {
  countryId: string;
  cityId: string;
  url: string;
}

export interface Promotion {
  id: string;
  tipo: PromoType;
  nome_interno: string;
  status: "ativo" | "inativo";
  data_criacao: string;
  links_por_cidade: LinkByCity[];
  
  // Specific fields for different types
  nome?: string;
  cupom?: string;
  descricao?: string;
  validade?: string;
  imagem?: string;
  titulo?: string;
  subtitulo?: string;
  produto?: string;
  preco_antigo?: string;
  preco?: string;
  duracao?: string;
  miniatura?: string;
}

export interface Account {
  id: string;
  name: string;
  username: string;
  password?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  role: 'OWNER' | 'ADMIN' | 'COMERCIAL' | 'visitante';
  permissions?: string[];
}

export interface AppSettings {
  appTitle: string;
  sidebarTitle: string;
  sidebarSubtitle: string;
  dashboardTitle: string;
  dashboardSubtitle: string;
  loginTitle: string;
  loginSubtitle: string;
  loginFooter: string;
  logoUrl: string | null;
  useLogoImage: boolean;
  panelAppearanceTitle?: string;
}
