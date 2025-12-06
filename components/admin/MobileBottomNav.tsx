'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  Menu,
  Plus,
  X,
  ChevronRight,
  // Dashboard submodules
  BarChart3,
  Bell,
  // User Management submodules
  UserPlus,
  Shield,
  // Content submodules
  Home,
  Layers,
  Navigation,
  Video,
  Award,
  Image as ImageIcon,
  // Activities
  Sparkles,
  Tag,
  // System
  Settings,
  type LucideIcon,
} from 'lucide-react'

// ============================================
// Types (from floating-bottom-nav skill)
// ============================================
interface SubModule {
  id: string
  label: string
  icon?: LucideIcon
  href: string
  badge?: number
  description?: string
}

interface ParentModule {
  id: string
  label: string
  icon: LucideIcon
  href?: string
  badge?: number
  subModules?: SubModule[]
  color?: string
}

// ============================================
// Admin Navigation Modules Configuration
// ============================================
const adminModules: ParentModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/admin/dashboard',
    color: 'bg-blue-500',
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    color: 'bg-green-500',
    subModules: [
      {
        id: 'all-users',
        label: 'All Users',
        icon: Users,
        href: '/admin/users',
        description: 'View and manage users',
      },
      {
        id: 'roles',
        label: 'Roles',
        icon: Shield,
        href: '/admin/roles',
        description: 'Manage user roles',
      },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: FileText,
    color: 'bg-purple-500',
    subModules: [
      {
        id: 'pages',
        label: 'Pages',
        icon: FileText,
        href: '/admin/pages',
        description: 'Manage website pages',
      },
      {
        id: 'navigation',
        label: 'Navigation',
        icon: Navigation,
        href: '/admin/content/navigation',
        description: 'Site navigation menus',
      },
      {
        id: 'sections',
        label: 'Home Sections',
        icon: Layers,
        href: '/admin/content/sections',
        description: 'Homepage sections',
      },
      {
        id: 'hero',
        label: 'Hero Section',
        icon: Home,
        href: '/admin/content/hero-sections',
        description: 'Hero banners & slides',
      },
      {
        id: 'announcements',
        label: 'Announcements',
        icon: Bell,
        href: '/admin/content/announcements',
        description: 'News & announcements',
      },
      {
        id: 'videos',
        label: 'Videos',
        icon: Video,
        href: '/admin/content/videos',
        description: 'Campus videos',
      },
      {
        id: 'media',
        label: 'Media Library',
        icon: ImageIcon,
        href: '/admin/media',
        description: 'Images & files',
      },
    ],
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: Sparkles,
    color: 'bg-orange-500',
    subModules: [
      {
        id: 'all-activities',
        label: 'All Activities',
        icon: Sparkles,
        href: '/admin/activities',
        description: 'View all activities',
      },
      {
        id: 'categories',
        label: 'Categories',
        icon: Tag,
        href: '/admin/activities/categories',
        description: 'Activity categories',
      },
    ],
  },
  {
    id: 'inquiries',
    label: 'Inquiries',
    icon: MessageSquare,
    href: '/admin/inquiries',
    badge: 3,
    color: 'bg-red-500',
  },
]

// ============================================
// Quick Actions for FAB
// ============================================
interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  href: string
  color: string
}

const quickActions: QuickAction[] = [
  {
    id: 'activity',
    label: 'New Activity',
    icon: Sparkles,
    href: '/admin/activities/new',
    color: 'bg-purple-500',
  },
  {
    id: 'page',
    label: 'New Page',
    icon: FileText,
    href: '/admin/pages/new',
    color: 'bg-blue-500',
  },
  {
    id: 'media',
    label: 'Upload Media',
    icon: ImageIcon,
    href: '/admin/media',
    color: 'bg-green-500',
  },
]

// ============================================
// Component Props
// ============================================
interface MobileBottomNavProps {
  onMenuClick: () => void
}

// ============================================
// Main Component
// ============================================
export function MobileBottomNav({ onMenuClick }: MobileBottomNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetModuleId, setSheetModuleId] = useState<string | null>(null)
  const [isFabOpen, setIsFabOpen] = useState(false)

  const sheetModule = adminModules.find((m) => m.id === sheetModuleId)
  const isSheetOpen = !!sheetModuleId

  // Determine active module from pathname
  const getActiveModule = () => {
    for (const navModule of adminModules) {
      if (navModule.href && pathname?.startsWith(navModule.href)) {
        return navModule.id
      }
      if (navModule.subModules) {
        for (const sub of navModule.subModules) {
          if (pathname?.startsWith(sub.href)) {
            return navModule.id
          }
        }
      }
    }
    return 'dashboard'
  }

  const activeModuleId = getActiveModule()

  // Close sheet/fab on navigation
  useEffect(() => {
    setSheetModuleId(null)
    setIsFabOpen(false)
  }, [pathname])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheetModuleId(null)
        setIsFabOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Prevent body scroll when sheet/fab is open
  useEffect(() => {
    if (isSheetOpen || isFabOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isSheetOpen, isFabOpen])

  const handleModuleClick = useCallback((navModule: ParentModule) => {
    if (navModule.subModules && navModule.subModules.length > 0) {
      setSheetModuleId((prev) => (prev === navModule.id ? null : navModule.id))
      setIsFabOpen(false)
    } else if (navModule.href) {
      router.push(navModule.href)
      setSheetModuleId(null)
    }
  }, [router])

  const handleSubModuleClick = useCallback((subModule: SubModule) => {
    router.push(subModule.href)
    setSheetModuleId(null)
  }, [router])

  return (
    <>
      {/* ============================================ */}
      {/* Backdrop for Sheet or FAB */}
      {/* ============================================ */}
      <AnimatePresence>
        {(isSheetOpen || isFabOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => {
              setSheetModuleId(null)
              setIsFabOpen(false)
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* Bottom Sheet for Submodules */}
      {/* ============================================ */}
      <AnimatePresence>
        {isSheetOpen && sheetModule && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={sheetModule.label}
          >
            <div
              className="bg-white rounded-t-3xl shadow-2xl"
              style={{
                maxHeight: '70vh',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-4 pb-2">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* Sheet Header */}
              <div className="flex items-center justify-between px-5 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${sheetModule.color || 'bg-[#0b6d41]'}`}>
                    <sheetModule.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {sheetModule.label}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {sheetModule.subModules?.length} items
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSheetModuleId(null)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Submodules List */}
              <div
                className="overflow-y-auto px-4 py-3"
                style={{ maxHeight: 'calc(70vh - 120px)' }}
              >
                <div className="space-y-2">
                  {sheetModule.subModules?.map((subModule, index) => {
                    const SubIcon = subModule.icon
                    const isActive = pathname?.startsWith(subModule.href)

                    return (
                      <motion.button
                        key={subModule.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleSubModuleClick(subModule)}
                        className={`
                          w-full flex items-center gap-4 p-4 rounded-2xl
                          transition-all duration-200 text-left
                          ${isActive
                            ? 'bg-[#0b6d41]/10 border-2 border-[#0b6d41]'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100 active:bg-[#0b6d41] active:text-white'
                          }
                        `}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        {SubIcon && (
                          <div
                            className={`
                              p-3 rounded-xl transition-colors
                              ${isActive ? 'bg-[#0b6d41] text-white' : 'bg-white text-gray-600'}
                            `}
                          >
                            <SubIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold ${isActive ? 'text-[#0b6d41]' : 'text-gray-800'}`}
                            >
                              {subModule.label}
                            </span>
                            {subModule.badge !== undefined && subModule.badge > 0 && (
                              <span className="min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                {subModule.badge > 99 ? '99+' : subModule.badge}
                              </span>
                            )}
                          </div>
                          {subModule.description && (
                            <p className="text-sm text-gray-500 mt-0.5">
                              {subModule.description}
                            </p>
                          )}
                        </div>
                        <ChevronRight
                          className={`w-5 h-5 ${isActive ? 'text-[#0b6d41]' : 'text-gray-400'}`}
                        />
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* FAB Quick Actions Bottom Sheet */}
      {/* ============================================ */}
      <AnimatePresence>
        {isFabOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-50 lg:hidden"
          >
            <div className="bg-white rounded-t-3xl shadow-2xl">
              {/* Drag Handle */}
              <div className="flex justify-center pt-4 pb-2">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-3 border-b border-gray-100">
                <h3 className="text-lg font-bold text-[#0b6d41]">Quick Actions</h3>
                <p className="text-sm text-gray-500">Create new content quickly</p>
              </div>

              {/* Quick Actions */}
              <nav className="px-4 py-4 space-y-2">
                {quickActions.map((action, index) => {
                  const Icon = action.icon
                  return (
                    <motion.div
                      key={action.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={action.href}
                        onClick={() => setIsFabOpen(false)}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 active:bg-[#0b6d41] active:text-white transition-all"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className={`w-10 h-10 rounded-full ${action.color} flex items-center justify-center`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-semibold">{action.label}</span>
                      </Link>
                    </motion.div>
                  )
                })}
              </nav>

              {/* Cancel */}
              <div className="px-4 pb-6">
                <button
                  onClick={() => setIsFabOpen(false)}
                  className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* Main Navigation Bar - Website Style */}
      {/* ============================================ */}
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed bottom-2 left-2 right-2 z-30 lg:hidden rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0b6d41 0%, #0a5d37 100%)',
          boxShadow: '0 4px 24px rgba(11, 109, 65, 0.5), 0 -4px 20px rgba(11, 109, 65, 0.3)',
        }}
        role="navigation"
        aria-label="Admin navigation"
      >
        {/* Top border accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#ffde59] via-[#fbfbee] to-[#ffde59] opacity-80" />

        <div className="px-1 py-1.5 pb-safe">
          <div className="flex items-center justify-around">
            {/* Navigation Items (Left) */}
            {adminModules.slice(0, 2).map((navModule) => {
              const Icon = navModule.icon
              const isActive = activeModuleId === navModule.id
              const isExpanded = sheetModuleId === navModule.id
              const hasSubModules = navModule.subModules && navModule.subModules.length > 0

              return (
                <button
                  key={navModule.id}
                  onClick={() => handleModuleClick(navModule)}
                  className="relative flex flex-col items-center justify-center min-w-[50px] py-1 px-1.5"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  aria-current={isActive && !hasSubModules ? 'page' : undefined}
                  aria-expanded={hasSubModules ? isExpanded : undefined}
                  aria-haspopup={hasSubModules ? 'dialog' : undefined}
                >
                  <div className="relative">
                    {/* Active glow */}
                    {(isActive || isExpanded) && (
                      <motion.div
                        layoutId="adminNavGlow"
                        className="absolute inset-0 -m-2 rounded-full"
                        style={{
                          background: 'radial-gradient(circle, rgba(255, 222, 89, 0.4) 0%, transparent 70%)',
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    <Icon
                      className={`w-[18px] h-[18px] transition-all duration-300 ${
                        isActive || isExpanded
                          ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                          : 'text-white/60'
                      }`}
                      strokeWidth={isActive || isExpanded ? 2.5 : 2}
                    />
                    {navModule.badge !== undefined && navModule.badge > 0 && (
                      <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {navModule.badge > 9 ? '9+' : navModule.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-medium mt-0.5 transition-all ${
                      isActive || isExpanded ? 'text-white' : 'text-white/60'
                    }`}
                  >
                    {navModule.label}
                  </span>
                  {/* Submodule indicator */}
                  {hasSubModules && (
                    <div className="flex gap-0.5 mt-0.5">
                      {[...Array(Math.min(3, navModule.subModules!.length))].map((_, i) => (
                        <div key={i} className="w-0.5 h-0.5 rounded-full bg-white/40" />
                      ))}
                    </div>
                  )}
                  {/* Active dot */}
                  {(isActive || isExpanded) && (
                    <motion.div
                      layoutId="adminNavDot"
                      className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                      style={{ backgroundColor: '#ffde59' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}

            {/* Center FAB Button */}
            <motion.button
              type="button"
              onClick={() => {
                setIsFabOpen(!isFabOpen)
                setSheetModuleId(null)
              }}
              className="relative flex items-center justify-center w-14 h-14 -mt-5 rounded-full bg-white text-[#0b6d41]"
              whileTap={{ scale: 0.95 }}
              animate={{ rotate: isFabOpen ? 45 : 0 }}
              transition={{ duration: 0.2 }}
              style={{
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 4px rgba(255, 222, 89, 0.3)',
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-expanded={isFabOpen}
              aria-label={isFabOpen ? 'Close quick actions' : 'Open quick actions'}
            >
              {/* Pulsing glow */}
              {!isFabOpen && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-white"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}
              {isFabOpen ? (
                <X className="w-6 h-6 relative z-10" strokeWidth={2.5} />
              ) : (
                <Plus className="w-7 h-7 relative z-10" strokeWidth={2.5} />
              )}
            </motion.button>

            {/* Navigation Items (Right) */}
            {adminModules.slice(2, 4).map((navModule) => {
              const Icon = navModule.icon
              const isActive = activeModuleId === navModule.id
              const isExpanded = sheetModuleId === navModule.id
              const hasSubModules = navModule.subModules && navModule.subModules.length > 0

              return (
                <button
                  key={navModule.id}
                  onClick={() => handleModuleClick(navModule)}
                  className="relative flex flex-col items-center justify-center min-w-[50px] py-1 px-1.5"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  aria-current={isActive && !hasSubModules ? 'page' : undefined}
                  aria-expanded={hasSubModules ? isExpanded : undefined}
                  aria-haspopup={hasSubModules ? 'dialog' : undefined}
                >
                  <div className="relative">
                    {(isActive || isExpanded) && (
                      <motion.div
                        layoutId="adminNavGlow"
                        className="absolute inset-0 -m-2 rounded-full"
                        style={{
                          background: 'radial-gradient(circle, rgba(255, 222, 89, 0.4) 0%, transparent 70%)',
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    <Icon
                      className={`w-[18px] h-[18px] transition-all duration-300 ${
                        isActive || isExpanded
                          ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                          : 'text-white/60'
                      }`}
                      strokeWidth={isActive || isExpanded ? 2.5 : 2}
                    />
                    {navModule.badge !== undefined && navModule.badge > 0 && (
                      <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {navModule.badge > 9 ? '9+' : navModule.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-medium mt-0.5 transition-all ${
                      isActive || isExpanded ? 'text-white' : 'text-white/60'
                    }`}
                  >
                    {navModule.label}
                  </span>
                  {hasSubModules && (
                    <div className="flex gap-0.5 mt-0.5">
                      {[...Array(Math.min(3, navModule.subModules!.length))].map((_, i) => (
                        <div key={i} className="w-0.5 h-0.5 rounded-full bg-white/40" />
                      ))}
                    </div>
                  )}
                  {(isActive || isExpanded) && (
                    <motion.div
                      layoutId="adminNavDot"
                      className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                      style={{ backgroundColor: '#ffde59' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}

            {/* More Menu Button */}
            <button
              type="button"
              onClick={onMenuClick}
              className="relative flex flex-col items-center justify-center min-w-[50px] py-1 px-1.5 active:scale-95 transition-transform"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Open sidebar menu"
            >
              <Menu className="w-[18px] h-[18px] text-white/60" strokeWidth={2} />
              <span className="text-[9px] font-medium mt-0.5 text-white/60">More</span>
            </button>
          </div>
        </div>

        {/* Safe area padding */}
        <style jsx>{`
          .pb-safe {
            padding-bottom: max(0.375rem, env(safe-area-inset-bottom));
          }
        `}</style>
      </motion.nav>
    </>
  )
}
