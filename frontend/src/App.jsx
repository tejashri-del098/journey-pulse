import React, { useState, useEffect } from 'react';
import { Activity, LayoutDashboard, Route, Target, Users, Zap, CheckCircle2, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import { api } from './api';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VariantGenerator } from './components/VariantTable';
import { JourneyView } from './components/JourneyView';
import { CalibrationView } from './components/CalibrationView';

// Utility for merging tailwind classes safely
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// -----------------------------------------------------------------------------
// UI Components
// -----------------------------------------------------------------------------

function KPICard({ title, value, prefix = '', suffix = '%', trend, inverseTrend = false }) {
  const isPositive = trend > 0;
  const isGood = inverseTrend ? !isPositive : isPositive;
  
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5 flex flex-col gap-2">
      <h3 className="text-sm font-medium text-slate-400">{title}</h3>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold text-slate-50">
          {prefix}{value}{suffix}
        </div>
        {trend !== undefined && (
          <div className={cn(
            "text-xs font-medium px-2 py-1 rounded-md",
            isGood ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          )}>
            {isPositive ? '+' : ''}{trend}%
          </div>
        )}
      </div>
    </div>
  );
}

function TrustGauge({ score, band, chiefConcern }) {
  let color = 'text-emerald-500';
  let Icon = CheckCircle2;
  
  if (band === 'Caution') {
    color = 'text-amber-500';
    Icon = AlertTriangle;
  } else if (band === 'Risky') {
    color = 'text-red-500';
    Icon = ShieldAlert;
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-6 h-full flex flex-col">
      <h3 className="text-sm font-medium text-slate-400 mb-4">Trust & Ethics Score</h3>
      
      <div className="flex flex-col xl:flex-row items-center xl:items-start text-center xl:text-left gap-4 xl:gap-6 mb-6">
        <div className="relative w-20 h-20 xl:w-24 xl:h-24 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90 transform drop-shadow-md" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" className="stroke-zinc-800" strokeWidth="8" />
            <circle 
              cx="50" cy="50" r="45" fill="none" 
              className={cn("stroke-current animate-sweep", color)} 
              strokeWidth="8" strokeDasharray="283 283" strokeLinecap="round" 
              style={{ '--gauge-offset': 283 - (score / 100) * 283, strokeDashoffset: 283 }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl xl:text-3xl font-display font-bold text-slate-50 drop-shadow-sm">{score}</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-1 items-center xl:items-start">
          <div className={cn("flex items-center gap-2 font-semibold text-base xl:text-lg", color)}>
            <Icon size={20} />
            {band}
          </div>
          <p className="text-xs xl:text-sm text-slate-400">
            {band === 'Trustworthy' ? 'Campaign is ethical and respects boundaries.' : 
             band === 'Caution' ? 'Some personas flagged minor manipulative tactics.' : 
             'High risk of trust erosion and mass unsubscribes.'}
          </p>
        </div>
      </div>

      {chiefConcern && (
        <div className="mt-auto bg-slate-950 rounded-lg p-4 border border-red-500/20">
          <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Chief Concern</div>
          <p className="text-sm text-slate-300">"{chiefConcern}"</p>
        </div>
      )}
    </div>
  );
}

function FocusGroup({ personas }) {
  if (!personas || personas.length === 0) return null;
  
  // Show only a few interesting ones (mix of high engagement and flags)
  const sorted = [...personas].sort((a, b) => {
    if (a.manipulationFlag && !b.manipulationFlag) return -1;
    if (!a.manipulationFlag && b.manipulationFlag) return 1;
    return 0;
  }).slice(0, 4);

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-6">
      <h3 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
        <Users size={16} /> Live Persona Reactions
      </h3>
      <div className="flex flex-col gap-4">
        {sorted.map(p => (
          <div key={p.personaId} className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-sm font-medium text-slate-300">
              {p.personaName ? p.personaName.charAt(0) : '?'}
            </div>
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">{p.personaName || 'Persona'} <span className="text-slate-500 text-xs ml-2">({p.segment})</span></span>
                {p.manipulationFlag && (
                  <span className="text-xs font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded">Flagged</span>
                )}
              </div>
              <div className={cn(
                "text-sm p-3 rounded-lg rounded-tl-none border",
                p.manipulationFlag ? "bg-red-500/5 border-red-500/20 text-red-200" : "bg-slate-800 border-slate-700 text-slate-300"
              )}>
                "{p.reaction}"
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main App Layout
// -----------------------------------------------------------------------------

export default function App() {
  const [activeTab, setActiveTab] = useState('simulate'); // 'simulate', 'journey', 'calibrate'
  const [campaignText, setCampaignText] = useState('');
  const [channel, setChannel] = useState('email');
  const [segment, setSegment] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Load test campaigns
  const [testCampaigns, setTestCampaigns] = useState([]);
  useEffect(() => {
    api.testCampaigns().then(data => setTestCampaigns(data.campaigns)).catch(console.error);
  }, []);

  const handleSimulate = async (e) => {
    e.preventDefault();
    if (!campaignText) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await api.simulate(campaignText, channel, segment || undefined);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillTest = (c) => {
    setCampaignText(c.campaignText);
    setChannel(c.channel);
    setSegment('');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-slate-200">
      
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-950/40 backdrop-blur-2xl border-r border-sidebar-border flex flex-col relative z-10 shadow-2xl">
        <div className="p-6">
          <div className="flex items-center gap-2 text-2xl font-display font-bold text-white tracking-tight">
            <Activity className="text-accent-blue animate-pulse-glow rounded-full" />
            JourneyPulse
          </div>
          <p className="text-xs text-slate-400 mt-1">Connected Campaign Simulator</p>
        </div>
        
        <nav className="flex-1 px-4 py-2 flex flex-col gap-2">
          <button onClick={() => setActiveTab('simulate')} className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === 'simulate' ? "bg-accent-blue/10 text-accent-blue" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}>
            <Zap size={18} /> Quick Sim
          </button>
          <button onClick={() => setActiveTab('journey')} className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === 'journey' ? "bg-accent-blue/10 text-accent-blue" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}>
            <Route size={18} /> Journey Sequence
          </button>
          <button onClick={() => setActiveTab('calibrate')} className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === 'calibrate' ? "bg-accent-blue/10 text-accent-blue" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}>
            <Target size={18} /> Calibration
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <header className="flex items-center justify-between">
            <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3 tracking-tight">
              <LayoutDashboard className="text-accent-blue" size={28} /> 
              {activeTab === 'simulate' ? 'Single Campaign Simulation' : activeTab === 'journey' ? 'Connected Journey' : 'Prediction Calibration'}
            </h1>
            
            {activeTab === 'simulate' && testCampaigns.length > 0 && (
              <div className="flex gap-2">
                <span className="text-sm text-slate-500 self-center mr-2">Try:</span>
                {testCampaigns.map(c => (
                  <button key={c.id} onClick={() => fillTest(c)} className="px-3 py-1 text-xs font-medium rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition">
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </header>

          {activeTab === 'simulate' && (
            <div className="grid grid-cols-12 gap-6">
              
              {/* Input Form Column */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                <form onSubmit={handleSimulate} className="bg-card-bg border border-card-border rounded-xl p-6 flex flex-col gap-4">
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-400">Campaign Copy</label>
                    <textarea 
                      value={campaignText}
                      onChange={e => setCampaignText(e.target.value)}
                      className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none resize-none"
                      placeholder="Enter your email, SMS, or push copy here..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-400">Channel</label>
                      <select value={channel} onChange={e => setChannel(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm outline-none focus:border-accent-blue">
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="push">Push Notification</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-400">Segment (Optional)</label>
                      <select value={segment} onChange={e => setSegment(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm outline-none focus:border-accent-blue">
                        <option value="">All Segments</option>
                        <option value="Loyal High-Spenders">Loyal High-Spenders</option>
                        <option value="Bargain Hunters">Bargain Hunters</option>
                        <option value="Privacy-First Skeptics">Privacy-First Skeptics</option>
                        <option value="Engaged Newcomers">Engaged Newcomers</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    disabled={loading || !campaignText}
                    type="submit" 
                    className="mt-2 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:from-slate-700 disabled:to-slate-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/25 text-white font-medium py-3 rounded-lg transition-all duration-300 flex justify-center items-center gap-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                    {loading ? 'Simulating Focus Group...' : 'Run Simulation'}
                  </button>

                  {error && (
                    <div className="mt-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg">
                      {error}
                    </div>
                  )}
                </form>
              </div>

              {/* Results Column */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                {!result && !loading && (
                  <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-card-bg/50 text-slate-500 py-20">
                    <Activity size={48} className="mb-4 opacity-50" />
                    <p>Enter campaign text and run simulation to see predictions.</p>
                  </div>
                )}

                {loading && !result && (
                  <div className="h-full flex flex-col items-center justify-center border border-slate-800 rounded-xl bg-card-bg py-20">
                    <Loader2 size={48} className="text-accent-blue animate-spin mb-4" />
                    <p className="text-slate-400 animate-pulse">Running campaign on AI focus group...</p>
                  </div>
                )}

                {result && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
                    
                    {/* Top Row: KPIs + Trust */}
                    <div className="grid grid-cols-12 gap-6">
                      <div className="col-span-8 grid grid-cols-2 gap-4">
                        <KPICard title="Predicted Open Rate" value={result.kpis.predictedOpenRate} />
                        <KPICard title="Predicted Click Rate" value={result.kpis.predictedClickRate} />
                        <KPICard title="Conversion Rate" value={result.kpis.predictedConversionRate} />
                        <KPICard title="Unsubscribe Rate" value={result.kpis.predictedUnsubscribeRate} inverseTrend={true} />
                      </div>
                      <div className="col-span-4">
                        <TrustGauge score={result.trustScore} band={result.trustBand} chiefConcern={result.chiefConcern} />
                      </div>
                    </div>

                    {/* Bottom Row: Transcript */}
                    <FocusGroup personas={result.personas} />

                    {/* Variant Generator (shown if trust is an issue or user wants improvement) */}
                    <VariantGenerator 
                      campaignText={campaignText} 
                      channel={channel} 
                      segment={segment} 
                      originalResult={result} 
                      onApplyVariant={(newText) => {
                        setCampaignText(newText);
                        setResult(null); // Clear result to encourage re-simulation
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }} 
                    />
                    
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === 'journey' && <JourneyView />}
          
          {activeTab === 'calibrate' && <CalibrationView />}

        </div>
      </main>
    </div>
  );
}
