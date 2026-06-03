'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  savePartnerAction,
  togglePartnerStatusAction,
  deletePartnerAction
} from './actions';
import {
  BarChart2,
  Users,
  ArrowLeft,
  Plus,
  Eye,
  EyeOff,
  Check,
  X,
  Trash2,
  ExternalLink,
  Shield,
  FileText,
  TrendingUp,
  Activity,
  Award
} from 'lucide-react';

interface Partner {
  id: string;
  key: string;
  name: string;
  category: 'hotel' | 'activity' | 'insurance' | 'esim' | 'forex' | 'transport' | 'gear' | 'photobook';
  network: string;
  status: 'active' | 'inactive';
  affiliate_id: string;
  secret_ref?: string | null;
  link_template: string;
  sub_param: string;
  commission_estimate: number;
  priority: number;
  surface_triggers: string[];
  updated_by: string;
  updated_at: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  changes: string;
  created_at: string;
  operator_name?: string | null;
}

interface AffiliatesClientProps {
  initialPartners: Partner[];
  auditLogs: AuditLog[];
  metrics: Record<string, { clicks: number; conversions: number; revenue: number }>;
}

const CATEGORIES: Partner['category'][] = [
  'hotel',
  'activity',
  'insurance',
  'esim',
  'forex',
  'transport',
  'gear',
  'photobook'
];

const CATEGORY_LABELS: Record<Partner['category'], string> = {
  hotel: 'Hotels',
  activity: 'Activities',
  insurance: 'Insurance',
  esim: 'eSIM',
  forex: 'Forex',
  transport: 'Transport',
  gear: 'Gear',
  photobook: 'Photobooks'
};

const TRIGGER_LABELS: Record<string, string> = {
  dates_locked: 'Dates Locked',
  hotel_decision_opened: 'Hotel Decision Opened',
  flight_voucher_ingested: 'Flight Voucher Ingested',
  activity_interest: 'Activity Interest',
  transport_expense: 'Transport Expense'
};

export default function AffiliatesClient({
  initialPartners,
  auditLogs,
  metrics
}: AffiliatesClientProps) {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>(initialPartners);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isPending, startTransition] = useTransition();

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states inside drawer
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Partner['category']>('hotel');
  const [network, setNetwork] = useState('');
  const [affiliateId, setAffiliateId] = useState('');
  const [secret, setSecret] = useState('');
  const [linkTemplate, setLinkTemplate] = useState('');
  const [subParam, setSubParam] = useState('sub_id');
  const [commissionEstimate, setCommissionEstimate] = useState('5.0');
  const [priority, setPriority] = useState('1');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [surfaceTriggers, setSurfaceTriggers] = useState<Record<string, boolean>>({
    dates_locked: false,
    hotel_decision_opened: false,
    flight_voucher_ingested: false,
    activity_interest: false,
    transport_expense: false
  });

  // Credential Visibility Toggles
  const [revealAffiliateIdList, setRevealAffiliateIdList] = useState<Record<string, boolean>>({});
  const [revealAffiliateIdDrawer, setRevealAffiliateIdDrawer] = useState(false);
  const [replaceSecret, setReplaceSecret] = useState(false);

  // Link testing preview states
  const [testDest, setTestDest] = useState('Paris');
  const [testSubId, setTestSubId] = useState('test-trip-id.test-offer-id.operator');

  // Trigger state reset on "Add Partner"
  const openAddDrawer = () => {
    setSelectedPartner(null);
    setName('');
    setCategory('hotel');
    setNetwork('');
    setAffiliateId('');
    setSecret('');
    setLinkTemplate('https://partner.com/search?q={id}&sub={sub}');
    setSubParam('sub_id');
    setCommissionEstimate('5.0');
    setPriority('1');
    setStatus('active');
    setSurfaceTriggers({
      dates_locked: false,
      hotel_decision_opened: false,
      flight_voucher_ingested: false,
      activity_interest: false,
      transport_expense: false
    });
    setRevealAffiliateIdDrawer(false);
    setReplaceSecret(true); // New partner requires secret key input
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsDrawerOpen(true);
  };

  // Trigger state fill on "Edit Partner"
  const openEditDrawer = (partner: Partner) => {
    setSelectedPartner(partner);
    setName(partner.name);
    setCategory(partner.category);
    setNetwork(partner.network);
    setAffiliateId(partner.affiliate_id);
    setSecret('');
    setLinkTemplate(partner.link_template);
    setSubParam(partner.sub_param);
    setCommissionEstimate(String(partner.commission_estimate));
    setPriority(String(partner.priority));
    setStatus(partner.status);
    
    const triggersMap: Record<string, boolean> = {
      dates_locked: false,
      hotel_decision_opened: false,
      flight_voucher_ingested: false,
      activity_interest: false,
      transport_expense: false
    };
    if (partner.surface_triggers && Array.isArray(partner.surface_triggers)) {
      partner.surface_triggers.forEach(t => {
        triggersMap[t] = true;
      });
    }
    setSurfaceTriggers(triggersMap);
    setRevealAffiliateIdDrawer(false);
    setReplaceSecret(false); // Secret key exists, write-only replace option by default
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsDrawerOpen(true);
  };

  const toggleTrigger = (triggerName: string) => {
    setSurfaceTriggers(prev => ({
      ...prev,
      [triggerName]: !prev[triggerName]
    }));
  };

  // Immediate status toggling from table
  const handleToggleStatus = async (partner: Partner) => {
    const newStatus = partner.status === 'active' ? 'inactive' : 'active';
    
    // Optimistic UI Update
    setPartners(prev =>
      prev.map(p => (p.id === partner.id ? { ...p, status: newStatus } : p))
    );

    startTransition(async () => {
      try {
        const res = await togglePartnerStatusAction(partner.id, newStatus);
        if (!res.success) {
          // Revert on error
          setPartners(prev =>
            prev.map(p => (p.id === partner.id ? { ...p, status: partner.status } : p))
          );
          alert('Failed to update status.');
        }
      } catch (err) {
        setPartners(prev =>
          prev.map(p => (p.id === partner.id ? { ...p, status: partner.status } : p))
        );
        alert('Error updating status.');
      }
    });
  };

  const handleSavePartner = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    if (selectedPartner) {
      formData.append('id', selectedPartner.id);
    }
    formData.append('name', name);
    formData.append('category', category);
    formData.append('network', network);
    formData.append('affiliateId', affiliateId);
    
    if (replaceSecret) {
      formData.append('secret', secret);
    } else {
      formData.append('secret', ''); // Indicates no secret update
    }

    formData.append('linkTemplate', linkTemplate);
    formData.append('subParam', subParam);
    formData.append('commissionEstimate', commissionEstimate);
    formData.append('priority', priority);
    formData.append('status', status);

    const selectedTriggers = Object.entries(surfaceTriggers)
      .filter(([_, checked]) => checked)
      .map(([trigger, _]) => trigger)
      .join(',');
    formData.append('surfaceTriggers', selectedTriggers);

    startTransition(async () => {
      const res = await savePartnerAction(null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg('Partner saved successfully!');
        // Update local state by forcing a router refresh
        router.refresh();
        setTimeout(() => {
          setIsDrawerOpen(false);
        }, 800);
      }
    });
  };

  const handleDeletePartner = async () => {
    if (!selectedPartner) return;
    if (!confirm(`Are you sure you want to delete ${selectedPartner.name}? This will remove it immediately.`)) return;

    startTransition(async () => {
      try {
        const res = await deletePartnerAction(selectedPartner.id);
        if (res.success) {
          router.refresh();
          setIsDrawerOpen(false);
        } else {
          setErrorMsg('Failed to delete partner.');
        }
      } catch (err) {
        setErrorMsg('Error deleting partner.');
      }
    });
  };

  const toggleRevealList = (partnerId: string) => {
    setRevealAffiliateIdList(prev => ({
      ...prev,
      [partnerId]: !prev[partnerId]
    }));
  };

  // Helper to generate a test link
  const generateTestLink = () => {
    let raw = linkTemplate.replace('{id}', encodeURIComponent(testDest));
    if (!raw.includes('{sub}')) {
      const separator = raw.includes('?') ? '&' : '?';
      raw = `${raw}${separator}${subParam}={sub}`;
    }
    return raw.replace('{sub}', encodeURIComponent(testSubId));
  };

  // Funnel totals
  const totalClicks = Object.values(metrics).reduce((acc, m) => acc + m.clicks, 0);
  const totalConversions = Object.values(metrics).reduce((acc, m) => acc + m.conversions, 0);
  const totalRevenue = Object.values(metrics).reduce((acc, m) => acc + m.revenue, 0);
  const avgConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  // Filter and group partners
  const filteredPartners = selectedCategoryFilter === 'all'
    ? partners
    : partners.filter(p => p.category === selectedCategoryFilter);

  // Group partners by category for rendering
  const groupedPartners = CATEGORIES.reduce((acc, cat) => {
    const list = filteredPartners.filter(p => p.category === cat);
    if (list.length > 0) {
      acc[cat] = list;
    }
    return acc;
  }, {} as Record<Partner['category'], Partner[]>);

  return (
    <div className="flex min-h-screen bg-surface text-ink-text font-sans">
      
      {/* 1. Left Sidebar Navigation - Back office Operator Console Style */}
      <aside className="hidden md:flex flex-col w-64 bg-[#f3ede1] border-r border-border-warm-grey">
        <div className="p-6 border-b border-border-warm-grey">
          <Link href="/" className="flex items-center gap-2 text-[#1f4d3f] hover:opacity-90">
            <Shield className="w-5 h-5" />
            <span className="font-display text-lg font-bold tracking-tight">Junto Operator</span>
          </Link>
          <span className="text-[10px] font-label-caps text-muted-text mt-1 block">Back-Office Hub</span>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          <Link
            href="/admin/economics"
            className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-muted-text hover:text-ink-text hover:bg-surface-container rounded-lg transition"
          >
            <BarChart2 className="w-4 h-4 text-muted-text" />
            Unit Economics
          </Link>

          <Link
            href="/admin/affiliates"
            className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-ink-text bg-surface-container-highest border border-border-warm-grey rounded-lg transition"
          >
            <Users className="w-4 h-4 text-[#1f4d3f]" />
            Affiliate Partners
          </Link>
        </nav>

        <div className="p-4 border-t border-border-warm-grey">
          <Link
            href="/"
            className="flex items-center gap-2 text-[10px] font-label-caps text-muted-text hover:text-secondary transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit Console
          </Link>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 bg-[#f3ede1] border-b border-border-warm-grey">
          <span className="font-display text-md font-bold text-[#1f4d3f] flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> Junto Operator
          </span>
          <div className="flex gap-4">
            <Link href="/admin/economics" className="text-xs font-bold text-muted-text hover:text-ink-text">
              Economics
            </Link>
            <Link href="/admin/affiliates" className="text-xs font-bold text-ink-text underline">
              Partners
            </Link>
          </div>
        </header>

        <div className="px-6 py-8 max-w-7xl w-full mx-auto space-y-8">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-warm-grey pb-5">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-ink-text flex items-center gap-2.5">
                Affiliate Partners
              </h1>
              <p className="font-body-sm text-muted-text mt-1">
                Manage dynamic monetization networks, deep link templates, conversion commissions, and active kill switches.
              </p>
            </div>
            
            <button
              onClick={openAddDrawer}
              className="bg-[#1f4d3f] hover:bg-[#15342a] text-surface-container-lowest text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> Add Partner
            </button>
          </div>

          {/* Quick Stats Funnel Dashboard */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card-cream border border-border-warm-grey p-5 rounded-xl">
              <div className="flex justify-between items-start text-muted-text mb-1">
                <span className="font-label-caps text-[10px] tracking-wider">Total Clicks</span>
                <Activity className="w-4 h-4 text-muted-text" />
              </div>
              <span className="font-display text-2xl font-bold text-ink-text leading-none">{totalClicks}</span>
              <p className="text-[10px] text-muted-text mt-1">Offers click events recorded</p>
            </div>

            <div className="bg-card-cream border border-border-warm-grey p-5 rounded-xl">
              <div className="flex justify-between items-start text-muted-text mb-1">
                <span className="font-label-caps text-[10px] tracking-wider">Total Conversions</span>
                <Award className="w-4 h-4 text-[#1f4d3f]" />
              </div>
              <span className="font-display text-2xl font-bold text-ink-text leading-none">{totalConversions}</span>
              <p className="text-[10px] text-muted-text mt-1">Simulated or postback sales</p>
            </div>

            <div className="bg-card-cream border border-border-warm-grey p-5 rounded-xl">
              <div className="flex justify-between items-start text-muted-text mb-1">
                <span className="font-label-caps text-[10px] tracking-wider">Funnel Conversion %</span>
                <TrendingUp className="w-4 h-4 text-secondary" />
              </div>
              <span className="font-display text-2xl font-bold text-[#a04018] leading-none">{avgConversionRate.toFixed(1)}%</span>
              <p className="text-[10px] text-muted-text mt-1">Avg click-to-sale funnel rate</p>
            </div>

            <div className="bg-card-cream border border-border-warm-grey p-5 rounded-xl">
              <div className="flex justify-between items-start text-muted-text mb-1">
                <span className="font-label-caps text-[10px] tracking-wider">Operator Revenue</span>
                <span className="text-xs font-bold text-[#1f4d3f]">₹</span>
              </div>
              <span className="font-display text-2xl font-bold text-[#1f4d3f] leading-none">₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <p className="text-[10px] text-muted-text mt-1">Derived from partner commissions</p>
            </div>
          </section>

          {/* Category Filter Controls */}
          <div className="flex flex-wrap gap-1.5 bg-[#f3ede1] p-1.5 rounded-lg border border-border-warm-grey">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
                selectedCategoryFilter === 'all'
                  ? 'bg-surface text-ink-text shadow-xs border border-border-warm-grey/60'
                  : 'text-muted-text hover:text-ink-text'
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
                  selectedCategoryFilter === cat
                    ? 'bg-surface text-ink-text shadow-xs border border-border-warm-grey/60'
                    : 'text-muted-text hover:text-ink-text'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Partners Data Grid */}
          <section className="space-y-8">
            {Object.keys(groupedPartners).length === 0 ? (
              <div className="bg-card-cream border border-border-warm-grey p-12 text-center rounded-xl text-muted-text">
                No active/configured partners match the selected filter.
              </div>
            ) : (
              (Object.keys(groupedPartners) as Partner['category'][]).map(cat => {
                const partnerList = groupedPartners[cat] || [];
                return (
                  <div key={cat} className="space-y-3">
                    <h3 className="font-headline-sm text-md text-[#1f4d3f] font-bold tracking-tight pl-1 border-l-2 border-[#1f4d3f]">
                      {CATEGORY_LABELS[cat]} ({partnerList.length})
                    </h3>
                    
                    <div className="bg-card-cream border border-border-warm-grey rounded-xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#f3ede1] border-b border-border-warm-grey text-[10px] font-label-caps text-muted-text tracking-wider">
                              <th className="py-3 px-4 font-bold">Partner Name</th>
                              <th className="py-3 px-4 font-bold">Network</th>
                              <th className="py-3 px-4 font-bold text-center">Status</th>
                              <th className="py-3 px-4 font-bold text-center">Affiliate ID Set</th>
                              <th className="py-3 px-4 font-bold text-right">Commission Est.</th>
                              <th className="py-3 px-4 font-bold text-right">Clicks</th>
                              <th className="py-3 px-4 font-bold text-right">Conversions</th>
                              <th className="py-3 px-4 font-bold text-right">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-warm-grey/60 font-body-sm">
                            {partnerList.map(partner => {
                              const pm = metrics[partner.name] || { clicks: 0, conversions: 0, revenue: 0 };
                              const isRevealed = revealAffiliateIdList[partner.id] || false;

                              return (
                                <tr
                                  key={partner.id}
                                  onClick={() => openEditDrawer(partner)}
                                  className="hover:bg-surface-container-low transition cursor-pointer group"
                                >
                                  <td className="py-3 px-4 font-semibold text-ink-text group-hover:text-[#1f4d3f] transition duration-150">
                                    <div className="flex items-center gap-1.5">
                                      {partner.name}
                                      <span className="text-[10px] text-muted-text font-normal font-mono">({partner.priority})</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-muted-text font-mono text-[11px]">{partner.network}</td>
                                  
                                  {/* Kill switch Status Toggle */}
                                  <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                                    <button
                                      disabled={isPending}
                                      onClick={() => handleToggleStatus(partner)}
                                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border transition cursor-pointer ${
                                        partner.status === 'active'
                                          ? 'bg-ai-sage-tint text-[#1f4d3f] border-[#8dbdab]'
                                          : 'bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab]'
                                      }`}
                                    >
                                      {partner.status === 'active' ? 'Active' : 'Inactive'}
                                    </button>
                                  </td>

                                  {/* Affiliate ID Set with masked/reveal control */}
                                  <td className="py-3 px-4 text-center text-xs" onClick={e => e.stopPropagation()}>
                                    {partner.affiliate_id ? (
                                      <div className="inline-flex items-center justify-center gap-1">
                                        <span className="font-mono text-[11px]">
                                          {isRevealed ? partner.affiliate_id : '••••••••'}
                                        </span>
                                        <button
                                          onClick={() => toggleRevealList(partner.id)}
                                          className="text-muted-text hover:text-ink-text p-0.5"
                                        >
                                          {isRevealed ? (
                                            <EyeOff className="w-3 h-3" />
                                          ) : (
                                            <Eye className="w-3 h-3" />
                                          )}
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[#ba1a1a] text-[10px] font-bold">MISSING</span>
                                    )}
                                  </td>

                                  <td className="py-3 px-4 text-right font-semibold text-ink-text">{partner.commission_estimate}%</td>
                                  <td className="py-3 px-4 text-right text-muted-text font-mono">{pm.clicks}</td>
                                  <td className="py-3 px-4 text-right text-muted-text font-mono">{pm.conversions}</td>
                                  <td className="py-3 px-4 text-right font-semibold text-[#1f4d3f] font-mono">
                                    ₹{pm.revenue.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* Audit Logs Section */}
          <section className="bg-card-cream border border-border-warm-grey rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border-warm-grey/50">
              <FileText className="w-5 h-5 text-muted-text" />
              <h2 className="font-headline-sm text-md font-bold text-ink-text">Operator Audit Logs</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-body-sm">
                <thead>
                  <tr className="border-b border-border-warm-grey text-[9px] font-label-caps text-muted-text tracking-wider">
                    <th className="py-2 pb-3">Timestamp</th>
                    <th className="py-2 pb-3">Operator</th>
                    <th className="py-2 pb-3 text-center">Action</th>
                    <th className="py-2 pb-3">Changes Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-warm-grey/40 text-xs">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted-text">
                        No recent configuration audit logs.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => {
                      let changesStr = '';
                      try {
                        const parsed = typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes;
                        changesStr = Object.entries(parsed)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ');
                      } catch (e) {
                        changesStr = String(log.changes);
                      }

                      // Badge color mapping
                      let badgeStyle = 'bg-surface-container-high text-muted-text';
                      if (log.action.includes('create')) {
                        badgeStyle = 'bg-ai-sage-tint text-[#1f4d3f] border border-[#8dbdab]';
                      } else if (log.action.includes('edit')) {
                        badgeStyle = 'bg-[#fdf4e7] text-[#a04018] border border-[#f3ddc0]';
                      } else if (log.action.includes('delete')) {
                        badgeStyle = 'bg-[#ffdad6] text-[#ba1a1a] border border-[#ffb4ab]';
                      }

                      return (
                        <tr key={log.id} className="hover:bg-surface-container-low transition duration-75">
                          <td className="py-2.5 text-muted-text font-mono text-[10px]">
                            {new Date(log.created_at).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 font-semibold text-ink-text">
                            {log.operator_name || 'System / BACKDOOR'}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeStyle}`}>
                              {log.action.replace('_partner', '')}
                            </span>
                          </td>
                          <td className="py-2.5 text-muted-text max-w-lg truncate font-mono text-[11px]" title={changesStr}>
                            {changesStr}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* 3. Slider Edit / Add Drawer Component */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
          />

          {/* Drawer Body Panel */}
          <aside className="relative w-full max-w-xl bg-surface border-l border-border-warm-grey flex flex-col h-full shadow-2xl z-10 transition-transform duration-300 animate-slide-in">
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-border-warm-grey bg-[#f3ede1]">
              <div>
                <h2 className="font-headline-sm font-bold text-ink-text">
                  {selectedPartner ? `Edit Partner: ${selectedPartner.name}` : 'Add Affiliate Partner'}
                </h2>
                <span className="text-[10px] font-label-caps text-muted-text block mt-0.5">
                  {selectedPartner ? 'DB Row ID: ' + selectedPartner.id : 'New database record'}
                </span>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-muted-text hover:text-ink-text p-1.5 rounded-lg border border-border-warm-grey bg-surface-container-lowest"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error and Success Notices */}
            {errorMsg && (
              <div className="bg-[#ffdad6] text-[#ba1a1a] text-xs font-semibold px-6 py-3 border-b border-[#ffb4ab]">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-ai-sage-tint text-[#1f4d3f] text-xs font-semibold px-6 py-3 border-b border-[#8dbdab]">
                {successMsg}
              </div>
            )}

            {/* Form Scroll Area */}
            <form onSubmit={handleSavePartner} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Row: Name and Network */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-label-caps text-muted-text">Partner Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Booking.com"
                    className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-label-caps text-muted-text">Network Name</label>
                  <input
                    type="text"
                    required
                    value={network}
                    onChange={e => setNetwork(e.target.value)}
                    placeholder="e.g. Travelpayouts, Direct"
                    className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none"
                  />
                </div>
              </div>

              {/* Row: Category and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-label-caps text-muted-text">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as Partner['category'])}
                    className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-label-caps text-muted-text">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none cursor-pointer"
                  >
                    <option value="active">Active (On)</option>
                    <option value="inactive">Inactive (Off / Kill-Switched)</option>
                  </select>
                </div>
              </div>

              {/* Affiliate ID (Masked by default with eyes icon toggle) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-label-caps text-muted-text">Affiliate Tracking ID</label>
                  <button
                    type="button"
                    onClick={() => setRevealAffiliateIdDrawer(!revealAffiliateIdDrawer)}
                    className="text-[10px] font-bold text-[#1f4d3f] hover:underline flex items-center gap-1"
                  >
                    {revealAffiliateIdDrawer ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {revealAffiliateIdDrawer ? 'Mask ID' : 'Reveal ID'}
                  </button>
                </div>
                <input
                  type={revealAffiliateIdDrawer ? 'text' : 'password'}
                  required
                  value={affiliateId}
                  onChange={e => setAffiliateId(e.target.value)}
                  placeholder="e.g. Booking.com affiliate ID or travelpayouts marker"
                  className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-mono font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none"
                />
                <p className="text-[10px] text-muted-text">Outbound tracking identifier injected into deep links.</p>
              </div>

              {/* Secret Key Setup (Write-only, pointers in Vault) */}
              <div className="space-y-1 bg-[#f3ede1]/40 border border-border-warm-grey/50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-label-caps text-muted-text">Secret API Key (Vault)</label>
                  {selectedPartner && selectedPartner.secret_ref && !replaceSecret && (
                    <button
                      type="button"
                      onClick={() => setReplaceSecret(true)}
                      className="text-[10px] font-bold text-[#a04018] hover:underline"
                    >
                      Replace Key
                    </button>
                  )}
                </div>
                
                {selectedPartner && selectedPartner.secret_ref && !replaceSecret ? (
                  <div className="py-2 flex items-center gap-2 text-xs font-semibold text-ink-text">
                    <span className="inline-block w-2.5 h-2.5 bg-[#1f4d3f] rounded-full" />
                    <span>Secret Key Configured (Ref: {selectedPartner.secret_ref})</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={secret}
                      onChange={e => setSecret(e.target.value)}
                      placeholder="Enter new partner API secret key (never read back, saved securely)"
                      className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-mono font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none"
                    />
                    {selectedPartner && selectedPartner.secret_ref && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceSecret(false);
                          setSecret('');
                        }}
                        className="text-[10px] text-muted-text hover:underline block"
                      >
                        Keep existing key
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[9px] text-muted-text mt-1">
                  API keys are stored write-only via pointer references and are never output to pages or networks.
                </p>
              </div>

              {/* Link Template and Sub Parameter */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="block text-[10px] font-label-caps text-muted-text">Link Template</label>
                  <input
                    type="text"
                    required
                    value={linkTemplate}
                    onChange={e => setLinkTemplate(e.target.value)}
                    placeholder="https://booking.com/search?aid={id}&sub={sub}"
                    className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-mono font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-label-caps text-muted-text">Tracking Param Name</label>
                  <input
                    type="text"
                    required
                    value={subParam}
                    onChange={e => setSubParam(e.target.value)}
                    placeholder="e.g. sub_id"
                    className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-mono font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none"
                  />
                </div>
              </div>

              {/* Commission Estimate and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-label-caps text-muted-text">Commission Estimate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={commissionEstimate}
                    onChange={e => setCommissionEstimate(e.target.value)}
                    placeholder="e.g. 6.5"
                    className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-label-caps text-muted-text">Priority Weighting</label>
                  <input
                    type="number"
                    required
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    placeholder="e.g. 1 (lower numbers surface first)"
                    className="w-full bg-card-cream border border-border-warm-grey rounded-lg px-3 py-2 text-xs font-semibold text-ink-text focus:border-[#1f4d3f] focus:outline-none"
                  />
                </div>
              </div>

              {/* Surfacing Triggers Selection */}
              <div className="space-y-2">
                <label className="block text-[10px] font-label-caps text-muted-text">Surfacing Event Triggers</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#f3ede1]/40 border border-border-warm-grey/50 p-4 rounded-lg">
                  {Object.keys(TRIGGER_LABELS).map(triggerKey => {
                    const isChecked = surfaceTriggers[triggerKey] || false;
                    return (
                      <button
                        type="button"
                        key={triggerKey}
                        onClick={() => toggleTrigger(triggerKey)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition cursor-pointer select-none ${
                          isChecked
                            ? 'bg-ai-sage-tint text-[#1f4d3f] border-[#8dbdab] font-bold'
                            : 'bg-card-cream text-muted-text border-border-warm-grey/50 hover:bg-[#ede8dc]'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${
                          isChecked ? 'bg-[#1f4d3f] border-transparent text-white' : 'border-border-warm-grey bg-white'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <span className="truncate">{TRIGGER_LABELS[triggerKey]}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-text">
                  Choose which user flows in planning trigger this partner's contextual recommendations.
                </p>
              </div>

              {/* Link Tester Tool UI */}
              <div className="space-y-3 bg-[#ede8dc] border border-border-warm-grey p-5 rounded-xl">
                <h4 className="text-[10px] font-label-caps text-[#1f4d3f] font-bold flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" /> Deep Link Verification Console
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="block text-[8px] font-label-caps text-muted-text uppercase">Destination (ID)</span>
                    <input
                      type="text"
                      value={testDest}
                      onChange={e => setTestDest(e.target.value)}
                      className="w-full bg-surface border border-border-warm-grey px-2 py-1 rounded text-xs focus:outline-none"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <span className="block text-[8px] font-label-caps text-muted-text uppercase">Sub-ID Tracking Value</span>
                    <input
                      type="text"
                      value={testSubId}
                      onChange={e => setTestSubId(e.target.value)}
                      className="w-full bg-surface border border-border-warm-grey px-2 py-1 rounded text-xs focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="block text-[8px] font-label-caps text-muted-text uppercase">Resolved Outbound URL</span>
                  <div className="bg-surface border border-border-warm-grey rounded p-2.5 text-[10px] font-mono break-all text-ink-text select-all">
                    {generateTestLink()}
                  </div>
                </div>

                <a
                  href={generateTestLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#1f4d3f] border border-[#1f4d3f] hover:bg-[#1f4d3f] hover:text-white px-3 py-1.5 rounded-lg transition active:scale-[0.98]"
                >
                  Verify Tracking Destination <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-border-warm-grey flex justify-between gap-4">
                
                {/* Delete button (only when editing) */}
                {selectedPartner ? (
                  <button
                    type="button"
                    onClick={handleDeletePartner}
                    className="border border-[#ba1a1a] hover:bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition active:scale-[0.98]"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="border border-border-warm-grey bg-surface-container-lowest hover:bg-[#ede8dc] text-muted-text text-xs font-bold px-4 py-2.5 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    disabled={isPending}
                    className="bg-[#1f4d3f] hover:bg-[#15342a] text-white text-xs font-bold px-5 py-2.5 rounded-lg transition active:scale-[0.98]"
                  >
                    {isPending ? 'Saving...' : 'Save Partner'}
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
