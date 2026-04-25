import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSocket } from '../../hooks/useSocket';
import {
  LayoutDashboard, Utensils, Users, ShoppingBag, CheckCircle2,
  LogOut, Plus, Trash2, Clock, Search, ChefHat, X, Wifi, Copy, Check,
  ToggleLeft, ToggleRight, Eye, EyeOff, MapPin, Settings,
  RotateCcw, FileSpreadsheet, FileText, AlertTriangle, BarChart3, KeyRound, Printer,
  Download, CalendarRange, Trash, Package, Upload, TrendingUp, Filter, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Analytics from './Analytics';
import StockManagement from './StockManagement';

type Tab = 'stats' | 'menu' | 'staff' | 'billing' | 'analytics' | 'stock' | 'settings' | 'about';

/* ---------- Animated Stat Card ---------- */
function StatCard({ icon, label, value, color, delay = 0, onClick, onIconClick, iconAlt }: any) {
  const colors: Record<string, { bg: string; border: string; iconBg: string }> = {
    orange: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.15)', iconBg: 'rgba(249,115,22,0.15)' },
    blue: { bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.15)', iconBg: 'rgba(96,165,250,0.15)' },
    green: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.15)', iconBg: 'rgba(34,197,94,0.15)' },
    violet: { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)', iconBg: 'rgba(139,92,246,0.15)' },
    cyan: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.15)', iconBg: 'rgba(6,182,212,0.15)' },
  };
  const c = colors[color] || colors.orange;
  return (
    <motion.div
      className="rounded-3xl p-6 cursor-pointer"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
      initial={{ opacity: 0, y: 30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 22 }}
      whileHover={{ scale: 1.04, border: `1px solid ${c.border.replace('0.15', '0.4')}`, boxShadow: `0 12px 40px ${c.bg}` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <motion.div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: c.iconBg }}
          whileHover={{ rotate: 8, scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 300 }}>
          {icon}
        </motion.div>
        {iconAlt && (
          <motion.button onClick={(e) => { e.stopPropagation(); onIconClick?.(); }}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)' }}
            whileHover={{ scale: 1.1, background: 'rgba(255,255,255,0.08)' }}
            whileTap={{ scale: 0.9 }}>
            {iconAlt}
          </motion.button>
        )}
      </div>
      <motion.p className="text-3xl font-black text-white mb-1"
        key={value}
        initial={{ scale: 1.3, color: c.iconBg.replace('rgba(', 'rgb(').replace(', 0.15)', ')') }}
        animate={{ scale: 1, color: '#ffffff' }}
        transition={{ type: 'spring', stiffness: 400 }}>
        {value}
      </motion.p>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const { logout, user } = useAuth();
  const { socket } = useSocket();
  const [stats, setStats] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [newStaffNames, setNewStaffNames] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'kitchen' | 'stock_manager'>('kitchen');
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const setTab = (tab: Tab) => { setActiveTab(tab); setSelectedStat(null); };
  const [showRevenue, setShowRevenue] = useState(true);
  const [menuSearch, setMenuSearch] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ name: '', category: 'Main', sub_category: '', type: 'veg', description: '', preparation_time: '0', is_veg: true, price: '', half_price: '', image_url: '' });
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const [changePwForm, setChangePwForm] = useState({ current: '', next: '', confirm: '' });
  const [changePwError, setChangePwError] = useState('');
  const [changePwSuccess, setChangePwSuccess] = useState(false);
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [showCurPw, setShowCurPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [editDiscount, setEditDiscount] = useState({ type: 'flat' as 'flat'|'percent', value: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<number|null>(null);
  const [previewGroup, setPreviewGroup] = useState<any | null>(null);
  const [paidBill, setPaidBill] = useState<any | null>(null);
  const [billingFilter, setBillingFilter] = useState({ from: '', to: '' });
  const [billingResetting, setBillingResetting] = useState(false);
  const [billingDownloading, setBillingDownloading] = useState(false);
  const [resetConfirmBilling, setResetConfirmBilling] = useState(false);
  const [paidBillsHistory, setPaidBillsHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [menuVegFilter, setMenuVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [settings, setSettings] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const filteredMenu = useMemo(() => {
    return menu.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                            item.category.toLowerCase().includes(menuSearch.toLowerCase());
      const matchesVeg = menuVegFilter === 'all' || 
                         (menuVegFilter === 'veg' && item.is_veg) || 
                         (menuVegFilter === 'nonveg' && !item.is_veg);
      return matchesSearch && matchesVeg;
    });
  }, [menu, menuSearch, menuVegFilter]);

  useEffect(() => {
    fetchStats(); fetchMenu(); fetchOrders(); fetchPaidBillsHistory(); fetchSettings();
    if (socket) {
      socket.on('stats-update', fetchStats);
      socket.on('menu-updated', fetchMenu);
      socket.on('staff-status-updated', fetchStaff);
      socket.on('new-order', fetchOrders);
      socket.on('order-status-updated', fetchOrders);
    }
    return () => {
      if (socket) {
        socket.off('stats-update', fetchStats);
        socket.off('menu-updated', fetchMenu);
        socket.off('staff-status-updated', fetchStaff);
        socket.off('new-order', fetchOrders);
        socket.off('order-status-updated', fetchOrders);
      }
    };
  }, [socket]);

  useEffect(() => { if (activeTab === 'staff') fetchStaff(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'billing') fetchPaidBillsHistory(); }, [activeTab]);

  const fetchStats = async () => {
    try { const r = await axios.get('/api/admin/stats'); setStats(r.data); } catch (e) { console.error('Stats fetch failed', e); }
  };
  const fetchMenu = async () => {
    try { const r = await axios.get('/api/menu'); setMenu(Array.isArray(r.data) ? r.data : []); } catch (e) { console.error('Menu fetch failed', e); }
  };
  const fetchOrders = async () => {
    try { const r = await axios.get('/api/orders'); setOrders(Array.isArray(r.data) ? r.data : []); } catch (e) { console.error('Orders fetch failed', e); }
  };
  const fetchStaff = async () => {
    try {
      const [rStaff, rTables] = await Promise.all([
        axios.get('/api/admin/staff'),
        axios.get('/api/tables'),
      ]);
      setStaff(Array.isArray(rStaff.data) ? rStaff.data : []);
      setTables(Array.isArray(rTables.data) ? rTables.data : []);
    } catch (e: any) {
      console.error('Staff data fetch failed:', e?.response?.status, e?.message);
    }
  };

  const fetchPaidBillsHistory = async () => {
    setHistoryLoading(true);
    try {
      const { from, to } = billingFilter;
      const r = await axios.get(`/api/admin/bills-history?from=${from}&to=${to}`);
      setPaidBillsHistory(Array.isArray(r.data) ? r.data : []);
    } catch (e) { console.error('History fetch failed', e); }
    finally { setHistoryLoading(false); }
  };

  const fetchSettings = async () => {
    try { 
      const r = await axios.get('/api/settings'); 
      setSettings(r.data); 
    } catch (e) { console.error('Settings fetch failed', e); }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await axios.put('/api/settings', settings);
      alert('Settings updated successfully');
    } catch (e) { alert('Update failed'); }
    finally { setSavingSettings(false); }
  };

  const resetOrders = async () => {
    setResetting(true);
    try {
      await axios.post('/api/admin/reset-orders');
      fetchOrders();
      fetchStats();
      setResetConfirm(false);
    } catch (e) { alert('Reset failed'); }
    finally { setResetting(false); }
  };

  const handleGenerateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = newStaffNames.split(/\r?\n/).map(n => n.trim()).filter(Boolean);
    if (!names.length) return;
    if (!newStaffPassword) { alert('Please set a password'); return; }
    const res = await axios.post('/api/admin/staff', {
      staff: names.map(name => ({ name, role: newStaffRole, password: newStaffPassword })),
    });
    const creds = res.data;
    alert(`Created ${creds.length} ${newStaffRole.replace('_', ' ')} account(s)!\n\nCredentials:\n${creds.map((c: any) => `${c.email} : ${newStaffPassword}`).join('\n')}`);
    setNewStaffNames(''); setNewStaffPassword(''); setNewStaffRole('kitchen');
    fetchStaff();
  };

  const handleRemoveStaff = async (id: number) => {
    if (!window.confirm('Remove this staff member?')) return;
    try {
      await axios.delete(`/api/admin/staff/${id}`);
      fetchStaff();
    } catch (e) { alert('Failed to remove staff'); }
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    await axios.post('/api/menu', {
      ...newItem,
      price: parseFloat(newItem.price) || 0,
      half_price: parseFloat(newItem.half_price) || 0,
      preparation_time: parseInt(newItem.preparation_time, 10),
      stock: 999,
    });
    setNewItem({ name: '', category: 'Main', sub_category: '', type: 'veg', description: '', preparation_time: '0', is_veg: true, price: '', half_price: '', image_url: '' });
    fetchMenu();
  };

  const handleDeleteMenuItem = async (id: number) => {
    if (!window.confirm('Delete this item?')) return;
    setDeletingId(id);
    try {
      await axios.delete(`/api/menu/${id}`);
      fetchMenu();
    } catch (e: any) { 
      alert(e.response?.data?.error || 'Delete failed'); 
    }
    finally { setDeletingId(null); }
  };

  const handleToggleStock = async (item: any) => {
    try {
      const newOutOfStock = item.out_of_stock ? 0 : 1;
      await axios.patch(`/api/menu/${item.id}`, {
        stock: newOutOfStock === 0 ? 999 : 0,
        out_of_stock: newOutOfStock,
      });
      fetchMenu();
    } catch (e) { alert('Update failed'); }
  };

  const handleMenuBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        if (data.length === 0) { alert('File is empty'); return; }
        if (!window.confirm(`Import ${data.length} menu items?`)) return;
        await axios.post('/api/menu/bulk', { items: data });
        alert(`Successfully imported ${data.length} items.`);
        fetchMenu();
      } catch (err) { alert('Failed to import menu. Please check the file format.'); }
      finally { if (e.target) e.target.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  const downloadMenuTemplate = () => {
    const sampleData = [
      { name: 'Butter Chicken', category: 'Main Course', price: 350, half_price: 190, description: 'Creamy tomato gravy chicken', preparation_time: 20, stock: 50, type: 'non-veg', unit: 'plate' },
      { name: 'Paneer Tikka', category: 'Starter', price: 280, half_price: 150, description: 'Grilled cottage cheese', preparation_time: 15, stock: 30, type: 'veg', unit: 'pcs' },
      { name: 'Cold Coffee', category: 'Drinks', price: 120, half_price: 0, description: 'Iced blended coffee', preparation_time: 5, stock: 100, type: 'veg', unit: 'glass' }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MenuTemplate');
    XLSX.writeFile(wb, 'ROMS_Menu_Template.xlsx');
  };

  const handleMarkPaid = async (group: any) => {
    setPayingId(group.orders[0].id);
    try {
      const res = await axios.post('/api/admin/mark-paid', {
        order_ids: group.orders.map((o: any) => o.id),
        table_number: group.table_number,
        staff_name: group.staff_name,
      });
      setPaidBill(res.data);
      fetchOrders(); fetchStats();
    } catch (e) { alert('Payment failed'); }
    finally { setPayingId(null); }
  };

  const handleApplyDiscount = async () => {
    if (!editingGroup || !editDiscount.value) return;
    setEditSaving(true);
    try {
      await axios.put('/api/admin/orders/discount', {
        order_ids: editingGroup.orders.map((o: any) => o.id),
        discount_type: editDiscount.type,
        discount_value: editDiscount.value,
      });
      setEditingGroup(null);
      setEditDiscount({ type: 'flat', value: '' });
      fetchOrders();
    } catch (e) { alert('Discount failed'); }
    finally { setEditSaving(false); }
  };

  const handleRemoveOrderItem = async (itemId: number) => {
    if (!window.confirm('Remove this item from order?')) return;
    setRemovingItemId(itemId);
    try {
      await axios.delete(`/api/admin/order-items/${itemId}`);
      fetchOrders();
    } catch (e) { alert('Removal failed'); }
    finally { setRemovingItemId(null); }
  };

  const copyEmail = (email: string, id: number) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };


  // ── Group active (unpaid) orders by table for the Billing tab ─────────────
  const groupOrdersByTable = () => {
    const groups: Record<string, any> = {};
    orders
      .filter(o => o.status !== 'cancelled' && o.status !== 'paid')
      .forEach((o: any) => {
        const key = String(o.table_id);
        if (!groups[key]) {
          groups[key] = {
            table_number: o.table_number,
            table_id: o.table_id,
            staff_name: o.staff_name,
            orders: [],
            total: 0,
          };
        }
        groups[key].orders.push(o);
        groups[key].total += o.total_price || 0;
      });
    return Object.values(groups);
  };

  const navItems = [
    { key: 'stats',     label: 'Overview',   icon: <LayoutDashboard size={18} /> },
    { key: 'billing',   label: 'Billing', icon: <Printer size={18} /> },
    { key: 'menu',      label: 'Menu Master', icon: <Utensils size={18} /> },
    { key: 'staff',     label: 'Staff Management', icon: <Users size={18} /> },
    { key: 'analytics', label: 'Business Insights', icon: <TrendingUp size={18} /> },
    { key: 'stock',     label: 'Stock Management', icon: <Package size={18} /> },
    { key: 'settings',  label: 'Settings', icon: <Settings size={18} /> },
    { key: 'about',     label: 'About Developer', icon: <Info size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-[#07070c] text-white selection:bg-orange-500/30">
      {/* ── Background Effects ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 blur-[120px] rounded-full" />
      </div>

      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 bottom-0 w-72 bg-[#07070c] border-r border-white/5 z-50 p-6 hidden lg:block">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ChefHat size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">ROMS</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mt-1">Admin Panel</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map(item => (
            <motion.button
              key={item.key}
              onClick={() => setTab(item.key as Tab)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all group ${
                activeTab === item.key 
                ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-lg shadow-orange-500/5' 
                : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className={`transition-colors ${activeTab === item.key ? 'text-orange-500' : 'text-white/20 group-hover:text-white/60'}`}>
                {item.icon}
              </span>
              {item.label}
              {activeTab === item.key && (
                <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />
              )}
            </motion.button>
          ))}
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-black text-xs">
                {user?.name?.[0]}
              </div>
              <div>
                <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-white/30 font-medium">Administrator</p>
              </div>
            </div>
            <button 
              onClick={() => setShowChangePw(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-all"
            >
              <KeyRound size={12} /> Account Settings
            </button>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-sm hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="lg:ml-72 min-h-screen p-6 lg:p-10 relative z-10">
        {/* Header (Desktop) */}
        <header className="hidden lg:flex items-center justify-between mb-10">
          <div>
            <h2 className="text-4xl font-black text-white capitalize">{activeTab} Dashboard</h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Managing your restaurant operations from one central hub.
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">System Live</span>
             </div>
             <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                <Settings size={20} />
             </div>
          </div>
        </header>

        {/* Mobile Nav Toggle */}
        <div className="lg:hidden flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                 <ChefHat size={18} className="text-white" />
              </div>
              <h1 className="text-lg font-black tracking-tight leading-none">ROMS</h1>
           </div>
           <button onClick={logout} className="p-2 bg-red-500/10 rounded-lg text-red-500"><LogOut size={20} /></button>
        </div>
        <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-6">
           {navItems.map(item => (
              <button 
                key={item.key} 
                onClick={() => setTab(item.key as Tab)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === item.key ? 'bg-orange-500 text-white shadow-lg' : 'bg-white/5 text-white/40'}`}
              >
                 {item.label}
              </button>
           ))}
        </div>

        <AnimatePresence mode="wait">
          {/* OVERVIEW TAB */}
          {activeTab === 'stats' && (
            <motion.div key="stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
                <StatCard color="orange" label="Revenue" value={`₹${stats?.revenue?.toLocaleString()}`} icon={<TrendingUp size={24} />} onClick={() => setSelectedStat('Revenue')} />
                <StatCard color="blue" label="Total Orders" value={stats?.totalOrders || 0} icon={<ShoppingBag size={24} />} onClick={() => setSelectedStat('Total Orders')} />
                <StatCard color="green" label="Active Orders" value={stats?.activeOrders || 0} icon={<Clock size={24} />} onClick={() => setSelectedStat('Active Orders')} />
                <StatCard color="violet" label="Total Staff" value={stats?.totalStaff || 0} icon={<Users size={24} />} onClick={() => setSelectedStat('Total Staff')} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 rounded-3xl bg-white/5 border border-white/5 p-8">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-xl font-black">Performance Trend</h3>
                       <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white">
                          Weekly <Filter size={12} />
                       </button>
                    </div>
                    <div className="h-64 flex items-end justify-between gap-4">
                       {[60, 45, 75, 55, 90, 65, 80].map((h, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                             <motion.div 
                               initial={{ height: 0 }} animate={{ height: `${h}%` }}
                               className="w-full rounded-t-xl bg-orange-500/20 group-hover:bg-orange-500/40 transition-all cursor-pointer relative"
                             >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black">₹{h*10}k</div>
                             </motion.div>
                             <span className="text-[10px] font-bold text-white/20 uppercase">Day {i+1}</span>
                          </div>
                       ))}
                    </div>
                 </div>
                 <div className="rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 p-8 shadow-2xl shadow-orange-500/20 relative overflow-hidden">
                    <div className="relative z-10">
                       <h3 className="text-2xl font-black mb-2">Month Reset</h3>
                       <p className="text-sm text-white/80 leading-relaxed mb-10">Ready to start fresh? Archive all current orders and reset your tracking for the next period.</p>
                       <motion.button 
                         onClick={() => setResetConfirm(true)}
                         whileHover={{ scale: 1.05, background: 'rgba(255,255,255,1)', color: '#f97316' }}
                         whileTap={{ scale: 0.95 }}
                         className="w-full py-4 rounded-2xl bg-white text-orange-600 font-black text-sm uppercase tracking-widest shadow-xl"
                       >
                          Reset Now
                       </motion.button>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 blur-[60px] rounded-full" />
                 </div>
              </div>
            </motion.div>
          )}


          {/* BILLING / CURRENT ORDERS TAB */}
          {activeTab === 'billing' && (
            <motion.div key="billing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
               <div className="flex flex-col lg:flex-row gap-6">
                  {/* Active Tables Grid */}
                  <div className="flex-1 space-y-6">
                     <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black">Live Billing</h3>
                        <p className="text-xs text-white/40 font-bold">{groupOrdersByTable().length} Tables Occupied</p>
                     </div>
                     {groupOrdersByTable().length === 0 ? (
                        <div className="py-20 text-center rounded-3xl border-2 border-dashed border-white/5">
                           <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                              <Utensils size={30} className="text-white/10" />
                           </div>
                           <p className="text-white/20 font-bold">No active orders at the moment</p>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {groupOrdersByTable().map((group: any) => (
                              <motion.div key={group.table_number} className="rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col justify-between hover:border-orange-500/30 transition-all">
                                 <div>
                                    <div className="flex items-start justify-between mb-4">
                                       <div>
                                          <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase tracking-widest border border-orange-500/20">Table {group.table_number}</span>
                                          <h4 className="text-lg font-black mt-2">₹{group.total.toLocaleString()}</h4>
                                       </div>
                                       <div className="text-right">
                                          <p className="text-[10px] font-bold text-white/40 uppercase">Waiter</p>
                                          <p className="text-xs font-black text-white/70">{group.staff_name}</p>
                                       </div>
                                    </div>
                                    <div className="space-y-2 mb-6">
                                       {group.orders.map((o: any) => (
                                          <div key={o.id} className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-0">
                                             <span className="text-white/40">Order #{o.id}</span>
                                             <span className={`font-black uppercase text-[10px] ${o.status === 'ready' ? 'text-green-400' : 'text-orange-400'}`}>{o.status}</span>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                                 <div className="flex gap-2">
                                    <button 
                                      onClick={() => setPreviewGroup(group)}
                                      className="flex-1 py-3 rounded-2xl bg-white/5 text-white font-bold text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                    >
                                       <Printer size={14} /> Review
                                    </button>
                                    <button 
                                      onClick={() => handleMarkPaid(group)}
                                      disabled={payingId !== null}
                                      className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-bold text-xs hover:bg-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                                    >
                                       {payingId === group.orders[0].id ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity }} className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full" /> : <CheckCircle2 size={14} />} Mark Paid
                                    </button>
                                 </div>
                              </motion.div>
                           ))}
                        </div>
                     )}
                  </div>

                  {/* Bill History / Report */}
                  <div className="w-full lg:w-96 space-y-6">
                     <div className="rounded-3xl bg-white/5 border border-white/10 p-6 h-fit sticky top-28">
                        <h3 className="text-xl font-black mb-6">Billing History</h3>
                        <div className="space-y-4 mb-8">
                           <div>
                              <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Filter Date</label>
                              <div className="grid grid-cols-2 gap-2">
                                 <input type="date" value={billingFilter.from} onChange={e => setBillingFilter({...billingFilter, from: e.target.value})} className="bg-[#07070c] border border-white/10 rounded-xl px-3 py-2 text-[10px] outline-none focus:border-orange-500 transition-all" />
                                 <input type="date" value={billingFilter.to} onChange={e => setBillingFilter({...billingFilter, to: e.target.value})} className="bg-[#07070c] border border-white/10 rounded-xl px-3 py-2 text-[10px] outline-none focus:border-orange-500 transition-all" />
                              </div>
                              <button onClick={fetchPaidBillsHistory} className="w-full mt-2 py-2 rounded-xl bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase tracking-widest border border-orange-500/20 hover:bg-orange-500/20">Apply Filter</button>
                           </div>
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 no-scrollbar">
                           {paidBillsHistory.map(bill => (
                               <div key={bill.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
                                  <div className="flex justify-between items-start mb-1">
                                     <span className="text-[10px] font-black text-orange-500 uppercase tracking-tight">{bill.bill_number}</span>
                                     <span className="text-xs font-black text-white">₹{(bill.grand_total || bill.total_price).toLocaleString()}</span>
                                  </div>
                                 <p className="text-[10px] text-white/40 truncate">{bill.items}</p>
                                 <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                                    <span className="text-[9px] text-white/20 uppercase font-bold">{new Date(bill.paid_at).toLocaleDateString()}</span>
                                    <span className="text-[9px] text-white/20 uppercase font-bold">Table {bill.table_number}</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </motion.div>
          )}

          {/* MENU TAB */}
          {activeTab === 'menu' && (
            <motion.div key="menu" className="space-y-6 max-w-6xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-white">Menu Management</h2>
                  <p className="mt-1 text-sm text-white/40">Bulk upload and dish registry</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={downloadMenuTemplate} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all font-bold text-[10px] uppercase tracking-widest">
                    <FileSpreadsheet size={16} /> Template
                  </button>
                  <label className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all font-bold text-[10px] uppercase tracking-widest cursor-pointer">
                    <Upload size={16} /> Upload
                    <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleMenuBulkUpload} />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-3xl p-6 bg-white/5 border border-white/10 h-fit">
                  <h3 className="font-bold text-white mb-5 flex items-center gap-2 text-lg">
                    <Plus size={18} className="text-orange-500" /> Add New Item
                  </h3>
                  <form onSubmit={handleAddMenuItem} className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Item Name</label>
                        <input type="text" required className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" placeholder="e.g. Butter Chicken" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Item Type</label>
                          <select className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all appearance-none" value={newItem.type} onChange={e => setNewItem({ ...newItem, type: e.target.value, is_veg: e.target.value === 'veg' })}>
                            <option value="veg">Veg</option>
                            <option value="nonveg">Non-Veg</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Category</label>
                          <select className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all appearance-none" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                            {['Starter', 'Main Course', 'Chinese', 'Drinks', 'Dessert', 'Bread', 'Soup', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Price (₹)</label>
                            <input type="number" required className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" placeholder="0.00" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
                         </div>
                         <div>
                            <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Half Price (₹)</label>
                            <input type="number" className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" placeholder="Optional" value={newItem.half_price} onChange={e => setNewItem({ ...newItem, half_price: e.target.value })} />
                         </div>
                      </div>
                    </div>
                    <button type="submit" className="w-full py-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Add to Menu</button>
                  </form>
                </div>

                <div className="lg:col-span-2 rounded-3xl overflow-hidden bg-white/5 border border-white/10">
                   <div className="p-6 border-b border-white/10 bg-white/[0.02]">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                         <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                            <input 
                              type="text" 
                              placeholder="Search menu items..." 
                              value={menuSearch} 
                              onChange={e => setMenuSearch(e.target.value)}
                              className="w-full bg-[#07070c] border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" 
                            />
                         </div>
                         <div className="flex gap-2">
                            {['all', 'veg', 'nonveg'].map(f => (
                               <button 
                                 key={f} 
                                 onClick={() => setMenuVegFilter(f as any)}
                                 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${menuVegFilter === f ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                               >
                                  {f}
                               </button>
                            ))}
                         </div>
                      </div>
                   </div>
                   <div className="overflow-x-auto max-h-[600px] no-scrollbar">
                      <table className="w-full border-collapse">
                         <thead className="bg-white/[0.02] text-white/30 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10">
                            <tr>
                               <th className="px-6 py-4 text-left">Item</th>
                               <th className="px-6 py-4 text-left">Category</th>
                               <th className="px-6 py-4 text-left">Price</th>
                               <th className="px-6 py-4 text-left">Status</th>
                               <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-white/5">
                            {filteredMenu.map(item => (
                               <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                  <td className="px-6 py-4">
                                     <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <span className="font-bold text-sm">{item.name}</span>
                                     </div>
                                  </td>
                                  <td className="px-6 py-4">
                                     <span className="text-xs text-white/40 font-medium">{item.category}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                     <div className="text-sm font-black text-white/80">₹{item.price}</div>
                                     {item.half_price > 0 && <div className="text-[10px] text-white/20">½ ₹{item.half_price}</div>}
                                  </td>
                                  <td className="px-6 py-4">
                                     <button onClick={() => handleToggleStock(item)} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${item.out_of_stock ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
                                        {item.out_of_stock ? 'Out of Stock' : 'In Stock'}
                                     </button>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                     <button onClick={() => handleDeleteMenuItem(item.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                                        <Trash2 size={16} />
                                     </button>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STAFF TAB */}
          {activeTab === 'staff' && (
            <motion.div key="staff" className="space-y-6 max-w-5xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div>
                <h2 className="text-3xl font-black text-white">Staff Management</h2>
                <p className="mt-1 text-sm text-white/40">Create and manage access for your team</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 rounded-3xl p-8 bg-white/5 border border-white/10 h-fit">
                  <h3 className="font-bold text-white mb-6 flex items-center gap-2 text-lg">
                    <Users size={18} className="text-purple-500" /> Account Creation
                  </h3>
                  <form onSubmit={handleGenerateStaff} className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-4">Account Role</label>
                      <div className="flex gap-2">
                        {['kitchen', 'stock_manager'].map(r => (
                          <button key={r} type="button" onClick={() => setNewStaffRole(r as any)} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${newStaffRole === r ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 border-white/10 text-white/30'}`}>
                            {r === 'kitchen' ? 'Order Section' : 'Stock Manager'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Staff Names (one per line)</label>
                      <textarea rows={4} className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all resize-none" placeholder="John Doe\nJane Smith" value={newStaffNames} onChange={e => setNewStaffNames(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Initial Password</label>
                      <input type="password" required className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all" placeholder="Set shared password" value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} />
                    </div>
                    <button type="submit" className="w-full py-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-purple-500/20">Generate Credentials</button>
                  </form>
                </div>

                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center justify-between px-2">
                     <h3 className="font-bold text-white">Active Team ({staff.length})</h3>
                     <div className="flex gap-2">
                        <span className="px-3 py-1 rounded-full bg-white/5 text-white/30 text-[9px] font-black uppercase tracking-widest border border-white/5">{staff.filter(s => s.role === 'kitchen').length} Orders Staff</span>
                        <span className="px-3 py-1 rounded-full bg-white/5 text-white/30 text-[9px] font-black uppercase tracking-widest border border-white/5">{staff.filter(s => s.role === 'stock_manager').length} Stock</span>
                     </div>
                  </div>
                  <div className="space-y-3">
                    {staff.map(member => (
                      <motion.div key={member.id} className="rounded-3xl p-5 bg-white/5 border border-white/10 hover:border-white/20 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 flex items-center justify-center font-black text-purple-400 text-lg border border-purple-500/10">
                              {member.name[0].toUpperCase()}
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                 <p className="font-bold text-white">{member.name}</p>
                                 <span className={`w-2 h-2 rounded-full ${member.active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-white/10'}`} />
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-white/20">{member.role.replace('_', ' ')}</p>
                                 <span className="w-1 h-1 rounded-full bg-white/10" />
                                 <p className="text-[10px] text-white/40">{member.email}</p>
                                 <button onClick={() => copyEmail(member.email, member.id)} className="text-white/20 hover:text-white"><Copy size={10} /></button>
                              </div>
                           </div>
                        </div>
                        <button onClick={() => handleRemoveStaff(member.id)} className="p-2 rounded-xl bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                           <Trash2 size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
              <Analytics />
            </motion.div>
          )}

          {/* STOCK TAB */}
          {activeTab === 'stock' && (
            <motion.div key="stock" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
              <StockManagement />
            </motion.div>
          )}
          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <motion.div key="settings" className="space-y-6 max-w-4xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="rounded-3xl p-8 bg-white/5 border border-white/10">
                <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                  <Settings className="text-orange-500" size={24} /> Government & Tax Rules
                </h3>
                <form onSubmit={handleUpdateSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Restaurant Name</label>
                    <input type="text" className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={settings?.restaurant_name || ''} onChange={e => setSettings({...settings, restaurant_name: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Address</label>
                    <textarea rows={2} className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all resize-none" value={settings?.address || ''} onChange={e => setSettings({...settings, address: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">GST Number</label>
                    <input type="text" className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={settings?.gst_number || ''} onChange={e => setSettings({...settings, gst_number: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">FSSAI License No.</label>
                    <input type="text" className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={settings?.fssai_number || ''} onChange={e => setSettings({...settings, fssai_number: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">CGST (%)</label>
                    <input type="number" step="0.1" className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={settings?.cgst_percent || 0} onChange={e => setSettings({...settings, cgst_percent: parseFloat(e.target.value)})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">SGST (%)</label>
                    <input type="number" step="0.1" className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={settings?.sgst_percent || 0} onChange={e => setSettings({...settings, sgst_percent: parseFloat(e.target.value)})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Contact Details</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input type="text" placeholder="Mobile Number" className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={settings?.contact_number || ''} onChange={e => setSettings({...settings, contact_number: e.target.value})} />
                      <input type="email" placeholder="Email Address" className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={settings?.email || ''} onChange={e => setSettings({...settings, email: e.target.value})} />
                      <input type="text" placeholder="Website (e.g. www.roms.com)" className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={settings?.website || ''} onChange={e => setSettings({...settings, website: e.target.value})} />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <button type="submit" disabled={savingSettings} className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-500/20">
                      {savingSettings ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* ABOUT DEVELOPER TAB */}
          {activeTab === 'about' && (
            <motion.div key="about" className="space-y-6 max-w-4xl mx-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              
              <div className="rounded-[40px] overflow-hidden bg-gradient-to-br from-orange-500/10 to-purple-500/10 border border-white/10 p-1 lg:p-2">
                <div className="bg-[#0d0d16] rounded-[32px] p-8 lg:p-12 h-full flex flex-col justify-center items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 mb-6 flex items-center justify-center p-1 shadow-2xl shadow-orange-500/20">
                     <div className="w-full h-full bg-[#0d0d16] rounded-full flex items-center justify-center">
                        <ChefHat size={40} className="text-white/80" />
                     </div>
                  </div>
                  
                  <h1 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight">ROMS</h1>
                  <p className="text-orange-500 font-bold uppercase tracking-[0.2em] mb-8 text-sm">Restaurant Order Management System</p>
                  
                  <p className="text-white/60 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
                    A next-generation, lightning-fast, and comprehensive system designed to bridge the gap between front-of-house service, kitchen operations, and back-office administration. 
                    Replaces cluttered paper trails with a premium, real-time digital experience.
                  </p>

                  <div className="w-full max-w-2xl border-t border-white/10 pt-10">
                     <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-6">Developed By</h3>
                     
                     <div className="bg-white/5 rounded-3xl p-6 border border-white/5 flex flex-col items-center gap-2">
                        <h2 className="text-2xl font-black text-white">Safwan Raza</h2>
                        <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
                           <a href="tel:+917398290844" className="flex items-center gap-2 text-white/60 hover:text-orange-500 transition-colors bg-white/5 px-4 py-2 rounded-full text-sm font-medium">
                              📞 +91 7398290844
                           </a>
                           <a href="mailto:safwan.tnd1@gmail.com" className="flex items-center gap-2 text-white/60 hover:text-orange-500 transition-colors bg-white/5 px-4 py-2 rounded-full text-sm font-medium">
                              ✉️ safwan.tnd1@gmail.com
                           </a>
                        </div>
                     </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-[32px] p-8 bg-white/5 border border-white/10">
                  <h3 className="text-xl font-black mb-4 flex items-center gap-3 text-orange-500"><LayoutDashboard size={20} /> Core Features</h3>
                  <ul className="space-y-3 text-sm text-white/60 font-medium">
                    <li>• Real-time Analytics & Revenue Dashboard</li>
                    <li>• Keyboard-Driven POS for ultra-fast billing</li>
                    <li>• Live Table & Kitchen Status Tracking</li>
                    <li>• 80mm Thermal Print Ready Architecture</li>
                    <li>• Automated CGST/SGST Tax Rules</li>
                  </ul>
                </div>
                <div className="rounded-[32px] p-8 bg-white/5 border border-white/10">
                  <h3 className="text-xl font-black mb-4 flex items-center gap-3 text-purple-500"><Package size={20} /> Upcoming Features</h3>
                  <ul className="space-y-3 text-sm text-white/60 font-medium">
                    <li>• <strong className="text-white/90">Dedicated Waiter Module:</strong> Mobile-friendly app for table-side ordering.</li>
                    <li>• <strong className="text-white/90">Design Your Dish:</strong> Custom dietary tags & special instructions.</li>
                    <li>• Advanced Inventory Predictions</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Modals ── */}
      <AnimatePresence>
        {/* Reset Confirm Modal */}
        {resetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResetConfirm(false)} className="fixed inset-0 bg-[#07070c]/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-[#0d0d16] border border-red-500/20 rounded-[40px] p-10 text-center shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto mb-8 border border-red-500/20">
                <AlertTriangle size={40} className="text-red-500" />
              </div>
              <h3 className="text-3xl font-black mb-4">Are you sure?</h3>
              <p className="text-white/40 text-sm leading-relaxed mb-10">This will <span className="text-red-500 font-bold">permanently delete</span> all orders and reset revenue counters. This action cannot be undone.</p>
              <div className="flex gap-4">
                <button onClick={() => setResetConfirm(false)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 font-bold text-sm hover:text-white transition-all">Cancel</button>
                <button onClick={resetOrders} disabled={resetting} className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-red-500/20">
                   {resetting ? 'Resetting...' : 'Yes, Reset'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Paid Success Modal */}
        {paidBill && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPaidBill(null)} className="fixed inset-0 bg-[#07070c]/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-[#0d0d16] border border-green-500/20 rounded-[40px] p-10 text-center shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-green-500/10 flex items-center justify-center mx-auto mb-8 border border-green-500/20">
                <CheckCircle2 size={40} className="text-green-500" />
              </div>
              <h3 className="text-2xl font-black mb-2">Payment Success</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-8">{paidBill.bill_number}</p>
              <div className="bg-white/5 rounded-3xl p-6 mb-8 text-left">
                 <div className="flex justify-between text-xs mb-2">
                    <span className="text-white/40">Total Amount</span>
                    <span className="font-bold">₹{paidBill.grand_total}</span>
                 </div>
                 <div className="flex justify-between text-xs">
                    <span className="text-white/40">Table</span>
                    <span className="font-bold">{paidBill.orders[0]?.table_number}</span>
                 </div>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => { setPreviewGroup(paidBill); setPaidBill(null); }} className="flex-1 py-4 rounded-2xl bg-orange-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"><Printer size={16} /> Print</button>
                 <button onClick={() => setPaidBill(null)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 font-bold text-xs uppercase tracking-widest">Close</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Stat Detail Modal */}
        {selectedStat && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStat(null)} className="fixed inset-0 bg-[#07070c]/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }} className="relative w-full max-w-2xl bg-[#0d0d16] border border-white/10 rounded-[40px] p-10 overflow-hidden">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-3xl font-black">{selectedStat}</h3>
                  <button onClick={() => setSelectedStat(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white"><X size={20} /></button>
               </div>
               <div className="max-h-[500px] overflow-y-auto no-scrollbar space-y-4">
                  {selectedStat === 'Total Orders' && orders.map(o => (
                     <div key={o.id} className="p-5 rounded-2xl bg-white/5 border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <p className="font-bold text-lg">Order #{o.id}</p>
                              <p className="text-[10px] font-black uppercase text-white/30">Table {o.table_number}</p>
                           </div>
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${o.status === 'paid' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-orange-500/10 border-orange-500/20 text-orange-500'}`}>{o.status}</span>
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                           <p className="text-xs text-white/40">{new Date(o.created_at).toLocaleString()}</p>
                           <p className="text-xl font-black">₹{o.total_price}</p>
                        </div>
                     </div>
                  ))}
                  {/* ... other detail views could be added here ... */}
               </div>
            </motion.div>
          </div>
        )}

        {/* Change Password Modal */}
        {showChangePw && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChangePw(false)} className="fixed inset-0 bg-[#07070c]/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-[#0d0d16] border border-white/10 rounded-[40px] p-10 shadow-2xl">
              <h3 className="text-2xl font-black mb-8">Security Settings</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setChangePwLoading(true);
                try {
                  await axios.put('/api/auth/change-password', {
                    currentPassword: changePwForm.current,
                    newPassword: changePwForm.next,
                  });
                  setChangePwSuccess(true);
                  setTimeout(() => setShowChangePw(false), 2000);
                } catch (err: any) {
                  setChangePwError(err.response?.data?.error || 'Failed to update');
                } finally {
                  setChangePwLoading(false);
                }
              }} className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">Current Password</label>
                    <input type="password" required className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={changePwForm.current} onChange={e => setChangePwForm({...changePwForm, current: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block mb-2">New Password</label>
                    <input type="password" required className="w-full bg-[#07070c] border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-all" value={changePwForm.next} onChange={e => setChangePwForm({...changePwForm, next: e.target.value})} />
                 </div>
                 {changePwError && <p className="text-red-500 text-[10px] font-bold">{changePwError}</p>}
                 {changePwSuccess && <p className="text-green-500 text-[10px] font-bold">Password updated successfully!</p>}
                 <button type="submit" disabled={changePwLoading} className="w-full py-4 rounded-2xl bg-white text-[#07070c] font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all">
                    {changePwLoading ? 'Updating...' : 'Update Password'}
                 </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Review/Print Modal */}
        {previewGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewGroup(null)} className="fixed inset-0 bg-[#07070c]/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }} className="relative w-full max-w-lg bg-white text-[#07070c] rounded-[40px] p-10 overflow-hidden">
                <div className="text-center mb-8 border-b-2 border-dashed border-black/10 pb-6">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center mx-auto mb-4">
                     <ChefHat size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">{settings?.restaurant_name || 'Restaurant Receipt'}</h3>
                  <p className="text-[10px] font-bold text-black/50 uppercase leading-relaxed max-w-[200px] mx-auto mb-2">{settings?.address}</p>
                  <div className="flex flex-col gap-1">
                    {settings?.gst_number && <p className="text-[9px] font-black text-black/40 uppercase tracking-widest">GSTIN: {settings.gst_number}</p>}
                    {settings?.fssai_number && <p className="text-[9px] font-black text-black/40 uppercase tracking-widest">FSSAI: {settings.fssai_number}</p>}
                    {settings?.contact_number && <p className="text-[9px] font-black text-black/40 uppercase tracking-widest">PH: {settings.contact_number}</p>}
                  </div>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-4">Official Tax Invoice • {previewGroup.bill_number || 'Pre-Bill'}</p>
               </div>
               
               <div className="space-y-6 mb-10">
                  <div className="flex justify-between border-b-2 border-dashed border-black/10 pb-4">
                     <div className="text-left">
                        <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">Table</p>
                        <p className="text-lg font-black">{previewGroup.table_number}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">Date</p>
                        <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                     </div>
                  </div>

                  <div className="space-y-3">
                     {(previewGroup.orders || []).flatMap((o: any) => o.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                           <div className="flex items-center gap-2">
                              <span className="font-black text-orange-500">{item.quantity}x</span>
                              <span className="font-bold">{item.item_name}</span>
                              {item.portion === 'half' && <span className="text-[10px] font-black uppercase text-purple-500">½</span>}
                           </div>
                           <span className="font-black">₹{((item.portion === 'half' ? (item.half_price || item.price/2) : item.price) * item.quantity).toFixed(0)}</span>
                        </div>
                     ))}
                   </div>
                </div>

               <div className="border-t-2 border-dashed border-black/10 pt-6 space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                     <span>Subtotal</span>
                     <span>₹{previewGroup.total.toLocaleString()}</span>
                  </div>
                  {settings?.cgst_percent > 0 && (
                    <div className="flex justify-between text-[11px] text-black/60">
                       <span>CGST ({settings.cgst_percent}%)</span>
                       <span>₹{(previewGroup.total * settings.cgst_percent / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {settings?.sgst_percent > 0 && (
                    <div className="flex justify-between text-[11px] text-black/60">
                       <span>SGST ({settings.sgst_percent}%)</span>
                       <span>₹{(previewGroup.total * settings.sgst_percent / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {settings?.service_charge_percent > 0 && (
                    <div className="flex justify-between text-[11px] text-black/60">
                       <span>Service Charge ({settings.service_charge_percent}%)</span>
                       <span>₹{(previewGroup.total * settings.service_charge_percent / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px] text-black/60">
                     <span>Round Off</span>
                     <span>₹{(Math.round(previewGroup.total + (previewGroup.total * ((settings?.cgst_percent || 0) + (settings?.sgst_percent || 0) + (settings?.service_charge_percent || 0)) / 100)) - (previewGroup.total + (previewGroup.total * ((settings?.cgst_percent || 0) + (settings?.sgst_percent || 0) + (settings?.service_charge_percent || 0)) / 100))).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-black pt-4 border-t border-black/5">
                     <span>Grand Total</span>
                     <span className="text-orange-500">₹{Math.round(previewGroup.total + (previewGroup.total * ((settings?.cgst_percent || 0) + (settings?.sgst_percent || 0) + (settings?.service_charge_percent || 0)) / 100)).toLocaleString()}</span>
                  </div>
               </div>

               <div className="mt-8 text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-tighter">Thank you for dining with us!</p>
                  <p className="text-[9px] font-bold text-black/30 uppercase">Visit Again • software by ROMS</p>
               </div>

               <div className="flex gap-4 mt-8 no-print">
                  <button onClick={() => window.print()} className="flex-1 py-4 rounded-2xl bg-[#07070c] text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl"><Printer size={16} /> Print Bill</button>
                  <button onClick={() => setPreviewGroup(null)} className="flex-1 py-4 rounded-2xl bg-black/5 text-black/40 font-bold text-xs uppercase tracking-widest">Close</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          .fixed.inset-0.z-\\[100\\] { position: absolute; left: 0; top: 0; width: 100%; height: auto; visibility: visible; background: white !important; }
          .fixed.inset-0.z-\\[100\\] > div:first-child { display: none; }
          .relative.bg-white { visibility: visible; width: 100%; border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
          .relative.bg-white * { visibility: visible; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
