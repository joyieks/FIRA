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
    <nav className="bg-white shadow-md w-full z-10 sticky top-0 left-0 text-gray-800">
      <div className="w-full pl-30 pr-2 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/finalogo.jpg" alt="Project FIRA" className="w-10 h-10" />
          <button onClick={() => scrollToId('home')} className="font-bold text-red-700 hover:text-amber-600">
            Project FIRA
          </button>
        </div>

        <div className="hidden md:block">
          <ul className="flex items-center gap-10 text-gray-700">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => scrollToId(s.id, setActive, setLockUntil)}
                  className={`group relative py-1 transition-colors ${active === s.id ? 'text-red-700' : 'hover:text-red-700'}`}
                >
                  {s.label}
                  <span className={`pointer-events-none absolute -bottom-1 left-0 h-[2px] rounded-full transition-all ${active === s.id ? 'w-full bg-red-700' : 'w-0 bg-red-700 group-hover:w-full'}`}></span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 mr-6 md:mr-10">
          <button className="hidden md:flex items-center gap-2 text-1xl font-bold text-gray-700 hover:bg-red-700 hover:text-white rounded-full px-5 py-2 duration-200"
            onClick={() => navigate('/login')}>
            <CiUser /> Login
          </button>
          <button className="md:hidden p-2" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            {open ? <HiOutlineX size={22} /> : <HiOutlineMenuAlt3 size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <ul className="px-5 py-3 space-y-2">
            {sections.map((s) => (
              <li key={s.id}>
                <button onClick={() => { setOpen(false); scrollToId(s.id) }} className="block w-full text-left py-2 hover:text-red-700 text-gray-700">
                  {s.label}
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => { setOpen(false); navigate('/login') }} className="flex items-center gap-2 font-bold text-gray-700 hover:text-red-700 py-2">
                <CiUser /> Login
              </button>
            </li>
          </ul>
        </div>
      )}
    </nav>
  )
}

export default Navbar