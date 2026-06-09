/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  FileCode, CheckCircle2, ChevronRight, Copy, Terminal, 
  HelpCircle, Sparkles, Server, BookOpen, Scaling, AlertCircle
} from "lucide-react";
import { CODE_BLUEPRINTS } from "../data/codeBlueprints";
import { PhaseBlueprint, PhaseFile } from "../types";

export default function BlueprintExplorer() {
  const [activePhaseId, setActivePhaseId] = useState<string>("phase3"); // Default to Orleans phase
  const [activeFileIndex, setActiveFileIndex] = useState<number>(1); // FlightGrain implementation
  const [copied, setCopied] = useState<boolean>(false);

  // Retrieve current active structures
  const activePhase = CODE_BLUEPRINTS.find(p => p.id === activePhaseId) || CODE_BLUEPRINTS[0];
  const activeFile = activePhase.files[activeFileIndex] || activePhase.files[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Switch phase reset file index
  const selectPhase = (id: string) => {
    setActivePhaseId(id);
    setActiveFileIndex(0);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      
      {/* 1. Left side: Phases List Selector (Col 1 to 4) */}
      <div className="lg:col-span-4 bg-[#121217] border border-[#27272a] rounded-lg p-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-xs uppercase tracking-wider text-gray-300">Architectural Phases</span>
          </div>

          <p className="text-xs text-[#71717a] font-mono leading-relaxed">
            Browse pristine .NET 9 specifications, virtual actor codebases, and configurations across all 10 project deployment stages.
          </p>

          <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
            {CODE_BLUEPRINTS.map((phase) => {
              const isActive = phase.id === activePhaseId;
              return (
                <button
                  key={phase.id}
                  onClick={() => selectPhase(phase.id)}
                  className={`w-full text-left p-2.5 rounded transition duration-150 flex items-center justify-between border cursor-pointer ${
                    isActive 
                      ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400" 
                      : "bg-black border-[#27272a] text-[#71717a] hover:text-white hover:border-cyan-500/40"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-mono text-[9px] uppercase font-bold tracking-wider block opacity-70">
                      {phase.subtitle.substring(0, 32)}...
                    </span>
                    <span className="text-xs font-semibold font-mono truncate block mt-0.5">
                      {phase.title}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'rotate-90 text-cyan-400' : ''}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#27272a]">
          <div className="flex items-center gap-2 text-xs text-[#71717a] font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Compiled strictly in .NET 9.0</span>
          </div>
        </div>
      </div>

      {/* 2. Center: File selection & Code Console terminal (Col 5 to 12) */}
      <div className="lg:col-span-8 flex flex-col space-y-6">
        
        {/* Active Phase Context Metadata */}
        <div className="bg-[#121217] border border-[#27272a] rounded-lg p-5">
          <div className="flex items-start gap-4 justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2.5 py-1 rounded">
                Active Architectural Context
              </span>
              <h3 className="text-sm font-bold text-gray-200 mt-3 font-mono uppercase tracking-tight">{activePhase.title}</h3>
              <p className="text-xs text-gray-300 mt-1.5 leading-relaxed font-sans">{activePhase.summary}</p>
            </div>
          </div>

          {/* Files tabs underneath */}
          <div className="flex gap-2 flex-wrap border-t border-[#27272a] mt-4 pt-3.5">
            {activePhase.files.map((file, idx) => {
              const isSelected = idx === activeFileIndex;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveFileIndex(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs transition duration-150 border cursor-pointer ${
                    isSelected 
                      ? "bg-black border-cyan-500 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                      : "bg-[#121217] border-[#27272a] text-[#71717a] hover:text-gray-300 hover:bg-black"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-cyan-500" />
                  {file.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Code Content Editor / Presenter Console */}
        <div className="bg-[#0e0e11] border border-[#27272a] rounded-lg overflow-hidden flex flex-col flex-1">
          {/* Console Header Bar */}
          <div className="bg-black px-4 py-2 border-b border-[#27272a] flex justify-between items-center font-mono text-xs text-[#a1a1aa]">
            <span className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>{activeFile.path}</span>
            </span>

            <button 
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#121217] hover:bg-[#27272a] border border-[#27272a] text-cyan-400 hover:text-white transition duration-150 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? "Copied!" : "Copy Specification"}</span>
            </button>
          </div>

          {/* Pre-formatted source block */}
          <div className="p-5 overflow-auto max-h-[440px] font-mono text-xs leading-5 bg-black scrollbar-thin">
            <pre className="text-emerald-400 max-w-full overflow-x-auto whitespace-pre">
              {activeFile.content}
            </pre>
          </div>

          {/* Core File Specific Annotation descriptor */}
          <div className="bg-[#121217] border-t border-[#27272a] p-4 text-[11.5px] text-gray-400 leading-relaxed font-mono">
            <span className="font-bold text-gray-300 block mb-1">Specification Goal:</span>
            {activeFile.description}
          </div>
        </div>

        {/* Architectural analysis blocks (Best practices, Tradeoffs, etc.) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="bg-[#121217] border border-[#27272a] rounded-lg p-4">
            <h4 className="font-mono text-[10.5px] uppercase text-emerald-400 flex items-center gap-1.5 mb-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Architect Best Practices
            </h4>
            <ul className="space-y-1.5 text-xs text-gray-300 list-disc list-inside pl-1 font-sans">
              {activePhase.bestPractices.map((bp, i) => (
                <li key={i}>{bp}</li>
              ))}
            </ul>
          </div>

          <div className="bg-[#121217] border border-[#27272a] rounded-lg p-4">
            <h4 className="font-mono text-[10.5px] uppercase text-amber-500 flex items-center gap-1.5 mb-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Architect Trade-Offs
            </h4>
            <ul className="space-y-1.5 text-xs text-gray-300 list-disc list-inside pl-1 font-sans">
              {activePhase.tradeoffs.map((to, i) => (
                <li key={i}>{to}</li>
              ))}
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
