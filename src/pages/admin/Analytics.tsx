import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { motion } from 'motion/react';
import { TrendingUp, Users, ShoppingBag, BarChart3, Clock, Download, RefreshCw } from 'lucide-react';

const BADGE_TIERS = [
  { min: 300, label: 'Gold',   emoji: '🥇', color: '#eab308' },
  { min: 150, label: 'Silver', emoji: '🥈', color: '#94a3b8' },
  { min: 50,  label: 'Bronze', emoji: '🥉', color: '#b45309' },
  { min: 0,   label: 'New',    emoji: '⭐', color: '#6366f1' },
];

const getBadge = (pts: number) => BADGE_TIERS.find(t => pts >= t.min) || BADGE_TIERS[3];

const CATEGORY_COLORS: Record<string, string> = {
  Main: '#f97316', Starter: '#6366f1', Dessert: '#ec4899', Drink: '#06b6d4', Beverage: '#06b6d4',
};

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/admin/analytics');
      setData(r.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const r = await axios.get('/api/admin/export-data');
      const rows: any[] = [];
      r.data.forEach((order: any) => {
        (order.items || []).forEach((item: any, idx: number) => {
          rows.push({
            'Bill No': idx === 0 ? (order.bill_number || 'N/A') : '',
            'Order ID': idx === 0 ? order.id : '',
            'Table': idx === 0 ? order.table_number : '',
            'Staff': idx === 0 ? order.staff_name : '',
            'Status': idx === 0 ? order.status : '',
            'Item': item.item_name,
            'Qty': item.quantity,
            'Portion': item.portion === 'half' ? 'Half' : 'Full',
            'Subtotal (₹)': item.price * item.quantity,
            'CGST (₹)': idx === 0 ? (order.cgst || 0) : '',
            'SGST (₹)': idx === 0 ? (order.sgst || 0) : '',
            'SC (₹)': idx === 0 ? (order.service_charge || 0) : '',
            'Round Off (₹)': idx === 0 ? (order.round_off || 0) : '',
            'Grand Total (₹)': idx === 0 ? (order.grand_total || order.total_price) : '',
            'Date': idx === 0 ? new Date(order.paid_at || order.created_at).toLocaleString() : '',
          });
        });
      });

      // Analytics summary sheet
      const summaryRows = [
        { Metric: 'Total Revenue (₹)', Value: (data?.totalRevenue || 0).toFixed(2) },
        { Metric: 'Total Orders', Value: data?.totalOrders || 0 },
        { Metric: 'Total Customers', Value: data?.totalCustomers || 0 },
        { Metric: 'Repeat Customers', Value: data?.repeatCustomers || 0 },
        { Metric: 'Top Selling Item', Value: data?.topItems?.[0]?.name || 'N/A' },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Orders');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

      // Top items sheet
      if (data?.topItems?.length) {
        XLSX.utils.book_append_sheet(wb,
          XLSX.utils.json_to_sheet(data.topItems.map((i: any) => ({
            Item: i.name, 'Qty Sold': i.quantity_sold, 'Revenue (₹)': (i.revenue || 0).toFixed(2),
          }))),
          'Top Items'
        );
      }

      XLSX.writeFile(wb, `ROMS_Analytics_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      alert('Export failed: ' + (e?.message || 'Unknown error'));
    } finally { setExporting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <motion.div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full"
        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
    </div>
  );

  const maxRevenue = Math.max(...(data?.revenueByDay || []).map((d: any) => d.revenue || 0), 1);
  const maxItems   = Math.max(...(data?.topItems || []).map((i: any) => i.quantity_sold || 0), 1);
  const maxPeak    = Math.max(...(data?.peakHours || []).map((h: any) => h.order_count || 0), 1);

  return (
    <motion.div className="space-y-8 max-w-6xl"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-black text-white">Advanced Analytics</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Business insights, trends & customer data
          </p>
        </div>
        <div className="flex gap-2">
          <motion.button onClick={fetchAnalytics}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <RefreshCw size={15} /> Refresh
          </motion.button>
          <motion.button onClick={exportToExcel} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold"
            style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {exporting
              ? <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
              : <Download size={15} />}
            Export Excel
          </motion.button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `₹${(data?.totalRevenue || 0).toLocaleString()}`, icon: <TrendingUp size={20} />, color: '#f97316' },
          { label: 'Total Orders',    value: data?.totalOrders || 0,        icon: <ShoppingBag size={20} />, color: '#60a5fa' },
          { label: 'Total Customers', value: data?.totalCustomers || 0,     icon: <Users size={20} />,       color: '#a78bfa' },
          { label: 'Repeat Customers', value: data?.repeatCustomers || 0,   icon: <BarChart3 size={20} />,   color: '#34d399' },
        ].map((card, i) => (
          <motion.div key={card.label} className="rounded-3xl p-5"
            style={{ background: `${card.color}12`, border: `1px solid ${card.color}25` }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }} whileHover={{ scale: 1.03 }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: `${card.color}20`, color: card.color }}>
              {card.icon}
            </div>
            <p className="text-2xl font-black text-white">{card.value}</p>
            <p className="text-xs font-bold uppercase tracking-widest mt-1"
              style={{ color: 'rgba(255,255,255,0.3)' }}>{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Revenue Last 7 Days */}
      <motion.div className="rounded-3xl p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <TrendingUp size={18} style={{ color: '#f97316' }} /> Revenue — Last 7 Days
        </h3>
        {!data?.revenueByDay?.length ? (
          <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>No order data yet</p>
        ) : (
          <div className="space-y-3">
            {data.revenueByDay.map((day: any, i: number) => {
              const pct = ((day.revenue || 0) / maxRevenue) * 100;
              return (
                <motion.div key={day.date}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.07 }}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="font-bold" style={{ color: '#f97316' }}>
                      ₹{(day.revenue || 0).toLocaleString()} &nbsp;·&nbsp; {day.orders} orders
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #f97316, #ea580c)' }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.4 + i * 0.07, duration: 0.6, ease: 'easeOut' }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Top Items + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <motion.div className="rounded-3xl p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <ShoppingBag size={18} style={{ color: '#a78bfa' }} /> Top Selling Items
          </h3>
          {!data?.topItems?.length ? (
            <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>No data yet</p>
          ) : (
            <div className="space-y-4">
              {data.topItems.map((item: any, i: number) => {
                const pct = ((item.quantity_sold || 0) / maxItems) * 100;
                return (
                  <motion.div key={item.name}
                    initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.06 }}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                          style={{ background: i < 3 ? '#f9731620' : 'rgba(255,255,255,0.05)', color: i < 3 ? '#f97316' : 'rgba(255,255,255,0.3)' }}>
                          {i + 1}
                        </span>
                        <span className="font-semibold text-white">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>
                        {item.quantity_sold} sold
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <motion.div className="h-full rounded-full"
                        style={{ background: i === 0 ? '#f97316' : i === 1 ? '#a78bfa' : i === 2 ? '#34d399' : 'rgba(255,255,255,0.2)' }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.5 + i * 0.06, duration: 0.5, ease: 'easeOut' }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Category Breakdown */}
        <motion.div className="rounded-3xl p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <BarChart3 size={18} style={{ color: '#34d399' }} /> Category Breakdown
          </h3>
          {!data?.categoryBreakdown?.length ? (
            <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>No data yet</p>
          ) : (() => {
            const totalCatRevenue = data.categoryBreakdown.reduce((s: number, c: any) => s + (c.revenue || 0), 0);
            return (
              <div className="space-y-4">
                {data.categoryBreakdown.map((cat: any, i: number) => {
                  const pct = totalCatRevenue > 0 ? ((cat.revenue || 0) / totalCatRevenue) * 100 : 0;
                  const color = CATEGORY_COLORS[cat.category] || '#94a3b8';
                  return (
                    <motion.div key={cat.category}
                      initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.07 }}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-semibold" style={{ color }}>{cat.category}</span>
                        <span className="font-bold text-white">
                          {pct.toFixed(1)}% &nbsp;·&nbsp;
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            ₹{(cat.revenue || 0).toFixed(0)} | {cat.qty} items
                          </span>
                        </span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <motion.div className="h-full rounded-full"
                          style={{ background: color }}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.55 + i * 0.07, duration: 0.5, ease: 'easeOut' }} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}
        </motion.div>
      </div>

      {/* Peak Hours Heatmap */}
      <motion.div className="rounded-3xl p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Clock size={18} style={{ color: '#60a5fa' }} /> Peak Hours Heatmap
        </h3>
        <div className="grid grid-cols-12 gap-1.5">
          {Array.from({ length: 24 }, (_, hr) => {
            const found = data?.peakHours?.find((h: any) => h.hour === hr);
            const cnt = found?.order_count || 0;
            const intensity = maxPeak > 0 ? cnt / maxPeak : 0;
            const bg = cnt === 0
              ? 'rgba(255,255,255,0.04)'
              : `rgba(249, 115, 22, ${0.15 + intensity * 0.75})`;
            return (
              <motion.div key={hr} title={`${hr}:00 — ${cnt} orders`}
                className="rounded-xl aspect-square flex flex-col items-center justify-center cursor-default"
                style={{ background: bg }}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.55 + hr * 0.02, type: 'spring' }}
                whileHover={{ scale: 1.15 }}>
                <span className="text-[8px] font-bold" style={{ color: cnt > 0 ? 'white' : 'rgba(255,255,255,0.2)' }}>
                  {hr < 10 ? `0${hr}` : hr}
                </span>
                {cnt > 0 && (
                  <span className="text-[9px] font-black" style={{ color: 'rgba(255,255,255,0.8)' }}>{cnt}</span>
                )}
              </motion.div>
            );
          })}
        </div>
        <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Each block = 1 hour. Darker = more orders. Hover for detail.
        </p>
      </motion.div>
    </motion.div>
  );
}
