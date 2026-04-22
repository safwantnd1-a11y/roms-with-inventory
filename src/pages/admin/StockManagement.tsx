import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Package, Search, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Edit3, Save, X, Plus, Minus, Layers, Check, Calculator, ArrowUpRight, ArrowDownRight, FileText, Printer, User, Calendar, Tag, Database, ShoppingBag, Trash2, ChevronRight, History, Download, Filter, Box, BarChart3, TrendingDown, TrendingUp, DollarSign, Bell, Upload, FileSpreadsheet } from 'lucide-react';

export default function StockManagement() {
  const [items, setItems] = useState<any[]>([]); // Store Inventory
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'manage' | 'history' | 'analytics'>('manage');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Transaction State
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [txType, setTxType] = useState<'in' | 'out'>('in');
  const [txQty, setTxQty] = useState<string>('');
  const [txPrice, setTxPrice] = useState<string>('');
  const [txUnit, setTxUnit] = useState<string>('pcs');
  const [txMinStock, setTxMinStock] = useState<string>('5'); 
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Basket State
  const [basket, setBasket] = useState<any[]>([]);
  
  // History State
  const [history, setHistory] = useState<any[]>([]);
  
  // New Item State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'Raw Material', unit: 'pcs', min_stock: '5', price: '0', stock: '0' });

  // Drill-down Modal State
  const [drillDown, setDrillDown] = useState<{ title: string; items: any[]; type: 'material' | 'log' | 'value' } | null>(null);

  // Receipt State
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/inventory');
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const r = await axios.get('/api/admin/stock-history');
      const data = Array.isArray(r.data) ? r.data.filter((h: any) => h.item_type === 'inventory') : [];
      setHistory(data);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      const item = items.find(i => i.id === Number(selectedItemId));
      if (item) {
        setTxPrice(String(item.price || '0'));
        setTxUnit(item.unit || 'pcs');
        setTxMinStock(String(item.min_stock || '5'));
      }
    }
  }, [selectedItemId, items, txType]);

  const addToBasket = () => {
    if (!selectedItemId || !txQty || Number(txQty) <= 0) return;
    const item = items.find(i => i.id === Number(selectedItemId));
    if (!item) return;
    setBasket([...basket, { 
      item_id: item.id, 
      name: item.name, 
      quantity: Number(txQty), 
      price: Number(txPrice), 
      unit: txUnit,
      min_stock: txType === 'in' ? Number(txMinStock) : undefined
    }]);
    setSelectedItemId(''); setTxQty('');
  };

  const handleProcessAll = async () => {
    if (basket.length === 0) return;
    setIsProcessing(true);
    try {
      const response = await axios.post('/api/admin/stock-transaction', { items: basket, type: txType, target: 'inventory' });
      setLastReceipt(response.data); setShowReceipt(true);
      setBasket([]); fetchData(); fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/inventory', newItem);
      setShowAddModal(false);
      setNewItem({ name: '', category: 'Raw Material', unit: 'pcs', min_stock: '5', price: '0', stock: '0' });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add item');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          alert('Excel file is empty');
          return;
        }

        // Validate first item
        const first: any = data[0];
        if (!first.name) {
          alert('Excel must have at least a "name" column. Other columns: category, unit, min_stock, price, stock');
          return;
        }

        const confirmImport = window.confirm(`Import ${data.length} materials from Excel?`);
        if (!confirmImport) return;

        setLoading(true);
        await axios.post('/api/inventory/bulk', { items: data });
        alert(`Successfully imported ${data.length} materials.`);
        fetchData();
      } catch (err) {
        alert('Failed to parse Excel file. Please ensure it follows the correct format.');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      { name: 'Basmati Rice', category: 'Raw Material', unit: 'kg', min_stock: 20, price: 120, stock: 100 },
      { name: 'Refined Oil', category: 'Raw Material', unit: 'liter', min_stock: 10, price: 180, stock: 50 },
      { name: 'Salt Packet', category: 'Raw Material', unit: 'pcs', min_stock: 5, price: 20, stock: 20 }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InventoryTemplate');
    XLSX.writeFile(wb, 'ROMS_Inventory_Template.xlsx');
  };

  const exportToExcel = () => {
    const data = history.map(h => ({
      'Date': new Date(h.created_at).toLocaleString(),
      'Material': h.item_name,
      'Category': h.category,
      'Type': h.type.toUpperCase(),
      'Quantity': h.quantity,
      'Unit': h.unit,
      'Price (₹)': h.price,
      'Total Value (₹)': h.quantity * h.price,
      'Manager': h.manager_name
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Store Stock Report');
    XLSX.writeFile(wb, `Store_Full_Audit_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Analytics Helpers
  const lowStockItems = items.filter(i => i.stock <= (i.min_stock || 5));
  const totalStoreValue = items.reduce((acc, i) => acc + (i.stock * i.price), 0);
  const totalEntries = history.filter(h => h.type === 'in').length;
  const totalExits = history.filter(h => h.type === 'out').length;

  const filteredItems = items.filter(i => (i.name || '').toLowerCase().includes(search.toLowerCase()));
  const filteredHistory = history.filter(h => (h.item_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div className="space-y-6 max-w-7xl mx-auto pb-20" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls, .csv" className="hidden" />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-black text-white flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Box className="text-white" size={24} />
            </div>
            Store Inventory
          </h2>
          <p className="mt-2 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Bulk management & supply chain audit
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
             {[
               { id: 'manage', label: 'Manage Store', icon: Box },
               { id: 'history', label: 'History Logs', icon: History },
               { id: 'analytics', label: 'Stock Analytics', icon: BarChart3 }
             ].map(t => (
               <button 
                 key={t.id}
                 onClick={() => setActiveTab(t.id as any)} 
                 className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === t.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-white/40 hover:text-white'}`}
               >
                 <t.icon size={14} /> {t.label}
               </button>
             ))}
          </div>
          <button onClick={() => { fetchData(); fetchHistory(); }} className="p-3 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {activeTab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel: Controls */}
          <div className="lg:col-span-5 space-y-6">
            <motion.div className="glass rounded-[32px] p-8 border-white/5 relative overflow-hidden" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Plus className="text-orange-500" size={20} /> Stock Transaction</h3>
                <div className="flex gap-2">
                  <button onClick={downloadSampleTemplate} className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-white border border-white/10 transition-all" title="Download Excel Format">
                    <FileSpreadsheet size={16} />
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-white border border-white/10 transition-all" title="Bulk Import Excel">
                    <Upload size={16} />
                  </button>
                  <button onClick={() => setShowAddModal(true)} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500 hover:text-white transition-all">New Material +</button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
                  <button onClick={() => { setTxType('in'); setBasket([]); }} className={`flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${txType === 'in' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/30'}`}>Stock In</button>
                  <button onClick={() => { setTxType('out'); setBasket([]); }} className={`flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${txType === 'out' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-white/30'}`}>Stock Out</button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Select Material</label>
                  <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm font-bold text-white outline-none cursor-pointer appearance-none">
                    <option value="" className="bg-[#0a0a0f]">Choose a material...</option>
                    {items.map(item => <option key={item.id} value={item.id} className="bg-[#0a0a0f]">{item.name} ({item.stock} {item.unit})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Quantity</label>
                    <input type="number" value={txQty} onChange={e => setTxQty(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm font-bold text-white outline-none" placeholder="0.00" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Unit Price (₹)</label>
                    <input type="number" value={txPrice} onChange={e => setTxPrice(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm font-bold text-white outline-none" /></div>
                </div>

                {txType === 'in' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2 ml-1">
                      <Bell size={12}/> Alert Qty Threshold
                    </label>
                    <input type="number" value={txMinStock} onChange={e => setTxMinStock(e.target.value)} className="w-full bg-amber-500/5 border border-amber-500/20 rounded-2xl py-4 px-5 text-sm font-bold text-white outline-none focus:border-amber-500/50" placeholder="Minimum stock level" />
                  </motion.div>
                )}

                <button onClick={addToBasket} disabled={!selectedItemId || !txQty} className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-3 hover:bg-white/10 transition-all disabled:opacity-30"><Plus size={18} /> Add to Transaction</button>
              </div>
            </motion.div>

            <AnimatePresence>
              {basket.length > 0 && (
                <motion.div className="glass rounded-[32px] p-6 border-white/5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <div className="flex items-center justify-between mb-4"><h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Queue ({basket.length})</h4><button onClick={() => setBasket([])} className="text-[10px] font-bold text-red-400">Clear All</button></div>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 scrollbar-hide">
                    {basket.map((b, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                        <div>
                          <p className="text-sm font-bold text-white">{b.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] font-bold text-white/30 uppercase">{b.quantity} {b.unit} × ₹{b.price}</p>
                            {b.min_stock && <p className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1 ml-2"><Bell size={8}/> Alert: {b.min_stock}</p>}
                          </div>
                        </div>
                        <button onClick={() => setBasket(basket.filter((_, i) => i !== idx))} className="text-white/20 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleProcessAll} disabled={isProcessing} className={`w-full mt-6 py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-xl transition-all ${txType === 'in' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/20' : 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/20'} text-white`}>
                    {isProcessing ? <RefreshCw className="animate-spin" size={20}/> : <FileText size={20}/>} Process & Generate Receipt
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Panel: Material Registry */}
          <div className="lg:col-span-7">
            <div className="glass rounded-[32px] border-white/5 overflow-hidden flex flex-col h-[750px]">
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div><h3 className="text-xl font-bold text-white">Material Registry</h3><p className="text-xs text-white/20 font-medium mt-1">Live store supply levels</p></div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input type="text" placeholder="Filter materials..." value={search} onChange={e => setSearch(e.target.value)} className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm font-bold text-white outline-none min-w-[200px]" />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
                {filteredItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black text-xs text-white/40`}>{item.unit}</div>
                      <div>
                        <p className="font-bold text-white text-base leading-none">{item.name}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-2">{item.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${item.stock <= (item.min_stock || 10) ? 'text-amber-500' : 'text-white'}`}>{item.stock}</p>
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Remaining (Alert: {item.min_stock})</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <motion.div className="glass rounded-[32px] border-white/5 overflow-hidden flex flex-col min-h-[600px]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="p-8 border-b border-white/5 flex items-center justify-between flex-wrap gap-4 bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500"><History size={24}/></div>
              <div><h3 className="text-xl font-bold text-white">Store Audit Logs</h3><p className="text-xs text-white/20 font-medium mt-1">Universal movement history</p></div>
            </div>
            <div className="flex items-center gap-3">
              <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl py-3 px-6 text-sm font-bold text-white outline-none min-w-[250px]" />
              <button onClick={exportToExcel} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20"><Download size={16} /> Export Excel</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.2em] text-white/20"><th className="px-8 py-4">Timestamp</th><th className="px-8 py-4">Material</th><th className="px-8 py-4">Action</th><th className="px-8 py-4 text-center">Qty</th><th className="px-8 py-4 text-center">Rate</th><th className="px-8 py-4">Manager</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {filteredHistory.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-5 text-sm font-bold text-white">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-8 py-5"><p className="text-sm font-bold text-white">{log.item_name}</p><p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">{log.category}</p></td>
                    <td className="px-8 py-5"><span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${log.type === 'in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{log.type === 'in' ? 'Entry' : 'Exit'}</span></td>
                    <td className="px-8 py-5 text-center text-sm font-black text-white">{log.quantity} {log.unit}</td>
                    <td className="px-8 py-5 text-center text-sm font-black text-white">₹{log.price}</td>
                    <td className="px-8 py-5 text-xs font-bold text-white/60">{log.manager_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'analytics' && (
        <motion.div className="space-y-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Key Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Materials', value: items.length, icon: Box, color: 'blue', onClick: () => setDrillDown({ title: 'All Store Materials', items: items, type: 'material' }) },
              { label: 'Store Value', value: `₹${totalStoreValue.toLocaleString()}`, icon: DollarSign, color: 'green', onClick: () => setDrillDown({ title: 'Material Valuation', items: items, type: 'value' }) },
              { label: 'Critical Alert', value: lowStockItems.length, icon: AlertTriangle, color: 'orange', onClick: () => setDrillDown({ title: 'Low Stock List', items: lowStockItems, type: 'material' }) },
              { label: 'Total Operations', value: history.length, icon: RefreshCw, color: 'violet', onClick: () => setDrillDown({ title: 'Recent Operations', items: history.slice(0, 50), type: 'log' }) },
            ].map((stat, i) => (
              <motion.div 
                key={i} 
                onClick={stat.onClick}
                whileHover={{ scale: 1.02, y: -5 }}
                className="glass rounded-[32px] p-8 border-white/5 relative overflow-hidden group cursor-pointer hover:bg-white/[0.05] transition-all"
              >
                <div className={`w-14 h-14 rounded-2xl bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-500 mb-6 group-hover:scale-110 transition-transform`}>
                  <stat.icon size={28} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{stat.label}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-3xl font-black text-white tracking-tight">{stat.value}</p>
                  <ChevronRight size={16} className="text-white/10 group-hover:text-white/40 transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Low Stock Watchlist */}
            <div className="lg:col-span-8">
              <div className="glass rounded-[32px] border-white/5 overflow-hidden">
                <div className="p-8 border-b border-white/5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500"><TrendingDown size={24}/></div>
                  <div><h3 className="text-xl font-bold text-white">Critical Watchlist</h3><p className="text-xs text-white/20 font-medium mt-1">Materials nearing depletion</p></div>
                </div>
                <div className="p-6 space-y-3">
                  {lowStockItems.length > 0 ? lowStockItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/5 border-l-4 border-l-orange-500">
                      <div className="flex items-center gap-5">
                        <div><p className="font-bold text-white text-lg">{item.name}</p><p className="text-[10px] font-black uppercase text-white/20 mt-1">{item.category}</p></div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-orange-500">{item.stock} {item.unit}</p>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Below {item.min_stock} threshold</p>
                      </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center"><CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={48}/><p className="text-white/40 font-bold">All stock levels are healthy</p></div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass rounded-[32px] p-8 border-white/5 space-y-8">
                <h4 className="text-sm font-black uppercase tracking-widest text-white/40">Movement Ratio</h4>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-emerald-400 flex items-center gap-1"><TrendingUp size={12}/> Entry</span>
                      <span className="text-white">{totalEntries}</span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(totalEntries/(totalEntries+totalExits || 1))*100}%` }} className="h-full bg-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-red-400 flex items-center gap-1"><TrendingDown size={12}/> Exit</span>
                      <span className="text-white">{totalExits}</span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(totalExits/(totalEntries+totalExits || 1))*100}%` }} className="h-full bg-red-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Drill-down Modal */}
      <AnimatePresence>
        {drillDown && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 backdrop-blur-2xl bg-black/80">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="glass w-full max-w-2xl rounded-[48px] overflow-hidden border-white/10 flex flex-col max-h-[85vh]">
              <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div><h4 className="text-2xl font-black text-white">{drillDown.title}</h4><p className="text-xs text-white/20 font-bold uppercase tracking-widest mt-1">Detailed View</p></div>
                <button onClick={() => setDrillDown(null)} className="p-3 rounded-2xl bg-white/5 text-white/30 hover:text-white transition-all"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                <div className="space-y-3">
                  {drillDown.type === 'log' ? (
                    drillDown.items.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5">
                        <div><p className="text-sm font-bold text-white">{h.item_name}</p><p className="text-[10px] font-black text-white/20 uppercase mt-1">{new Date(h.created_at).toLocaleString()}</p></div>
                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${h.type === 'in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{h.type}</span>
                      </div>
                    ))
                  ) : (
                    drillDown.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/20 text-[10px] font-black uppercase">{item.unit}</div>
                          <div><p className="text-sm font-bold text-white">{item.name}</p><p className="text-[10px] font-black text-white/20 uppercase mt-1">{item.category}</p></div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black text-white">{drillDown.type === 'value' ? `₹${(item.stock * item.price).toLocaleString()}` : `${item.stock} ${item.unit}`}</p>
                          <p className="text-[10px] font-black text-white/20 uppercase mt-1">{drillDown.type === 'value' ? 'Current Value' : 'In Store'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.01] text-center">
                <button onClick={() => setDrillDown(null)} className="px-10 py-4 bg-white/5 text-white/40 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Close Viewer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Material Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-xl bg-black/80">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="glass w-full max-w-md rounded-[40px] p-10 border-white/10 relative">
              <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-white/20 hover:text-white"><X size={24}/></button>
              <h4 className="text-2xl font-black text-white mb-8">New Store Material</h4>
              <form onSubmit={handleAddInventory} className="space-y-6">
                <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Material Name</label>
                  <input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-orange-500/50" placeholder="e.g. Cooking Oil" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Unit</label>
                    <select value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white outline-none">
                      <option value="pcs" className="bg-[#0a0a0f]">pcs</option>
                      <option value="kg" className="bg-[#0a0a0f]">kg</option>
                      <option value="box" className="bg-[#0a0a0f]">box</option>
                      <option value="liter" className="bg-[#0a0a0f]">liter</option>
                      <option value="ml" className="bg-[#0a0a0f]">ml</option>
                    </select>
                  </div>
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Unit Price (₹)</label>
                    <input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none" placeholder="0.00" /></div>
                </div>
                <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Opening Qty</label>
                  <input type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none" placeholder="0.00" /></div>
                <button type="submit" className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 hover:scale-105 transition-all mt-4">Add to Registry</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern Receipt Modal */}
      <AnimatePresence>
        {showReceipt && lastReceipt && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-md bg-black/60">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white text-gray-900 w-full max-w-md rounded-[40px] overflow-hidden flex flex-col shadow-2xl">
              <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide" id="stock-receipt">
                <div className="text-center border-b-2 border-dashed border-gray-200 pb-8"><div className="w-20 h-20 bg-gray-900 rounded-[24px] flex items-center justify-center mx-auto mb-5"><Box className="text-white" size={36}/></div><h4 className="text-2xl font-black uppercase tracking-tighter">Store Voucher</h4><p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mt-2">ROMS Inventory System</p></div>
                <div className="grid grid-cols-2 gap-6 text-[10px] font-black uppercase tracking-widest"><div><p className="text-gray-400">Manager</p><p className="text-gray-900 text-xs">{lastReceipt.manager_name}</p></div><div className="text-right"><p className="text-gray-400">Voucher ID</p><p className="text-gray-900 text-xs">#{lastReceipt.id}</p></div></div>
                <div className="space-y-1 border border-gray-100 rounded-[24px] overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3 grid grid-cols-12 text-[9px] font-black uppercase text-gray-400"><div className="col-span-6">Material</div><div className="col-span-3 text-center">Qty</div><div className="col-span-3 text-right">Price</div></div>
                  <div className="divide-y divide-gray-50">{lastReceipt.items.map((item: any, i: number) => (<div key={i} className="px-5 py-4 grid grid-cols-12 items-center"><div className="col-span-6 text-xs font-black">{item.item_name}</div><div className="col-span-3 text-center text-xs font-black">{item.quantity}</div><div className="col-span-3 text-right text-xs font-black">₹{item.price}</div></div>))}</div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 flex gap-4 border-t border-gray-100">
                <button onClick={() => setShowReceipt(false)} className="flex-1 py-5 bg-white border border-gray-200 text-gray-700 rounded-[20px] font-black text-[10px] uppercase tracking-widest">Dismiss</button>
                <button onClick={() => window.print()} className="flex-1 py-5 bg-gray-900 text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3"><Printer size={18} /> Print Record</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
