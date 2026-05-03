export type LeadStatus =
  | 'Niet bereikt'
  | 'Geen Gehoor'
  | 'Niet Geïnteresseerd'
  | 'Terugbellen'
  | 'Geïnteresseerd'
  | 'Gesloten';

export interface Lead {
  id: string;
  created_at: string;
  rep_id: string;
  lead_naam: string;
  tel_nummer: string;
  datum: string;
  tijdstip: string;
  status: LeadStatus;
  resultaat: string;
  deal_waarde: number | null;
  follow_up_datum: string | null;
  website_type: string;
  script_id: string | null;
}

export interface CallScript {
  id: string;
  created_at: string;
  created_by: string | null;
  title: string;
  content: string;
  is_active: boolean;
}

export interface CRMProfile {
  id: string;
  rep_name: string;
  is_admin: boolean;
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at'>;
export type LeadUpdate = Partial<LeadInsert> & { id: string };

export interface CRMOutletContext {
  adminMode: boolean;
  setAdminMode: (v: boolean) => void;
  profile: CRMProfile | null | undefined;
}
