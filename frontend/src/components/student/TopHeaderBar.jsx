import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import useAuthStore from '../../store/authStore';

const TopHeaderBar = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    // Dynamic time of day greeting matching SDMS
    const timeGreeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour >= 4 && hour < 12) {
            return 'Good Morning';
        } else if (hour >= 12 && hour < 17) {
            return 'Good Afternoon';
        } else if (hour >= 17 && hour < 22) {
            return 'Good Evening';
        } else {
            return 'Good Night';
        }
    }, []);

    const displayName = user?.name || user?.student_name || user?.username || 'User';
    const initialLetter = displayName.charAt(0).toUpperCase() || 'U';

    return (
        <header className="sticky -top-4 lg:-top-6 z-30 bg-[#f8fafc]/95 backdrop-blur-md flex items-center justify-between py-2.5 px-4 lg:px-8 -mx-4 lg:-mx-8 -mt-4 lg:-mt-6 mb-6 transition-all border-b border-slate-200/70 shadow-2xs min-h-[56px]">
            {/* Left: Portal mark and greeting */}
            <div className="flex items-center gap-3 shrink-0 min-w-0">
                <button
                    type="button"
                    onClick={() => navigate('/student/dashboard')}
                    aria-label="Go to student dashboard"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm transition-colors "
                >
                    <Wrench size={18} />
                </button>
                <div className="flex items-center border-l border-slate-300/80 pl-3 h-6 sm:h-7 min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5 truncate leading-none">
                        <span>{timeGreeting}</span>
                        <span className="text-sky-600">!</span>
                    </span>
                </div>
            </div>

            {/* Right: Quick Portal Status Badge & Profile Initial Avatar */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                {(user?.role === 'super_admin' || user?.role === 'admin') && (
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600   text-white text-xs font-semibold shadow-xs  transition-all cursor-pointer"
                        title="Open Admin Portal"
                    >
                        <span>Admin Portal</span>
                        <span className="text-[11px]">›</span>
                    </button>
                )}

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                    <span>Support Portal</span>
                </div>

                {/* Profile Initial Avatar */}
                <div
                    className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 aspect-square rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-xs border-2 border-blue-200 font-bold text-xs sm:text-sm uppercase select-none cursor-pointer  transition-colors"
                    title={displayName}
                >
                    {user?.student_photo ? (
                        <img src={user.student_photo} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                        initialLetter
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopHeaderBar;
