import React, { useState } from 'react';
import { Play, Plus, Trash2, ArrowRight, Activity, Users, AlertTriangle, Loader2, Route } from 'lucide-react';
import { api } from '../api';
import { cn } from '../App';

export function JourneyView() {
  const [sequence, setSequence] = useState([
    { day: 1, channel: 'email', text: 'Welcome to our premium club! Take 10% off your first order.' },
    { day: 3, channel: 'sms', text: 'Reminder: your 10% off expires soon. Use it today!' },
    { day: 5, channel: 'push', text: 'Last chance! 10% off ends tonight.' }
  ]);
  const [segment, setSegment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const addStep = () => {
    const lastDay = sequence.length > 0 ? sequence[sequence.length - 1].day : 0;
    setSequence([...sequence, { day: lastDay + 2, channel: 'email', text: '' }]);
  };

  const removeStep = (index) => {
    setSequence(sequence.filter((_, i) => i !== index));
  };

  const updateStep = (index, field, value) => {
    const newSeq = [...sequence];
    newSeq[index][field] = field === 'day' ? parseInt(value) || 1 : value;
    setSequence(newSeq);
  };

  const runJourney = async () => {
    if (sequence.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.simulateJourney(sequence, segment || undefined);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      
      {/* Sidebar / Builder */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Route className="text-accent-blue" size={20} /> Journey Builder
            </h2>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-400">Target Segment</label>
            <select value={segment} onChange={e => setSegment(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm outline-none focus:border-accent-blue">
              <option value="">All Segments (Default)</option>
              <option value="Loyal High-Spenders">Loyal High-Spenders</option>
              <option value="Bargain Hunters">Bargain Hunters</option>
              <option value="Privacy-First Skeptics">Privacy-First Skeptics</option>
              <option value="Engaged Newcomers">Engaged Newcomers</option>
            </select>
          </div>

          <div className="space-y-4 mt-2">
            <div className="text-sm font-medium text-slate-400 border-b border-slate-800 pb-2">Sequence</div>
            {sequence.map((step, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 relative group">
                <button onClick={() => removeStep(idx)} className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={16} />
                </button>
                <div className="flex gap-2 mb-2 pr-6">
                  <div className="w-20">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 block">Day</label>
                    <input type="number" value={step.day} onChange={e => updateStep(idx, 'day', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 block">Channel</label>
                    <select value={step.channel} onChange={e => updateStep(idx, 'channel', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200">
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="push">Push</option>
                    </select>
                  </div>
                </div>
                <textarea 
                  value={step.text} onChange={e => updateStep(idx, 'text', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 resize-none h-16"
                  placeholder={`Step ${idx + 1} message...`}
                />
              </div>
            ))}
          </div>

          <button onClick={addStep} className="flex items-center justify-center gap-2 w-full py-2 border border-dashed border-slate-700 text-slate-400 rounded-lg hover:text-slate-200 hover:border-slate-500 transition text-sm">
            <Plus size={16} /> Add Touchpoint
          </button>

          <button 
            disabled={loading || sequence.length === 0}
            onClick={runJourney}
            className="mt-4 w-full bg-accent-blue hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {loading ? 'Simulating Journey...' : 'Run Journey Simulation'}
          </button>

          {error && <div className="mt-2 text-xs text-red-400 bg-red-400/10 p-2 rounded">{error}</div>}
        </div>
      </div>

      {/* Results View */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        {!result && !loading && (
          <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-900/50 text-slate-500 py-20 min-h-[400px]">
            <Route size={48} className="mb-4 opacity-50" />
            <p>Build a sequence and run the simulation to see journey-level insights.</p>
          </div>
        )}

        {loading && !result && (
          <div className="h-full flex flex-col items-center justify-center border border-slate-800 rounded-xl bg-slate-900 py-20 min-h-[400px]">
            <Loader2 size={48} className="text-accent-blue animate-spin mb-4" />
            <p className="text-slate-400 animate-pulse">Simulating multi-step journey...</p>
            <p className="text-xs text-slate-500 mt-2">Carrying persona state across days...</p>
          </div>
        )}

        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
            
            {/* Insights Top Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertTriangle size={14}/> Journey Fatigue</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-slate-100">{result.insights.journeyFatigueScore}</span>
                    <span className="text-slate-500 mb-1">/100</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                    <div 
                      className={cn("h-full", result.insights.journeyFatigueScore > 60 ? "bg-red-500" : result.insights.journeyFatigueScore > 30 ? "bg-amber-500" : "bg-emerald-500")} 
                      style={{ width: `${result.insights.journeyFatigueScore}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Users size={14}/> Total Audience Loss</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-red-400">{result.insights.cumulativeUnsubscribeRate}%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Lost across {result.metadata.totalSteps} touchpoints.</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-accent-blue uppercase tracking-wider mb-2">AI Recommendation</h3>
                  <p className="text-sm font-medium text-slate-200 mb-1">{result.insights.recommendation}</p>
                  <p className="text-xs text-slate-400">{result.insights.rationale}</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-medium text-slate-400 mb-6">Engagement Timeline</h3>
              <div className="relative border-l-2 border-slate-800 ml-4 space-y-8">
                {result.steps.map((step, i) => {
                  const dropOff = result.insights.dropOffRates[i];
                  return (
                    <div key={i} className="relative pl-6">
                      <div className={cn(
                        "absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-slate-900",
                        step.channel === 'email' ? 'bg-blue-500' : step.channel === 'sms' ? 'bg-green-500' : 'bg-purple-500'
                      )} />
                      
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-slate-200">Day {step.day}</span>
                        <span className="text-xs font-medium uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded text-slate-400">{step.channel}</span>
                        
                        {dropOff > 0 && (
                          <span className="ml-auto text-xs font-medium text-red-400 flex items-center gap-1">
                            -{dropOff}% engagement from prev step
                          </span>
                        )}
                      </div>
                      
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Open Rate</div>
                            <div className="font-semibold text-slate-200">{step.kpis.predictedOpenRate}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Click Rate</div>
                            <div className="font-semibold text-slate-200">{step.kpis.predictedClickRate}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Unsubscribe</div>
                            <div className="font-semibold text-red-400">{step.kpis.predictedUnsubscribeRate}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Trust</div>
                            <div className={cn(
                              "font-semibold text-sm",
                              step.trustBand === 'Trustworthy' ? 'text-emerald-400' : step.trustBand === 'Caution' ? 'text-amber-400' : 'text-red-400'
                            )}>{step.trustScore} - {step.trustBand}</div>
                          </div>
                        </div>
                        {step.chiefConcern && (
                          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                            <span className="text-amber-400 font-semibold mr-1">Flag:</span> {step.chiefConcern}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
