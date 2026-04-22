import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../hooks/useSocket';
import { LogOut, Package, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import StockManagement from './admin/StockManagement';

export default function StockManagerDashboard() {
  const { logout, user } = useAuth();
  const { socket, connected: isConnected } = useSocket();

  return (
    <div className="min-h-screen bg-[#07070c] text-white selection:bg-orange-500/30 selection:text-orange-200 overflow-x-hidden">
      {/* ── Background Elements ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#07070c]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20"
              whileHover={{ rotate: 10, scale: 1.05 }}
            >
              <Package size={22} className="text-white" />
            </motion.div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">ROMS</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mt-1">Stock Management</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                {isConnected ? 'Real-time Active' : 'Connecting...'}
              </span>
            </div>

            <div className="flex items-center gap-3 pl-6 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white">{user?.name}</p>
                <p className="text-[10px] text-white/40 font-medium capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <motion.button
                onClick={logout}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
              >
                <LogOut size={18} />
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="pt-28 pb-12 px-6 sm:px-10 max-w-[1600px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <StockManagement />
        </motion.div>
      </main>

      {/* ── Socket Status Floating Badge (Mobile) ── */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <motion.div 
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl backdrop-blur-xl border shadow-2xl ${
            isConnected ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
          animate={isConnected ? {} : { scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
