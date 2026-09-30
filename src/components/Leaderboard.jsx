import React, { useEffect, useState } from 'react';
import { fetchRankings } from '../api/mockRankings';

export default function Leaderboard({ songId, songTitle, onClose }) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    fetchRankings(songId).then(data => {
      if (isMounted) {
        setRankings(data);
        setLoading(false);
      }
    });
    
    return () => {
      isMounted = false;
    };
  }, [songId]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
      <div className="bg-neutral-800 w-full max-w-4xl max-h-full flex flex-col rounded-3xl border-4 border-neutral-700 overflow-hidden">
        
        <div className="bg-neutral-900 p-6 flex justify-between items-center border-b-4 border-neutral-700">
          <div>
            <h2 className="text-3xl font-black text-cyan-400 tracking-widest">LEADERBOARD</h2>
            <div className="text-neutral-400 font-bold mt-1">{songTitle || songId}</div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-black text-xl flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-pulse text-2xl font-bold text-neutral-500 tracking-widest">LOADING...</div>
            </div>
          ) : rankings.length === 0 ? (
            <div className="flex justify-center items-center h-40">
              <div className="text-xl font-bold text-neutral-500 tracking-widest">まだ記録がありません</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rankings.map((entry) => (
                <div key={entry.id} className="bg-neutral-900 rounded-2xl p-4 flex items-center gap-6">
                  
                  <div className="w-16 flex-shrink-0 text-center">
                    <span className={`text-3xl font-black ${
                      entry.rank === 1 ? 'text-yellow-400' : 
                      entry.rank === 2 ? 'text-neutral-300' : 
                      entry.rank === 3 ? 'text-orange-600' : 'text-neutral-500'
                    }`}>
                      #{entry.rank}
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    <div className="text-2xl font-black text-white truncate">{entry.playerName}</div>
                  </div>
                  
                  <div className="flex items-center gap-8 text-right">
                    <div className="w-24">
                      <div className="text-xs font-bold text-neutral-500 tracking-widest mb-1">MAX COMBO</div>
                      <div className="font-mono text-xl text-yellow-400">{entry.maxCombo}</div>
                    </div>
                    <div className="w-24">
                      <div className="text-xs font-bold text-neutral-500 tracking-widest mb-1">MAX KPS</div>
                      <div className="font-mono text-xl text-cyan-400">{entry.maxKps.toFixed(2)}</div>
                    </div>
                    <div className="w-32 border-l-2 border-neutral-700 pl-6">
                      <div className="text-xs font-bold text-neutral-500 tracking-widest mb-1">SCORE</div>
                      <div className="font-mono text-3xl font-black text-white">{entry.score}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
