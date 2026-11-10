import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Loader2, Eye, EyeOff, Users, Wrench, ClipboardCheck, CircleCheck } from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

import { motion } from 'framer-motion';

const Login = ({ isStudent = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated, userType } = useAuthStore();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Use prop or fallback to route check (though prop is preferred now)
    const isStudentLogin = isStudent || location.pathname.startsWith('/student/login');

    useEffect(() => {
        if (isAuthenticated) {
            const currentUser = useAuthStore.getState().user;
            if (currentUser?.role === 'super_admin' || currentUser?.role === 'admin') {
                navigate('/dashboard');
            } else if (userType === 'student' || userType === 'requester') {
                navigate('/student/dashboard');
            } else if (currentUser?.role === 'worker' || currentUser?.is_worker) {
                navigate('/task-management');
            } else {
                navigate('/dashboard');
            }
        }
    }, [isAuthenticated, navigate, userType]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.username || !formData.password) {
            toast.error('Please fill in all fields');
            return;
        }

        setLoading(true);

        const result = await login(formData.username, formData.password);

        setLoading(false);

        if (result.success) {
            toast.success('Login successful!');
            navigate(result.redirectPath);
        } else {
            toast.error(result.message);
        }
    };

    return (
        <main className="login-page relative grid min-h-screen grid-cols-1 items-center gap-8 overflow-hidden px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)] lg:gap-16 lg:px-[8vw]">
            <div aria-hidden="true" className="login-orb login-orb-one" />
            <div aria-hidden="true" className="login-orb login-orb-two" />

            <section className="login-hero relative z-10 mx-auto hidden w-full max-w-xl lg:block">
                <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-300 shadow-lg backdrop-blur">
                    <Wrench size={26} strokeWidth={1.8} />
                </div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                    {isStudentLogin ? 'Student services' : 'Support & maintenance'}
                </p>
                <h1 className="max-w-lg text-5xl font-semibold leading-[1.12] tracking-tight text-white xl:text-6xl">
                    A better way to keep things <span className="text-emerald-300">running.</span>
                </h1>
                <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                    Submit a request, follow its progress, and get back to what matters.
                </p>

                <div aria-hidden="true" className="login-illustration mt-12 max-w-md">
                    <div className="login-illustration-glow" />
                    <div className="login-ticket-card">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-sm font-medium text-white">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                                    <ClipboardCheck size={17} />
                                </span>
                                Maintenance request
                            </span>
                            <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">In progress</span>
                        </div>
                        <div className="mt-6 h-2 w-4/5 rounded-full bg-white/15" />
                        <div className="mt-3 h-2 w-3/5 rounded-full bg-white/10" />
                        <div className="mt-6 flex items-center gap-2 text-xs text-slate-300">
                            <CircleCheck size={15} className="text-emerald-300" />
                            Your request is being taken care of
                        </div>
                    </div>
                    <div className="login-illustration-orbit login-illustration-orbit-one" />
                    <div className="login-illustration-orbit login-illustration-orbit-two" />
                </div>
            </section>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="login-card relative z-10 mx-auto w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-10 lg:justify-self-end"
            >
                <header className="mb-8 text-center">
                    <div aria-hidden="true" className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1A2517] text-emerald-300 shadow-lg shadow-[#1A2517]/20">
                        <Wrench size={25} strokeWidth={1.8} />
                    </div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#61734f]">
                        {isStudentLogin ? 'Student ' : ''}Support Portal
                    </p>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                        Welcome back
                    </h2>
                    <p className="mt-2 text-sm text-gray-500">
                        Sign in to manage and track your requests.
                    </p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="login-username" className="mb-2 block text-sm font-medium text-gray-700">
                            Username / Admission No / Employee ID
                        </label>
                        <div className="group relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Users className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-[#1A2517]" />
                            </div>
                            <input
                                id="login-username"
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                autoComplete="username"
                                className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-3 pl-10 text-base text-gray-900 placeholder-gray-400 transition-all focus:border-[#1A2517] focus:outline-none focus:ring-4 focus:ring-[#1A2517]/10"
                                placeholder="Enter Username, Admission No, or Employee ID"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-gray-700">
                            Password
                        </label>
                        <div className="group relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <LogIn className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-[#1A2517]" />
                            </div>
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                autoComplete="current-password"
                                className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-3 pl-10 pr-11 text-base text-gray-900 placeholder-gray-400 transition-all focus:border-[#1A2517] focus:outline-none focus:ring-4 focus:ring-[#1A2517]/10"
                                placeholder="Enter your password"
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors "
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center rounded-xl bg-[#1A2517] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#1A2517]/20 transition-all   disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="-ml-1 mr-2 h-5 w-5 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        type="button"
                        onClick={() => toast('Please contact administrator to reset password')}
                        className="text-sm font-medium text-[#1A2517] transition-colors "
                    >
                        Forgot Password?
                    </button>
                </div>

                <footer className="mt-8 border-t border-gray-100 pt-5 text-center text-xs text-gray-400">
                    © {new Date().getFullYear()} Support &amp; Ticket Management System
                </footer>
            </motion.div>
        </main>
    );
};

export default Login;
