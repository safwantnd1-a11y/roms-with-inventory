import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart, Plus, Minus, X, Send, ChefHat,
  CheckCircle2, Phone, Search, Droplets, Utensils, Star
} from 'lucide-react';

/* ── helpers ──────────────────────────────────────────── */
const isLiquid = (item: any) =>
  item.category === 'Drink' || item.category === 'Drinks' || item.type === 'liquid';

function VegDot({ veg }: { veg: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 14, height: 14, flexShrink: 0,
      border: `1.5px solid ${veg ? '#22c55e' : '#ef4444'}`, borderRadius: 2
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: veg ? '#22c55e' : '#ef4444', display: 'block'
      }} />
    </span>
  );
}

export default function QRMenu() {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const [table,         setTable]      = useState<any>(null);
  const [menu,          setMenu]       = useState<any[]>([]);
  const [cart,          setCart]       = useState<any[]>([]);
  const [cartOpen,      setCartOpen]   = useState(false);
  const [search,        setSearch]     = useState('');
  const [placing,       setPlacing]    = useState(false);
  const [success,       setSuccess]    = useState<any>(null);
  const [error,         setError]      = useState<string | null>(null);
  const [customerName,  setCustName]   = useState('');
  const [customerPhone, setCustPhone]  = useState('');
  const [showForm,      setShowForm]   = useState(false);
  const [vegMode,       setVegMode]    = useState<'all' | 'veg' | 'nonveg'>('all');
  const [activeSection, setSection]    = useState<'all' | 'veg' | 'nonveg' | 'drinks'>('all');
  const [activeCat,     setActiveCat]  = useState('All');

  const decodedTable = tableNumber ? decodeURIComponent(tableNumber) : '';

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, mRes] = await Promise.all([
          axios.get(`/api/public/table/${encodeURIComponent(decodedTable)}`),
          axios.get('/api/public/menu'),
        ]);
        setTable(tRes.data);
        setMenu(Array.isArray(mRes.data) ? mRes.data : []);
      } catch (e: any) {
        setError(e.response?.data?.error || 'Could not load menu.');
      }
    };
    if (decodedTable) load();
  }, [decodedTable]);

  /* ── Cart helpers ─────────────────────────────────── */
  const addToCart = useCallback((item: any) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      if (ex) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, menu_id: item.id, quantity: 1, portion: 'full' }];
    });
  }, []);

  const updateQty = (id: number, delta: number) => {
    setCart(prev => {
      const item = prev.find(c => c.id === id);
      if (!item) return prev;
      if (item.quantity + delta <= 0) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, quantity: c.quantity + delta } : c);
    });
  };

  const cartTotal   = cart.reduce((s, i) => s + i.quantity, 0);
  const cartRevenue = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  /* ── Filter logic ────────────────────────────────── */
  const nonDrinkCats = ['All', ...Array.from(new Set(
    menu.filter(i => !isLiquid(i)).map(i => i.category).filter(Boolean)
  ))];

  const bySearch = (item: any) => item.name.toLowerCase().includes(search.toLowerCase());
  const byCat    = (item: any) => activeCat === 'All' || item.category === activeCat;

  const vegItems    = menu.filter(i => !isLiquid(i) && i.is_veg  && bySearch(i) && byCat(i));
  const nonVegItems = menu.filter(i => !isLiquid(i) && !i.is_veg && bySearch(i) && byCat(i));
  const drinkItems  = menu.filter(i => isLiquid(i) && bySearch(i));

  /* ── Place order ─────────────────────────────────── */
  const placeOrder = async () => {
    if (!table || cart.length === 0) return;
    setPlacing(true);
    try {
      const res = await axios.post('/api/public/orders', {
        table_id: table.id,
        items: cart.map(i => ({ menu_id: i.menu_id, quantity: i.quantity, portion: i.portion })),
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
      });
      setSuccess(res.data);
      setCart([]);
      setCartOpen(false);
    } catch (e: any) {
      alert('Order failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setPlacing(false);
    }
  };

  /* ── Item Card ───────────────────────────────────── */
  const ItemCard = React.memo(function ItemCard({ item }: { item: any }) {
    const inCart  = cart.find(c => c.id === item.id);
    const liquid  = isLiquid(item);
    const accent  = liquid ? '#06b6d4' : item.is_veg ? '#22c55e' : '#ef4444';
    const imgSrc  = item.image_url
      ? (item.image_url.startsWith('http') ? item.image_url : item.image_url)
      : null;

    return (
      <motion.div
        className="overflow-hidden rounded-3xl flex"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        whileHover={{ borderColor: `${accent}40` }}
        layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

        {/* Image / Icon */}
        {imgSrc ? (
          <div className="w-24 h-24 flex-shrink-0 relative overflow-hidden" style={{ minWidth: 96 }}>
            <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, transparent 60%, rgba(10,10,15,0.6))' }} />
          </div>
        ) : (
          <div className="w-20 flex-shrink-0 flex items-center justify-center" style={{ background: `${accent}12` }}>
            {liquid
              ? <Droplets size={24} style={{ color: accent }} />
              : <Utensils size={24} style={{ color: accent }} />}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {!liquid && <VegDot veg={!!item.is_veg} />}
              <p className="font-bold text-white text-sm leading-tight truncate">{item.name}</p>
            </div>
            {item.description && (
              <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="font-black text-sm" style={{ color: '#f97316' }}>₹{item.price}</span>
              {Number(item.half_price) > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                  ½ ₹{item.half_price}
                </span>
              )}
              {item.out_of_stock ? (
                <span className="text-[10px] font-bold text-red-400">Out of Stock</span>
              ) : item.preparation_time > 0 ? (
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>~{item.preparation_time}m</span>
              ) : null}
            </div>
          </div>

          {/* Cart controls */}
          <div className="flex justify-end mt-2">
            {item.out_of_stock ? (
              <span className="text-xs px-3 py-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}>Unavailable</span>
            ) : inCart ? (
              <div className="flex items-center gap-2">
                <motion.button onClick={() => updateQty(item.id, -1)} whileTap={{ scale: 0.85 }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <Minus size={12} />
                </motion.button>
                <motion.span key={inCart.quantity} className="font-black text-sm w-5 text-center text-white"
                  initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
                  {inCart.quantity}
                </motion.span>
                <motion.button onClick={() => addToCart(item)} whileTap={{ scale: 0.85 }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${accent}25` }}>
                  <Plus size={12} style={{ color: accent }} />
                </motion.button>
              </div>
            ) : (
              <motion.button onClick={() => addToCart(item)} whileTap={{ scale: 0.88 }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}
                whileHover={{ background: 'rgba(249,115,22,0.25)' }}>
                <Plus size={13} /> Add
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  });

  /* ── Section Header ──────────────────────────────── */
  const SectionLabel = ({ emoji, label, color, count }: any) =>
    count > 0 ? (
      <div className="flex items-center gap-3 py-2 mt-4 mb-2 sticky top-[104px] z-10"
        style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(10px)' }}>
        <span className="text-base">{emoji}</span>
        <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>{label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${color}18`, color }}>{count}</span>
        <div className="flex-1 h-px" style={{ background: `${color}20` }} />
      </div>
    ) : null;

  /* ── Success screen ──────────────────────────────── */
  if (success) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 100%)' }}>
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.25)' }}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }}>
        <CheckCircle2 size={56} className="text-green-400" />
      </motion.div>
      <motion.h1 className="text-3xl font-black text-white mb-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        Order Placed! 🎉
      </motion.h1>
      <motion.p className="text-gray-400 mb-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        Your order is sent to the kitchen.
      </motion.p>
      <motion.p className="text-xs text-gray-600 mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        ✅ The kitchen will begin preparing it shortly.
      </motion.p>
      <motion.div className="px-8 py-4 rounded-3xl mb-8 text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
        <p className="text-green-400 font-black text-xl">Order #{success.order_id}</p>
        <p className="text-green-300 text-sm mt-1">Total: ₹{(success.total || 0).toFixed(2)}</p>
      </motion.div>
      <motion.button onClick={() => setSuccess(null)}
        className="px-10 py-4 rounded-2xl font-black text-white text-base"
        style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 30px rgba(249,115,22,0.4)' }}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        Order More 🍽️
      </motion.button>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: '#0a0a0f' }}>
      <p className="text-5xl mb-4">😕</p>
      <h2 className="text-xl font-black text-white mb-2">Table Not Found</h2>
      <p className="text-sm text-gray-500">{error}</p>
    </div>
  );

  const showVeg    = vegMode === 'all' || vegMode === 'veg';
  const showNonVeg = vegMode === 'all' || vegMode === 'nonveg';

  return (
    <div className="min-h-screen pb-36" style={{ background: 'linear-gradient(160deg, #0a0a0f 0%, #0e0e1c 100%)', color: 'white' }}>

      {/* ── Header ─────────────────────────────────── */}
      <motion.header className="sticky top-0 z-30 px-4 pt-4 pb-3"
        style={{ background: 'rgba(10,10,15,0.96)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        initial={{ y: -80 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}>
              <ChefHat size={18} className="text-white" />
            </div>
            <div>
              <p className="font-black text-white text-base leading-none">Self Order</p>
              {table && <p className="text-xs font-bold mt-0.5" style={{ color: '#f97316' }}>{table.table_number}</p>}
            </div>
          </div>
          {cartTotal > 0 && (
            <motion.button onClick={() => setCartOpen(true)}
              className="relative p-2.5 rounded-2xl"
              style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}
              whileTap={{ scale: 0.9 }}>
              <ShoppingCart size={20} style={{ color: '#f97316' }} />
              <motion.span key={cartTotal}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center text-white"
                style={{ background: '#f97316' }}
                initial={{ scale: 1.5 }} animate={{ scale: 1 }}>
                {cartTotal}
              </motion.span>
            </motion.button>
          )}
        </div>

        {/* Search + Veg toggle row */}
        <div className="flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <input type="text" placeholder="Search dishes..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm w-full"
              style={{ color: 'white' }} />
          </div>
          {/* Veg mode pills */}
          <div className="flex gap-1 p-1 rounded-2xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { k: 'all',    label: '🍽',   color: '#f97316' },
              { k: 'veg',    label: '🟢',   color: '#22c55e' },
              { k: 'nonveg', label: '🔴',   color: '#ef4444' },
            ].map(o => (
              <motion.button key={o.k} onClick={() => setVegMode(o.k as any)}
                className="w-8 h-7 rounded-xl flex items-center justify-center text-sm"
                whileTap={{ scale: 0.9 }}
                style={vegMode === o.k
                  ? { background: `${o.color}22`, border: `1px solid ${o.color}55` }
                  : {}}>
                {o.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Category filter row */}
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {nonDrinkCats.map(cat => (
            <motion.button key={cat} onClick={() => setActiveCat(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold"
              whileTap={{ scale: 0.93 }}
              style={activeCat === cat
                ? { background: '#f97316', color: 'white' }
                : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {cat}
            </motion.button>
          ))}
          <motion.button onClick={() => setActiveCat('Drink')}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold"
            whileTap={{ scale: 0.93 }}
            style={activeCat === 'Drink'
              ? { background: '#06b6d4', color: 'white' }
              : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
            🥤 Drinks
          </motion.button>
        </div>
      </motion.header>

      {/* ── Menu Content ─────────────────────────────── */}
      <div className="px-4 pt-2 space-y-1">
        {/* VEG */}
        {showVeg && activeCat !== 'Drink' && (
          <>
            <SectionLabel emoji="🟢" label="Vegetarian" color="#22c55e" count={vegItems.length} />
            {vegItems.map(item => <ItemCard key={item.id} item={item} />)}
          </>
        )}

        {/* NON-VEG */}
        {showNonVeg && activeCat !== 'Drink' && (
          <>
            <SectionLabel emoji="🔴" label="Non-Vegetarian" color="#ef4444" count={nonVegItems.length} />
            {nonVegItems.map(item => <ItemCard key={item.id} item={item} />)}
          </>
        )}

        {/* DRINKS — always shown if no category filter or Drink selected */}
        {(activeCat === 'All' || activeCat === 'Drink') && (
          <>
            <SectionLabel emoji="🥤" label="Drinks & Beverages" color="#06b6d4" count={drinkItems.length} />
            {drinkItems.map(item => <ItemCard key={item.id} item={item} />)}
          </>
        )}

        {/* Empty */}
        {vegItems.length === 0 && nonVegItems.length === 0 && drinkItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>No items found</p>
          </div>
        )}
      </div>

      {/* ── Floating Cart CTA ────────────────────────── */}
      <AnimatePresence>
        {cartTotal > 0 && !cartOpen && (
          <motion.div className="fixed bottom-4 left-4 right-4 z-40"
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
            <motion.button onClick={() => setCartOpen(true)}
              className="w-full py-4 rounded-3xl flex items-center justify-between px-6 font-bold"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 32px rgba(249,115,22,0.55)' }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm font-black text-white">
                  {cartTotal}
                </div>
                <span className="text-white font-bold">View Order</span>
              </div>
              <span className="text-white font-black text-lg">₹{cartRevenue.toFixed(0)} →</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart Drawer ───────────────────────────────── */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)} />
            <motion.div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col"
              style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.09)', maxHeight: '92vh' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 32 }}>

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              <div className="flex items-center justify-between px-6 py-3">
                <div>
                  <h3 className="font-black text-xl text-white">Your Order</h3>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{cartTotal} item{cartTotal > 1 ? 's' : ''}</p>
                </div>
                <motion.button onClick={() => setCartOpen(false)} whileTap={{ scale: 0.9 }}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <X size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </motion.button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 space-y-3 pb-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-4 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{item.name}</p>
                      <p className="text-xs font-bold mt-0.5" style={{ color: '#f97316' }}>₹{(item.price * item.quantity).toFixed(0)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button onClick={() => updateQty(item.id, -1)} whileTap={{ scale: 0.85 }}
                        className="w-7 h-7 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <Minus size={12} />
                      </motion.button>
                      <span className="font-black w-5 text-center text-sm">{item.quantity}</span>
                      <motion.button onClick={() => updateQty(item.id, 1)} whileTap={{ scale: 0.85 }}
                        className="w-7 h-7 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(249,115,22,0.2)' }}>
                        <Plus size={12} style={{ color: '#f97316' }} />
                      </motion.button>
                      <motion.button onClick={() => updateQty(item.id, -item.quantity)} whileTap={{ scale: 0.85 }}
                        className="w-7 h-7 rounded-xl flex items-center justify-center ml-1"
                        style={{ background: 'rgba(239,68,68,0.1)' }}>
                        <X size={12} style={{ color: '#f87171' }} />
                      </motion.button>
                    </div>
                  </div>
                ))}

                {/* Optional loyalty capture */}
                <div className="pt-2 border-t border-white/5">
                  <button onClick={() => setShowForm(f => !f)}
                    className="flex items-center gap-2 text-xs font-bold mb-3 w-full"
                    style={{ color: showForm ? '#f97316' : 'rgba(255,255,255,0.35)' }}>
                    <Phone size={12} /> {showForm ? 'Hide' : '+ Add name/phone for loyalty points (optional)'}
                  </button>
                  <AnimatePresence>
                    {showForm && (
                      <motion.div className="space-y-2 mb-2"
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}>
                        <input type="text" placeholder="Your Name" value={customerName}
                          onChange={e => setCustName(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm px-4 py-3 rounded-2xl"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />
                        <input type="tel" placeholder="Phone Number" value={customerPhone}
                          onChange={e => setCustPhone(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm px-4 py-3 rounded-2xl"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Total + Place Order */}
              <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex justify-between mb-4">
                  <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Total</span>
                  <span className="text-2xl font-black" style={{ color: '#f97316' }}>₹{cartRevenue.toFixed(0)}</span>
                </div>
                <motion.button onClick={placeOrder} disabled={placing}
                  className="w-full py-4 rounded-3xl flex items-center justify-center gap-3 font-black text-white text-base"
                  style={{ background: placing ? 'rgba(249,115,22,0.4)' : 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 28px rgba(249,115,22,0.4)' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  {placing ? (
                    <motion.div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : (
                    <><Send size={18} /> Place Order</>
                  )}
                </motion.button>
                <p className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  ✅ Kitchen will start preparing your order
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
