import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { useLeads } from '@/features/crm/hooks/useLeads';
import { useCRMProfiles } from '@/features/crm/hooks/useCRMProfiles';
import { LeadDrawer } from '@/features/crm/components/LeadDrawer';
import { StatusBadge } from '@/features/crm/components/StatusBadge';
import { LEAD_STATUSES, getRepColor } from '@/features/crm/constants';
import type { CRMOutletContext, Lead, LeadStatus } from '@/features/crm/types';

type SortField = 'lead_naam' | 'datum' | 'status' | 'deal_waarde' | 'rep_id';
type SortDir = 'asc' | 'desc';

function exportToCSV(leads: Lead[], repMap: Record<string, string>) {
  const headers = ['Lead naam', 'Tel nummer', 'Datum', 'Tijdstip', 'Status', 'Resultaat', 'Deal waarde (€)', 'Website type', 'Rep', 'Follow-up datum'];
  const rows = leads.map(l => [
    l.lead_naam, l.tel_nummer, l.datum, l.tijdstip, l.status,
    l.resultaat, l.deal_waarde ?? '', l.website_type,
    repMap[l.rep_id] ?? 'Onbekend', l.follow_up_datum ?? '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `korda-crm-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const TH: React.CSSProperties = {
  padding: '0.6rem 0.85rem',
  fontSize: '0.7rem', fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#9CA3AF', textAlign: 'left',
  background: '#F8F7F4', borderBottom: '1px solid #e8e4dc',
  userSelect: 'none',
};

const TD: React.CSSProperties = {
  padding: '0.65rem 0.85rem',
  fontSize: '0.85rem', color: '#1c1a17',
  borderBottom: '1px solid #F0ECE4',
  verticalAlign: 'middle',
};

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronsUpDown size={12} style={{ opacity: 0.35 }} />;
  return sortDir === 'asc' ? <ChevronUp size={12} style={{ color: '#3B82F6' }} /> : <ChevronDown size={12} style={{ color: '#3B82F6' }} />;
}

export default function CRMLeads() {
  const { adminMode, profile } = useOutletContext<CRMOutletContext>();
  const { user } = useAuth();
  const { data: allLeads = [], isLoading } = useLeads();
  const { data: profiles = [] } = useCRMProfiles();

  const [search, setSearch] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('datum');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const repMap = useMemo(() =>
    Object.fromEntries(profiles.map(p => [p.id, p.rep_name])),
    [profiles]
  );

  const filtered = useMemo(() => {
    let list = allLeads;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.lead_naam.toLowerCase().includes(q) ||
        l.tel_nummer.includes(q) ||
        l.website_type.toLowerCase().includes(q)
      );
    }
    if (filterRep)    list = list.filter(l => l.rep_id === filterRep);
    if (filterStatus) list = list.filter(l => l.status === filterStatus);
    if (filterFrom)   list = list.filter(l => l.datum >= filterFrom);
    if (filterTo)     list = list.filter(l => l.datum <= filterTo);

    return [...list].sort((a, b) => {
      let av: string | number = a[sortField] ?? '';
      let bv: string | number = b[sortField] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allLeads, search, filterRep, filterStatus, filterFrom, filterTo, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const openDrawer = (lead: Lead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const canEditLead = (lead: Lead | null) => {
    if (!lead) return false;
    if (adminMode && profile?.is_admin) return true;
    return lead.rep_id === user?.id;
  };

  const selectStyle: React.CSSProperties = {
    padding: '0.45rem 0.75rem',
    border: '1px solid #e8e4dc',
    borderRadius: 6,
    fontSize: '0.82rem',
    color: '#1c1a17',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B0A99A', marginBottom: '0.3rem' }}>
            Overzicht
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1c1a17', letterSpacing: '-0.02em', margin: 0 }}>
            Leads
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginTop: '0.25rem' }}>
            {filtered.length} van {allLeads.length} leads
          </p>
        </div>
        <button
          onClick={() => exportToCSV(filtered, repMap)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.1rem',
            background: '#fff', border: '1px solid #e8e4dc', borderRadius: 7,
            fontSize: '0.82rem', fontWeight: 500, color: '#1c1a17',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F8F7F4'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{
        background: '#fff', border: '1px solid #e8e4dc', borderRadius: 8,
        padding: '1rem 1.25rem', marginBottom: '1rem',
        display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 180px', minWidth: 160 }}>
          <Search size={14} style={{ color: '#B0A99A', flexShrink: 0 }} />
          <input
            style={{ ...selectStyle, border: 'none', flex: 1, padding: '0.35rem 0' }}
            placeholder="Zoek naam, telefoon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select style={selectStyle} value={filterRep} onChange={e => setFilterRep(e.target.value)}>
          <option value="">Alle reps</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.rep_name}</option>
          ))}
        </select>

        <select style={selectStyle} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Alle statuses</option>
          {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input
            type="date"
            style={selectStyle}
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            title="Van datum"
          />
          <span style={{ color: '#B0A99A', fontSize: '0.8rem' }}>–</span>
          <input
            type="date"
            style={selectStyle}
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            title="Tot datum"
          />
        </div>

        {(search || filterRep || filterStatus || filterFrom || filterTo) && (
          <button
            onClick={() => { setSearch(''); setFilterRep(''); setFilterStatus(''); setFilterFrom(''); setFilterTo(''); }}
            style={{ fontSize: '0.78rem', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: '0.35rem 0' }}
          >
            Wis filters
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: 8, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#B0A99A', fontSize: '0.875rem' }}>Laden…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#B0A99A', fontSize: '0.875rem' }}>
            {allLeads.length === 0 ? 'Nog geen leads. Log je eerste call!' : 'Geen leads gevonden met deze filters.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {([
                    { field: 'lead_naam', label: 'Lead naam' },
                    { field: null, label: 'Telefoon' },
                    { field: 'status', label: 'Status' },
                    { field: 'rep_id', label: 'Rep' },
                    { field: 'datum', label: 'Datum' },
                    { field: 'deal_waarde', label: 'Deal waarde' },
                    { field: null, label: 'Website type' },
                  ] as { field: SortField | null; label: string }[]).map(({ field, label }) => (
                    <th
                      key={label}
                      style={{ ...TH, cursor: field ? 'pointer' : 'default' }}
                      onClick={() => field && handleSort(field)}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {label}
                        {field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const repName = repMap[lead.rep_id] ?? 'Onbekend';
                  const repColor = getRepColor(repName);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openDrawer(lead)}
                      style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={TD}>
                        <span style={{ fontWeight: 500 }}>{lead.lead_naam}</span>
                      </td>
                      <td style={{ ...TD, color: '#706d66' }}>{lead.tel_nummer}</td>
                      <td style={TD}>
                        <StatusBadge status={lead.status as LeadStatus} size="sm" />
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: repColor, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.82rem' }}>{repName}</span>
                        </div>
                      </td>
                      <td style={{ ...TD, color: '#706d66', whiteSpace: 'nowrap' }}>
                        {format(new Date(lead.datum + 'T00:00:00'), 'd MMM yyyy')}
                      </td>
                      <td style={{ ...TD, color: lead.deal_waarde ? '#15803D' : '#B0A99A', fontWeight: lead.deal_waarde ? 500 : 400 }}>
                        {lead.deal_waarde ? `€${Number(lead.deal_waarde).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}` : '—'}
                      </td>
                      <td style={{ ...TD, color: '#706d66', maxWidth: 140 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.website_type || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LeadDrawer
        lead={selectedLead}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        profiles={profiles}
        canEdit={canEditLead(selectedLead)}
      />
    </div>
  );
}
