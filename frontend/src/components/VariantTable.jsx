import React, { useState } from 'react';
import { api } from '../api';
import { Sparkles, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../App';

export function VariantGenerator({ campaignText, channel, segment, originalResult, onApplyVariant }) {
  const [loading, setLoading] = useState(false);
  const [variantsData, setVariantsData] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the quick generation endpoint or full endpoint
      // We'll use the full /api/variants endpoint that simulates and ranks
      const res = await fetch('http://localhost:3001/api/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignText, channel, segment, originalResult }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Failed to generate variants');
      }
      
      const data = await res.json();
      setVariantsData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!variantsData && !loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-6 flex items-center justify-between">
        <div>
          <h3 className="text-slate-200 font-display font-medium flex items-center gap-2">
            <Sparkles className="text-accent-amber animate-pulse-glow" size={18} />
            Need better results?
          </h3>
          <p className="text-sm text-slate-400 mt-1">Generate ethical variants that fix the chief concern while maintaining engagement.</p>
        </div>
        <button onClick={handleGenerate} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2">
          Generate Variants
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mt-6 flex flex-col items-center justify-center">
        <Loader2 size={32} className="text-accent-amber animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Generating & Simulating Alternatives...</p>
        <p className="text-xs text-slate-500 mt-2">This runs 3 simultaneous simulations against the persona bank.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mt-6 text-red-400 text-sm">
        <p className="font-medium">Error generating variants</p>
        <p>{error}</p>
        <button onClick={handleGenerate} className="mt-3 flex items-center gap-2 text-xs bg-red-500/20 px-3 py-1.5 rounded hover:bg-red-500/30">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card-bg border border-card-border shadow-xl rounded-xl overflow-hidden mt-6">
      <div className="p-5 border-b border-card-border flex items-center justify-between bg-zinc-950/50 backdrop-blur-sm">
        <h3 className="text-slate-200 font-display font-medium flex items-center gap-2">
          <Sparkles className="text-accent-amber animate-pulse-glow" size={18} />
          Variant Analysis
        </h3>
        {variantsData.improvement.trustScoreDelta > 0 && (
          <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
            +{variantsData.improvement.trustScoreDelta} Trust Score available
          </span>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-400 uppercase bg-zinc-950/80 border-b border-zinc-800 tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Strategy & Copy</th>
              <th className="px-6 py-4 font-semibold">Trust Band</th>
              <th className="px-6 py-4 whitespace-nowrap font-semibold">Open / Click / Conv</th>
              <th className="px-6 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {variantsData.ranking.map((v, idx) => (
              <tr key={idx} className={cn("hover:bg-zinc-800/40 transition-colors", v.strategy === 'Original' ? "bg-zinc-950/50" : "")}>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-200 mb-1 flex items-center gap-2">
                    {v.strategy} 
                    {idx === 0 && <span className="text-[10px] bg-accent-blue/20 text-accent-blue px-1.5 py-0.5 rounded uppercase tracking-wider">Top Pick</span>}
                  </div>
                  <p className="text-slate-400 mb-2 italic">"{v.campaignText}"</p>
                  <p className="text-xs text-slate-500">{v.changesSummary}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={cn(
                    "inline-flex font-medium text-xs px-2 py-1 rounded-md",
                    v.trustBand === 'Trustworthy' ? 'bg-emerald-500/10 text-emerald-400' :
                    v.trustBand === 'Caution' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  )}>
                    {v.trustScore} - {v.trustBand}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-300 font-medium">
                  {v.kpis?.predictedOpenRate}% / {v.kpis?.predictedClickRate}% / <span className="text-accent-blue">{v.kpis?.predictedConversionRate}%</span>
                </td>
                <td className="px-6 py-4 text-right">
                  {v.strategy !== 'Original' && (
                    <button 
                      onClick={() => onApplyVariant(v.campaignText)}
                      className="text-accent-blue hover:text-blue-400 font-medium flex items-center justify-end gap-1 w-full"
                    >
                      Use Copy <ArrowRight size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
