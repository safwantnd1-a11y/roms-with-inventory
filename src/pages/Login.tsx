import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UtensilsCrossed, Eye, EyeOff, AlertCircle, Users, Wifi, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

const isCapacitorRuntime = !!(window as any).Capacitor;
const legacyHostedUrl = 'https://romsah.dpdns.org';

const getInitialServerUrl = () => {
  const savedUrl = localStorage.getItem('__roms_server_ip') || '';
  const normalizedSavedUrl = savedUrl === legacyHostedUrl ? '' : savedUrl;

  if (savedUrl === legacyHostedUrl) {
    localStorage.removeItem('__roms_server_ip');
  }

  if (isCapacitorRuntime) return normalizedSavedUrl;

  const { protocol, origin } = window.location;
  if (protocol === 'http:' || protocol === 'https:') return origin;

  return normalizedSavedUrl;
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState(getInitialServerUrl);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedServerUrl = serverUrl.trim();

    if (isCapacitorRuntime && !trimmedServerUrl) {
      setError('Please enter the restaurant PC server IP first.');
      return;
    }

    setLoading(true);
    setError('');

    if (trimmedServerUrl) {
      let finalUrl = trimmedServerUrl;
      if (!finalUrl.startsWith('http')) finalUrl = 'http://' + finalUrl;
      if (!finalUrl.includes(':', 6) && finalUrl.split('.').length === 4) finalUrl = finalUrl + ':3000';
      localStorage.setItem('__roms_server_ip', finalUrl);
      axios.defaults.baseURL = finalUrl;
    } else {
      localStorage.removeItem('__roms_server_ip');
      delete axios.defaults.baseURL;
    }

    try {
      await login(email, password);
      // Use window.location.href instead of navigate to force a full reload.
      // This ensures that the Socket.IO connection is initialized with the new IP address.
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const autoScanNetwork = async () => {
    setScanning(true);
    setError('');

    // Most common Indian router subnets: 1.x, 0.x, 29.x(Jio), 100.x(Airtel) 
    const subnets = ['192.168.1', '192.168.0', '192.168.29', '192.168.100', '10.0.0'];
    let foundIp = '';

    // Fast check: we test IP .2 to .50 to keep it incredibly fast (most DHCP assigns in this range)
    for (const subnet of subnets) {
      if (foundIp) break;
      const promises = [];
      for (let i = 2; i <= 50; i++) {
        const ip = `http://${subnet}.${i}:3000`;
        promises.push(
          axios.get(`${ip}/api/menu`, { timeout: 1500 }).then(() => ip).catch(() => null)
        );
      }
      const results = await Promise.all(promises);
      foundIp = results.find(ip => ip !== null) || '';
    }

    if (foundIp) {
      setServerUrl(foundIp);
      setError(`Server found at ${foundIp}`);
    } else {
      setError('Could not auto-find server. Ensure both devices are on the same WiFi and the Main PC app is open.');
    }
    setScanning(false);
  };


  const orbVariants = {
    animate: (i: number) => ({
      scale: [1, 1.15, 1],
      opacity: [0.15, 0.25, 0.15],
      transition: { duration: 4 + i * 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 },
    }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #0a0a0f 100%)' }}>

      {/* Animated Background Orbs */}
      <motion.div custom={0} variants={orbVariants} animate="animate"
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
      <motion.div custom={1} variants={orbVariants} animate="animate"
        className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
      <motion.div custom={2} variants={orbVariants} animate="animate"
        className="absolute top-[50%] left-[30%] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo — slides down */}
        <motion.div
          className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <motion.div
            className="relative mb-4"
            whileHover={{ scale: 1.08, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <motion.div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 20px rgba(249,115,22,0.5)' }}
              animate={{ boxShadow: ['0 4px 20px rgba(249,115,22,0.4)', '0 8px 40px rgba(249,115,22,0.7)', '0 4px 20px rgba(249,115,22,0.4)'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <UtensilsCrossed className="text-white w-10 h-10" />
            </motion.div>
          </motion.div>
          <motion.h1
            className="text-3xl font-black text-white tracking-tight"
            initial={{ opacity: 0, letterSpacing: '0.3em' }}
            animate={{ opacity: 1, letterSpacing: '-0.02em' }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            ROMS
          </motion.h1>
          <motion.p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            Restaurant Order Management System
          </motion.p>
        </motion.div>

        {/* Card — slides up */}
        <motion.div
          className="glass rounded-3xl p-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        >
          <motion.h2 className="text-xl font-bold text-white mb-6"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
            Sign in to continue
          </motion.h2>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 p-4 rounded-2xl text-sm badge-new overflow-hidden"
              >
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Fields stagger in */}
            {[
              {
                label: 'Email or Username',
                icon: <Users size={16} />,
                node: (
                  <input type="text" required className="input-dark pl-11" placeholder="admin / orders@roms.com"
                    value={email} onChange={e => setEmail(e.target.value)} id="login-email" />
                ),
              },
              {
                label: 'Password',
                icon: <LogIn size={16} />,
                node: (
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} required className="input-dark pl-11 pr-12"
                      placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} id="login-password" />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                      <LogIn size={16} />
                    </div>
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:text-orange-400"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ),
              },
              {
                label: 'Server IP',
                icon: <Wifi size={16} />,
                node: (
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <input type="text" className="input-dark pl-11 pr-4 w-full"
                        placeholder="e.g. 192.168.1.5" value={serverUrl} onChange={e => setServerUrl(e.target.value)} id="login-ip" />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                        <Wifi size={16} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={autoScanNetwork}
                      disabled={scanning}
                      className="px-4 bg-white/5 border border-white/10 rounded-xl text-white font-bold transition hover:bg-orange-500/20 hover:border-orange-500/40 disabled:opacity-50 flex items-center justify-center shrink-0"
                    >
                      {scanning ? (
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search size={18} className="text-orange-500" />
                      )}
                    </button>
                  </div>
                ),
              },
            ].map((field, i) => (
              <motion.div key={field.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ml-1"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>{field.label}</label>
                <div className="relative">
                  {i === 0 && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">{field.icon}</div>}
                  {field.node}
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              <motion.button
                type="submit"
                disabled={loading}
                id="login-submit"
                className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 mt-4 overflow-hidden relative group"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-20deg]" />
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (<><LogIn size={20} /> <span className="tracking-wide uppercase text-sm">Sign In</span></>)}
              </motion.button>
            </motion.div>
          </form>



        </motion.div>
      </div>
    </div>
  );
}
