import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { api } from '../api';
import { cn } from '../App';

export function CalibrationView() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/calibrate/history');
      if (!res.ok) throw new Error('Failed to fetch calibration history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <Loader2 size={32} className="text-accent-blue animate-spin mb-4" />
        <p className="text-slate-400">Loading calibration history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
        <Target size={48} className="text-slate-600 mb-4" />
        <p className="text-slate-400 font-medium text-lg">No calibration runs yet.</p>
        <p className="text-sm text-slate-500 mt-2">Run the test script \`npm run test-calibration\` to seed data.</p>
      </div>
    );
  }

  const latest = history[history.length - 1];
  const sortedHistory = [...history].reverse(); // newest first

  return (
    <div className="grid grid-cols-12 gap-6">
      
      {/* Overview */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-6">
            <Target className="text-accent-blue" size={20} /> Model Accuracy
          </h2>
          
          <div className="flex flex-col items-center justify-center py-6">
            <div className="text-6xl font-bold text-white mb-2">{latest.accuracyScore}%</div>
            <div className="text-sm text-slate-400 font-medium">Current Accuracy Score</div>
          </div>
          
          <div className="bg-slate-950 p-4 rounded-lg mt-4 border border-slate-800">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mean Absolute Error</div>
            <div className="text-2xl font-bold text-slate-200">{latest.mae} <span className="text-sm font-normal text-slate-500">pts</span></div>
          </div>
          
          {latest.divergenceFlag && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs text-amber-400 leading-relaxed">
              <span className="font-bold">Heads up:</span> {latest.divergenceFlag}
            </div>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="col-span-12 lg:col-span-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-6">Calibration History</h3>
          
          <div className="space-y-4">
            {sortedHistory.map((run, i) => {
              const isFirst = i === 0;
              const prevRun = sortedHistory[i + 1];
              let trendIcon = <Minus size={16} className="text-slate-500" />;
              
              if (prevRun) {
                if (run.accuracyScore > prevRun.accuracyScore) trendIcon = <TrendingUp size={16} className="text-emerald-500" />;
                if (run.accuracyScore < prevRun.accuracyScore) trendIcon = <TrendingDown size={16} className="text-red-500" />;
              }

              return (
                <div key={run.id} className={cn("p-4 rounded-lg border", isFirst ? "bg-slate-950/80 border-slate-700" : "bg-slate-950/40 border-slate-800/50")}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">{run.campaignName}</span>
                      <span className="text-xs text-slate-500">{new Date(run.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">Accuracy:</span>
                      <span className="text-xl font-bold text-white flex items-center gap-1">
                        {run.accuracyScore}% {trendIcon}
                      </span>
                    </div>
                  </div>
                  
                  {/* Metric Comparison */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-slate-900 rounded">
                      <div className="text-slate-500 mb-1">Open Rate</div>
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-400">P: {run.predicted?.predictedOpenRate}%</span>
                        <span className="text-accent-blue">A: {run.actual?.actualOpenRate}%</span>
                      </div>
                    </div>
                    <div className="p-2 bg-slate-900 rounded">
                      <div className="text-slate-500 mb-1">Click Rate</div>
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-400">P: {run.predicted?.predictedClickRate}%</span>
                        <span className="text-accent-blue">A: {run.actual?.actualClickRate}%</span>
                      </div>
                    </div>
                    <div className="p-2 bg-slate-900 rounded">
                      <div className="text-slate-500 mb-1">Conversion</div>
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-400">P: {run.predicted?.predictedConversionRate}%</span>
                        <span className="text-accent-blue">A: {run.actual?.actualConversionRate}%</span>
                      </div>
                    </div>
                    <div className="p-2 bg-slate-900 rounded">
                      <div className="text-slate-500 mb-1">Unsubscribe</div>
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-400">P: {run.predicted?.predictedUnsubscribeRate}%</span>
                        <span className="text-red-400">A: {run.actual?.actualUnsubscribeRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
    </div>
  );
}
