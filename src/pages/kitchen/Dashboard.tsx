import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useSocket } from '../../hooks/useSocket';
import { ChefHat, Clock, CheckCircle, Play, LogOut, Search, Wifi, Bell, X, ToggleLeft, ToggleRight, Layers, ShoppingBag, Send, Plus, Minus, CheckCircle2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function OrderSectionDashboard() {
  const { logout, user } = useAuth();
  const { socket } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ cgst_percent: 2.5, sgst_percent: 2.5, service_charge_percent: 0 });
  const [menuVegFilter, setMenuVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const prevOrderCount = useRef(0);

  // Table Management State
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [showMergeTable, setShowMergeTable] = useState(false);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [showDeleteTable, setShowDeleteTable] = useState(false);
  const [deleteTableId, setDeleteTableId] = useState<any>(null);
  const [tableLoading, setTableLoading] = useState(false);

  // Set auth header before every API call
  const setAuthHeader = () => {
    const tok = localStorage.getItem('roms_token') || localStorage.getItem('token');
    if (tok) axios.defaults.headers.common['Authorization'] = `Bearer ${tok}`;
  };

  // POS State
  const [selectedPosTable, setSelectedPosTable] = useState<any>(null);
  const [posCart, setPosCart] = useState<any[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [posLoading, setPosLoading] = useState(false);
  const [posDiscount, setPosDiscount] = useState(0);
  const posSearchRef = useRef<HTMLInputElement>(null);

  // Hotkeys for quick item add — Q W E R T Y U I O P A S D F G H
  const ITEM_HOTKEYS = ['q','w','e','r','t','y','u','i','o','p','a','s','d','f','g','h'];

  useEffect(() => {
    fetchOrders();
    fetchMenu();
    fetchTables();
    fetchSettings();
    if (socket) {
      socket.on('new-order', () => { fetchOrders(); triggerAlert(); });
      socket.on('order-status-updated', fetchOrders);
      socket.on('menu-updated', fetchMenu);
      socket.on('table-status-updated', fetchTables);
    }
    return () => {
      if (socket) {
        socket.off('new-order');
        socket.off('order-status-updated');
        socket.off('menu-updated');
        socket.off('table-status-updated');
      }
    };
  }, [socket]);

  const triggerAlert = () => {
    setNewOrderAlert(true);
    setTimeout(() => setNewOrderAlert(false), 4000);
  };

  const fetchOrders = async () => {
    try {
      setAuthHeader();
      const res = await axios.get('/api/orders');
      const data = Array.isArray(res.data) ? res.data : [];
      if (data.length > prevOrderCount.current && prevOrderCount.current > 0) triggerAlert();
      prevOrderCount.current = data.length;
      setOrders(data);
    } catch (e) {
      console.error('[Orders] fetchOrders failed:', e);
    }
  };

  const fetchMenu = async () => {
    setAuthHeader();
    try { const res = await axios.get('/api/menu'); setMenu(res.data); } catch (e) {}
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      if (res.data) setSettings(res.data);
    } catch (e) {}
  };

  const fetchTables = async () => {
    try {
      setAuthHeader();
      const res = await axios.get('/api/tables');
      setTables(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('[Tables] fetchTables failed:', e);
    }
  };

  const groupOrdersByTable = () => {
    const groups: any = {};
    orders.filter(o => o.status !== 'cancelled' && o.status !== 'paid').forEach(o => {
      if (!groups[o.table_id]) {
        groups[o.table_id] = { table_number: o.table_number, staff_name: o.staff_name, orders: [], total: 0 };
      }
      groups[o.table_id].orders.push(o);
      groups[o.table_id].total += (o.total_price || 0);
    });
    return Object.values(groups);
  };

  const addToPosCart = (item: any) => {
    setPosCart(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updatePosQty = (id: number, delta: number) => {
    setPosCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (item.quantity + delta <= 0) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, quantity: i.quantity + delta } : i);
    });
  };

  const handlePlacePosOrder = async () => {
    if (!selectedPosTable || posCart.length === 0) return;
    setPosLoading(true);
    try {
      await axios.post('/api/orders', {
        table_id: selectedPosTable.id,
        items: posCart.map(i => ({ menu_id: i.id, quantity: i.quantity }))
      });
      setPosCart([]);
      setSelectedPosTable(null);
      fetchOrders();
      alert(`Order placed for ${selectedPosTable.table_number}!`);
    } catch (e: any) {
      alert('Failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setPosLoading(false);
    }
  };

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Prevent default browser behavior for F-keys
      if (['F1', 'F2', 'F3', 'F4', 'F5'].includes(e.key)) e.preventDefault();

      if (e.key === 'F1') { setPosCart([]); setSelectedPosTable(null); setPosDiscount(0); setPosSearch(''); }
      if (e.key === 'F2') { setTimeout(() => posSearchRef.current?.focus(), 100); }
      if (e.key === 'F3') { setTimeout(() => document.getElementById('pos-discount')?.focus(), 100); }
      if (e.key === 'Escape') { setPosSearch(''); setPosCart([]); setPosDiscount(0); setSelectedPosTable(null); }

      // Item hotkeys (Q-H row) — add item to cart instantly
      const isTyping = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      if (!isTyping && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        const ITEM_HOTKEYS = ['q','w','e','r','t','y','u','i','o','p','a','s','d','f','g','h'];
        const hkIdx = ITEM_HOTKEYS.indexOf(key);
        if (hkIdx !== -1) {
          const filtered = menu
            .filter(m => menuVegFilter === 'all' || (menuVegFilter === 'veg' ? m.is_veg : !m.is_veg))
            .filter(m => m.name.toLowerCase().includes(posSearch.toLowerCase()) || (m.category || '').toLowerCase().includes(posSearch.toLowerCase()));
          if (filtered[hkIdx]) {
            addToPosCart(filtered[hkIdx]);
            return;
          }
        }

        // Category selection (1-5)
        if (e.key >= '1' && e.key <= '5') {
          const catMap: any = { '1': 'Veg', '2': 'Non-Veg', '3': 'Starters', '4': 'Chinese', '5': 'Drinks' };
          if (catMap[e.key]) {
            const cat = catMap[e.key];
            if (cat === 'Veg' || cat === 'Non-Veg') { setMenuVegFilter(cat === 'Veg' ? 'veg' : 'nonveg'); setPosSearch(''); }
            else { setMenuVegFilter('all'); setPosSearch(cat); }
          }
        }
      }

      if (e.key === 'Enter' && e.shiftKey) { handlePlacePosOrder(); }
      // Table selection Alt+1..10 (0 for 10)
      if (e.altKey && (e.key >= '0' && e.key <= '9')) {
        const tableNum = e.key === '0' ? 10 : parseInt(e.key);
        const t = tables.find(t => String(t.table_number).replace(/\D/g, '') === String(tableNum));
        if (t) setSelectedPosTable(t);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [selectedPosTable, posCart, posLoading, tables, menu, menuVegFilter, posSearch]);

  const handleAddTable = async () => {
    if (!newTableNumber.trim()) return;
    setTableLoading(true);
    try {
      setAuthHeader();
      await axios.post('/api/tables', { table_number: newTableNumber.trim() });
      setNewTableNumber('');
      setShowAddTable(false);
      await fetchTables();
    } catch (e: any) {
      alert('Failed to add table: ' + (e.response?.data?.error || e.message));
    } finally { setTableLoading(false); }
  };

  const handleMergeTable = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    setTableLoading(true);
    try {
      setAuthHeader();
      await axios.post('/api/tables/merge', { source_table_id: Number(mergeSource), target_table_id: Number(mergeTarget) });
      setShowMergeTable(false);
      setMergeSource('');
      setMergeTarget('');
      await fetchOrders();
      await fetchTables();
      alert('Tables merged successfully!');
    } catch (e: any) {
      alert('Failed to merge tables: ' + (e.response?.data?.error || e.message));
    } finally { setTableLoading(false); }
  };

  const handleDeleteTable = async () => {
    if (!deleteTableId) return;
    setTableLoading(true);
    try {
      setAuthHeader();
      await axios.delete(`/api/admin/tables/${deleteTableId.id}`);
      if (selectedPosTable?.id === deleteTableId.id) setSelectedPosTable(null);
      setShowDeleteTable(false);
      setDeleteTableId(null);
      await fetchTables();
    } catch (e: any) {
      alert('Cannot delete: ' + (e.response?.data?.error || e.message));
    } finally { setTableLoading(false); }
  };

  const handleUnmergeTable = async (tableId: number) => {
    try {
      setAuthHeader();
      await axios.post('/api/tables/unmerge', { source_table_id: tableId });
      await fetchTables();
      await fetchOrders();
    } catch (e: any) {
      alert('Unmerge failed: ' + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#070710', color: 'white' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -70, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: 'rgba(7,7,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

        <div className="flex items-center gap-4">
          <motion.div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
            animate={{ boxShadow: ['0 4px 16px rgba(249,115,22,0.3)','0 6px 28px rgba(249,115,22,0.6)','0 4px 16px rgba(249,115,22,0.3)'] }}
            transition={{ duration: 2.5, repeat: Infinity }} whileHover={{ scale: 1.1, rotate: -8 }}>
            <ChefHat size={22} className="text-white" />
          </motion.div>
          <div>
            <h1 className="font-black text-lg text-white tracking-tight">Order Section</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {tables.length} table{tables.length !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* TABLE ACTIONS */}
          <button onClick={() => setShowAddTable(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white/5 border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-white/50 hover:text-emerald-400">
            <Plus size={14} /> Add Table
          </button>
          <button onClick={() => setShowMergeTable(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white/5 border border-white/10 hover:bg-blue-500/20 hover:border-blue-500/40 text-white/50 hover:text-blue-400">
            <Layers size={14} /> Merge
          </button>
          <button onClick={() => { if (selectedPosTable) { setDeleteTableId(selectedPosTable); setShowDeleteTable(true); } else setShowDeleteTable(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/40 text-white/50 hover:text-red-400 mr-4">
            <Trash2 size={14} /> Delete Table
          </button>

          <motion.div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
            animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.2, repeat: Infinity }}>
            <Wifi size={10} /> {user?.name}
          </motion.div>

          <motion.button onClick={logout} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <LogOut size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </motion.button>
        </div>
      </motion.header>

      {/* ── New Order Alert ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {newOrderAlert && (
          <motion.div className="px-4 py-3 flex items-center justify-center gap-3 font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white' }}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <motion.div animate={{ rotate: [-15, 15, -15] }} transition={{ duration: 0.4, repeat: Infinity }}>
              <Bell size={16} />
            </motion.div>
            🔔 NEW ORDER RECEIVED — Check the queue!
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main (POS Interface) ─────────────────────────────────────────────── */}
      <main className="flex-1 p-6 overflow-hidden">
        <div className="h-full flex flex-col gap-6">
          {/* TOP: Table Grid */}
          <div className="bg-white/5 rounded-[32px] border border-white/10 p-6">
            <div className="flex flex-wrap gap-3">
              {(() => {
                const tableMap: Record<number, string> = {};
                tables.forEach((t: any) => { tableMap[t.id] = t.table_number; });
                return tables.map((t: any) => {
                  const isOccupied = groupOrdersByTable().some((g: any) => g.table_number === t.table_number);
                  const isSelected = selectedPosTable?.id === t.id;
                  const isMerged = !!t.merged_into;
                  const mergedIntoName = isMerged ? (tableMap[t.merged_into] || `#${t.merged_into}`) : null;

                  let statusColor = 'border-green-500/20 text-green-500 bg-green-500/5 hover:border-green-500/50';
                  if (isOccupied) statusColor = 'border-red-500/20 text-red-500 bg-red-500/5 hover:border-red-500/50';
                  if (isMerged) statusColor = 'border-purple-500/60 text-purple-300 bg-purple-500/10 hover:border-purple-400';
                  if (isSelected) statusColor = 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/20';

                  return (
                    <div key={t.id} className="relative group flex flex-col items-center gap-1">
                      <motion.button onClick={() => setSelectedPosTable(t)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center transition-all relative ${statusColor}`}>
                        <span className="text-[10px] font-black uppercase tracking-tight leading-none">{t.table_number.split(' ')[1] || t.table_number}</span>
                        {isMerged && (
                          <span className="text-[7px] font-bold text-purple-300 leading-none mt-0.5 opacity-90">
                            →{mergedIntoName?.replace('Table ', 'T') || mergedIntoName}
                          </span>
                        )}
                        {/* Alt+N hotkey badge */}
                        {(() => {
                          const num = parseInt(String(t.table_number).replace(/\D/g,''));
                          const label = num === 10 ? 'Alt+0' : (num >= 1 && num <= 9) ? `Alt+${num}` : null;
                          return label ? (
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded text-[7px] font-black text-amber-400 bg-amber-500/20 border border-amber-500/40 whitespace-nowrap">{label}</span>
                          ) : null;
                        })()}
                      </motion.button>
                      {/* Delete on hover */}
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTableId(t); setShowDeleteTable(true); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                        title="Delete table">
                        <X size={10} />
                      </button>
                      {/* Unmerge button — only if merged */}
                      {isMerged && (
                        <button onClick={(e) => { e.stopPropagation(); handleUnmergeTable(t.id); }}
                          className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/50 transition-all whitespace-nowrap"
                          title="Unmerge this table">
                          Unlink
                        </button>
                      )}
                    </div>
                  );
                });
              })()}

            </div>
          </div>

          {/* MAIN: Menu | Cart */}
          <div className="flex-1 flex gap-6 min-h-0">
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                  {(['All', 'Veg', 'Non-Veg', 'Starters', 'Chinese', 'Drinks'] as const).map((cat, ci) => {
                    const catKey = ci === 0 ? null : String(ci); // All=no key, Veg=1..Drinks=5
                    return (
                      <button key={cat} onClick={() => {
                        if (cat === 'Veg' || cat === 'Non-Veg') setMenuVegFilter(cat === 'Veg' ? 'veg' : 'nonveg');
                        else { setMenuVegFilter('all'); setPosSearch(cat === 'All' ? '' : cat); }
                      }}
                      className={`relative px-5 py-3 rounded-2xl text-[10px] font-black uppercase border transition-all whitespace-nowrap ${
                        (menuVegFilter === 'veg' && cat === 'Veg') || (menuVegFilter === 'nonveg' && cat === 'Non-Veg') || (posSearch === cat) || (cat === 'All' && menuVegFilter === 'all' && !posSearch)
                        ? 'bg-orange-500 border-orange-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                      }`}>
                        {cat}
                        {catKey && (
                          <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-md bg-amber-500 border border-amber-400 text-[8px] font-black text-black flex items-center justify-center shadow-lg shadow-amber-500/30">{catKey}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="relative w-64 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-orange-500" size={16} />
                  <input ref={posSearchRef} type="text" placeholder="Search dish..." value={posSearch} onChange={e => setPosSearch(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-14 py-3 text-xs outline-none focus:border-orange-500" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-amber-500/25 border border-amber-500/50 text-[8px] font-black text-amber-300">F2</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 pr-2 no-scrollbar">
                {menu
                  .filter(m => menuVegFilter === 'all' || (menuVegFilter === 'veg' ? m.is_veg : !m.is_veg))
                  .filter(m => m.name.toLowerCase().includes(posSearch.toLowerCase()) || (m.category || '').toLowerCase().includes(posSearch.toLowerCase()))
                  .map((item, idx) => {
                    const hotkey = ITEM_HOTKEYS[idx];
                    return (
                      <motion.button key={item.id} onClick={() => addToPosCart(item)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
                        className="p-2.5 rounded-2xl bg-white/5 border border-white/5 hover:border-orange-500/30 text-left flex flex-col justify-between h-24 group transition-all relative overflow-hidden">
                        {/* Hotkey badge */}
                        {hotkey && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-amber-500 border border-amber-400 text-[9px] font-black text-black flex items-center justify-center uppercase shadow-md shadow-amber-500/40 group-hover:scale-110 transition-transform">
                            {hotkey}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-[9px] font-black text-orange-500 ml-auto pr-5">₹{item.price}</span>
                        </div>
                        <div className="flex-1 flex flex-col justify-end">
                          <h4 className="font-bold text-[10px] leading-tight line-clamp-2 text-white">{item.name}</h4>
                          <p className="text-[8px] font-black uppercase text-white/20 mt-0.5">{item.category}</p>
                        </div>
                      </motion.button>
                    );
                  })
                }
              </div>
            </div>

            {/* CART */}
            <div className="w-72 bg-white/5 rounded-[40px] border border-white/10 flex flex-col overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black">Order Panel</h3>
                  <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-0.5">Esc — clear all</p>
                </div>
                <button onClick={() => setPosCart([])} className="flex items-center gap-1.5 text-[10px] font-black uppercase text-white/40 hover:text-red-400 transition-colors">
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/25 border border-amber-500/50 text-[8px] font-black text-amber-300">F1</span>
                  Clear
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 px-6 no-scrollbar">
                {posCart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-10"><ShoppingBag size={40} /><p className="text-xs font-bold uppercase mt-2">Empty Cart</p></div>
                ) : (
                  posCart.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2">
                      <div className="flex justify-between"><p className="font-bold text-[11px] truncate flex-1">{item.name}</p><span className="text-[10px] font-black text-orange-500 ml-2">₹{item.price * item.quantity}</span></div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updatePosQty(item.id, -1)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center"><Minus size={10} /></button>
                          <span className="text-xs font-black">{item.quantity}</span>
                          <button onClick={() => updatePosQty(item.id, 1)} className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center"><Plus size={10} /></button>
                        </div>
                        <button onClick={() => updatePosQty(item.id, -item.quantity)} className="text-white/10 hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-6 bg-white/[0.02] border-t border-white/10 space-y-3">
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-white/50">Subtotal</span><span className="text-xs font-bold text-white">₹{posCart.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()}</span></div>
                {settings.cgst_percent > 0 && (
                  <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-white/50">CGST ({settings.cgst_percent}%)</span><span className="text-xs font-bold text-white">₹{(posCart.reduce((s, i) => s + i.price * i.quantity, 0) * settings.cgst_percent / 100).toFixed(2)}</span></div>
                )}
                {settings.sgst_percent > 0 && (
                  <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-white/50">SGST ({settings.sgst_percent}%)</span><span className="text-xs font-bold text-white">₹{(posCart.reduce((s, i) => s + i.price * i.quantity, 0) * settings.sgst_percent / 100).toFixed(2)}</span></div>
                )}
                {settings.service_charge_percent > 0 && (
                  <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-white/50">Service ({settings.service_charge_percent}%)</span><span className="text-xs font-bold text-white">₹{(posCart.reduce((s, i) => s + i.price * i.quantity, 0) * settings.service_charge_percent / 100).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between items-center group">
                   <span className="text-[10px] font-bold text-white/50 flex items-center gap-1">Discount <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-amber-500/25 border border-amber-500/50 font-black text-amber-300">F3</span></span>
                   <div className="flex items-center border-b border-transparent group-hover:border-white/20 focus-within:border-orange-500 pb-0.5 transition-all">
                      <span className="text-xs text-white/40 mr-1">-₹</span>
                      <input id="pos-discount" type="number" value={posDiscount || ''} onChange={(e) => setPosDiscount(Number(e.target.value) || 0)} className="w-12 bg-transparent text-right text-xs font-bold text-white outline-none placeholder-white/20" placeholder="0" />
                   </div>
                </div>
                <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase text-white/80 tracking-widest">Grand Total</span>
                   <span className="text-xl font-black text-orange-500">
                      ₹{Math.max(0, (
                        posCart.reduce((s, i) => s + i.price * i.quantity, 0) *
                        (1 + (settings.cgst_percent + settings.sgst_percent + settings.service_charge_percent) / 100)
                      ) - posDiscount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </span>
                </div>
                <button disabled={posCart.length === 0 || !selectedPosTable || posLoading} onClick={handlePlacePosOrder}
                  className="w-full mt-2 py-4 rounded-2xl bg-orange-500 text-white font-black text-[10px] uppercase shadow-xl shadow-orange-500/10 disabled:opacity-30 flex items-center justify-center gap-2">
                  {posLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}
                  {selectedPosTable ? `Place Order — ${selectedPosTable.table_number}` : 'Select Table First'}
                  {!posLoading && selectedPosTable && (
                    <span className="ml-auto px-1.5 py-0.5 rounded bg-white/20 text-[8px] font-black">⇧ Enter</span>
                  )}
                </button>
                <div className="flex items-center justify-between text-[8px] font-bold text-white/20 uppercase mt-2">
                   <span>F3 — Discount</span>
                   <span>F2 — Search</span>
                   <span>Alt+N — Table</span>
                </div>
              </div>
            </div>

            {/* ── ACTIVE ORDERS PANEL (right side) ──────────────────────── */}
            {(() => {
              const tableOrders = selectedPosTable
                ? orders.filter(o =>
                    o.table_id === selectedPosTable.id &&
                    o.status !== 'paid' &&
                    o.status !== 'cancelled'
                  )
                : [];

              const statusStyle: Record<string, string> = {
                new:      'bg-blue-500/20 text-blue-300 border-blue-500/40',
                preparing:'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
                ready:    'bg-green-500/20 text-green-300 border-green-500/40',
                served:   'bg-purple-500/20 text-purple-300 border-purple-500/40',
                billing:  'bg-orange-500/20 text-orange-300 border-orange-500/40',
              };

              return (
                <div className="w-64 bg-white/5 rounded-[40px] border border-white/10 flex flex-col overflow-hidden flex-shrink-0">
                  <div className="p-5 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black">Active Orders</h3>
                      {tableOrders.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-black text-red-300">{tableOrders.length}</span>
                      )}
                    </div>
                    <p className="text-[9px] text-white/30 font-bold uppercase mt-0.5">
                      {selectedPosTable ? selectedPosTable.table_number : 'Select a table'}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
                    {!selectedPosTable ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                        <Clock size={32} /><p className="text-[10px] font-bold uppercase mt-2">No table selected</p>
                      </div>
                    ) : tableOrders.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                        <CheckCircle size={32} /><p className="text-[10px] font-bold uppercase mt-2">All clear!</p>
                      </div>
                    ) : (
                      tableOrders.map(order => (
                        <div key={order.id} className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-white/40 uppercase">#{order.id}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border uppercase ${statusStyle[order.status] || 'bg-white/10 text-white/40 border-white/20'}`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {(order.items || []).map((it: any) => (
                              <div key={it.item_id} className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-white/70 truncate flex-1">{it.item_name}</span>
                                <span className="text-[9px] font-black text-white/40 ml-2">×{it.quantity}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-white/10">
                            <span className="text-[9px] text-white/30 font-bold uppercase">Total</span>
                            <span className="text-[11px] font-black text-orange-400">₹{order.total_price?.toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {tableOrders.length > 0 && (
                    <div className="p-4 border-t border-white/10 bg-white/[0.02]">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-white/50">Running Total</span>
                        <span className="text-lg font-black text-orange-400">
                          ₹{tableOrders.reduce((s, o) => s + (o.total_price || 0), 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </main>

      {/* Add Table Modal */}
      {showAddTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1a1a24] rounded-3xl border border-white/10 p-6 w-full max-w-sm">
            <h2 className="text-xl font-black mb-4">Add New Table</h2>
            <input autoFocus type="text" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} placeholder="e.g. Table 11" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 mb-6" />
            <div className="flex gap-3">
              <button onClick={() => setShowAddTable(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-white/70 font-bold text-xs uppercase hover:bg-white/10">Cancel</button>
              <button onClick={handleAddTable} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold text-xs uppercase hover:bg-orange-600 shadow-lg shadow-orange-500/20">Add Table</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Merge Table Modal */}
      {showMergeTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1a1a24] rounded-3xl border border-white/10 p-6 w-full max-w-sm">
            <h2 className="text-xl font-black mb-1">Merge Tables</h2>
            <p className="text-xs text-white/40 mb-6">Move all orders from the source table to the target table.</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black uppercase text-white/50 ml-1 mb-1 block">Source Table (Move From)</label>
                <select value={mergeSource} onChange={e => setMergeSource(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500">
                  <option value="">Select source table...</option>
                  {tables.map(t => <option key={t.id} value={t.id} className="bg-[#1a1a24] text-white">{t.table_number}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-white/50 ml-1 mb-1 block">Target Table (Move To)</label>
                <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500">
                  <option value="">Select target table...</option>
                  {tables.map(t => <option key={t.id} value={t.id} className="bg-[#1a1a24] text-white">{t.table_number}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowMergeTable(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-white/70 font-bold text-xs uppercase hover:bg-white/10">Cancel</button>
              <button onClick={handleMergeTable} disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget || tableLoading} className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold text-xs uppercase disabled:opacity-50 hover:bg-blue-600 shadow-lg shadow-blue-500/20">
                {tableLoading ? 'Merging...' : 'Merge Orders'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Table Modal */}
      {showDeleteTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1a1a24] rounded-3xl border border-white/10 p-6 w-full max-w-sm">
            <h2 className="text-xl font-black mb-1">Delete Table</h2>
            <p className="text-xs text-white/40 mb-6">Select a table to permanently delete it. Tables with active orders cannot be deleted.</p>

            {!deleteTableId ? (
              <div className="grid grid-cols-3 gap-2 mb-6">
                {tables.map(t => {
                  const isOccupied = groupOrdersByTable().some((g: any) => g.table_number === t.table_number);
                  return (
                    <button key={t.id} onClick={() => setDeleteTableId(t)}
                      className={`py-3 rounded-xl text-xs font-black border transition-all ${isOccupied ? 'border-red-500/30 text-red-400 bg-red-500/5 cursor-not-allowed opacity-50' : 'border-white/10 text-white/70 bg-white/5 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10'}`}
                      disabled={isOccupied} title={isOccupied ? 'Has active orders' : ''}>
                      {t.table_number}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mb-6">
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                  <p className="text-red-400 font-black text-lg">{deleteTableId.table_number}</p>
                  <p className="text-xs text-white/40 mt-1">This action cannot be undone</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteTable(false); setDeleteTableId(null); }}
                className="flex-1 py-3 rounded-xl bg-white/5 text-white/70 font-bold text-xs uppercase hover:bg-white/10">Cancel</button>
              {deleteTableId && (
                <button onClick={handleDeleteTable} disabled={tableLoading}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-xs uppercase disabled:opacity-50 hover:bg-red-600 shadow-lg shadow-red-500/20">
                  {tableLoading ? 'Deleting...' : `Delete ${deleteTableId.table_number}`}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

