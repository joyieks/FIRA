import React, { useEffect, useState } from 'react'
import { CiUser } from "react-icons/ci"
import { HiOutlineMenuAlt3, HiOutlineX } from "react-icons/hi"
import { useNavigate } from 'react-router-dom'

const sections = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Services' },
  { id: 'team', label: 'Team' },
  { id: 'contact', label: 'Contact' },
]

const scrollToId = (id, setActiveCb, setLockUntilCb) => {
  const el = document.getElementById(id)
  if (!el) return
  if (setActiveCb) setActiveCb(id)
  if (setLockUntilCb) setLockUntilCb(Date.now() + 900)
  const headerOffset = 96
  const topTarget = Math.max(0, el.offsetTop - headerOffset)
  window.scrollTo({ top: topTarget, behavior: 'smooth' })
}

const Navbar = () => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('home')
  const [lockUntil, setLockUntil] = useState(0)

  useEffect(() => {
    const handler = () => {
      if (Date.now() < lockUntil) return
      const yCenter = window.scrollY + window.innerHeight / 3
      let current = sections[0].id
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (!el) continue
        const top = el.offsetTop
        const bottom = top + el.offsetHeight
        if (yCenter >= top && yCenter < bottom) {
          current = s.id
          break
        }
      }
      // if scrolled near the bottom, force last section active
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 2) {
        current = sections[sections.length - 1].id
      }
      setActive(current)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }, [lockUntil])

  return (
    <nav className="bg-white/95 backdrop-blur-md shadow-lg w-full z-10 sticky top-0 left-0 text-gray-900 border-b border-gray-200">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 shrink-0">
          <img src="/finalogo.jpg" alt="Project FIRA" className="w-11 h-11 rounded-lg object-cover shadow-sm" />
          <button onClick={() => scrollToId('home')} className="font-bold text-lg md:text-xl bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
            Project FIRA
          </button>
        </div>

        <div className="hidden md:block">
          <ul className="flex items-center gap-12 text-gray-700">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => scrollToId(s.id, setActive, setLockUntil)}
                  className={`group relative py-2 px-1 text-sm font-medium transition-colors duration-300 ${active === s.id ? 'text-red-700' : 'text-gray-600 hover:text-red-600'}`}
                >
                  {s.label}
                  <span className={`pointer-events-none absolute -bottom-1 left-0 h-0.5 rounded-full transition-all duration-300 bg-gradient-to-r from-red-600 to-red-500 ${active === s.id ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-4 mr-2 md:mr-0">
          <button className="hidden md:flex items-center gap-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-transparent hover:border-2 hover:border-red-600 hover:text-red-600 rounded-full px-6 py-2.5 duration-300 transition-all border-2 border-red-600"
            onClick={() => navigate('/login')}>
            <CiUser size={20} /> Login
          </button>
          <button className="md:hidden p-2.5 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            {open ? <HiOutlineX size={24} className="text-gray-700" /> : <HiOutlineMenuAlt3 size={24} className="text-gray-700" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-md">
          <ul className="px-6 py-4 space-y-2">
            {sections.map((s) => (
              <li key={s.id}>
                <button onClick={() => { setOpen(false); scrollToId(s.id) }} className="block w-full text-left py-2.5 px-3 hover:bg-red-50 rounded-lg text-gray-700 font-medium transition-colors hover:text-red-700">
                  {s.label}
                </button>
              </li>
            ))}
            <li className="pt-2 border-t border-gray-100">
              <button onClick={() => { setOpen(false); navigate('/login') }} className="flex items-center gap-2.5 font-semibold text-white bg-red-600 hover:bg-transparent hover:border-2 hover:border-red-600 hover:text-red-600 py-2.5 px-3 rounded-lg w-full justify-center text-sm mt-2 border-2 border-red-600 duration-300 transition-all">
                <CiUser size={20} /> Login
              </button>
            </li>
          </ul>
        </div>
      )}
    </nav>
  )
}

export default Navbar