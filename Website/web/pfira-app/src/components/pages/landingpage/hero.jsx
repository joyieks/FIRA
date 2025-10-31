import React, { useEffect } from 'react'
import { FiBell, FiMap, FiUsers, FiShield, FiClock, FiDatabase } from 'react-icons/fi'

const Section = ({ id, children }) => (
  <section id={id} className="scroll-mt-24">
    {children}
  </section>
)

const hero = () => {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-show')
          }
        })
      },
      { threshold: 0.15 }
    )

    const elements = document.querySelectorAll('.reveal')
    elements.forEach((el) => observer.observe(el))

    const heroBg = document.getElementById('hero-bg')
    const onScroll = () => {
      const y = window.scrollY
      if (heroBg) heroBg.style.transform = `translateY(${y * 0.05}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => { 
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <main className="bg-neutral-900 text-gray-100">
      <Section id="home">
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-800 to-neutral-900">
          <img src="/fire1.png" alt="Fire response" className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-overlay will-change-transform" id="hero-bg" />
          <div className="pointer-events-none absolute -top-20 -left-20 w-80 h-80 rounded-full bg-red-600/20 blur-3xl animate-pulse-slow" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl animate-pulse-slower" />
          <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
            <h1 className="reveal opacity-0 translate-y-6 text-4xl md:text-6xl font-extrabold tracking-tight text-white">
              Rapid Incident Response for Safer Communities
            </h1>
            <p className="reveal opacity-0 translate-y-6 mt-4 text-lg md:text-xl text-gray-300">
              Project FIRA connects citizens, responders, and stations with real-time alerts, mapping, and coordination.
            </p>
            <div className="reveal opacity-0 translate-y-6 mt-8 flex items-center justify-center gap-4">
              <a href="#contact" onClick={(e) => { e.preventDefault(); document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }) }}
                 className="inline-flex rounded-full bg-red-600 text-white px-6 py-3 font-semibold hover:bg-red-700 duration-200">Contact Us</a>
              <a href="#about" onClick={(e) => { e.preventDefault(); document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }) }}
                 className="inline-flex rounded-full border border-red-500 text-red-300 px-6 py-3 font-semibold hover:bg-red-500/10 duration-200">Learn More</a>
            </div>
          </div>
        </div>
      </Section>

      <Section id="about">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-28">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <img src="/fire2.png" alt="About FIRA" className="reveal opacity-0 translate-y-6 rounded-xl shadow-md opacity-90" />
            <div className="reveal opacity-0 translate-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-white">About Project FIRA</h2>
              <p className="mt-4 text-gray-300 leading-relaxed">
                We streamline emergency workflows: citizen reporting, dispatcher coordination, and responder tracking with secure data and modern UX.
              </p>
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/15 text-red-400 shrink-0">
                    <FiBell size={18} />
                  </span>
                  <p className="text-gray-300">Unified alerts keep citizens, responders, and stations in sync in real time.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/15 text-red-400 shrink-0">
                    <FiMap size={18} />
                  </span>
                  <p className="text-gray-300">Live mapping for incidents, coverage areas, and optimal routing.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/15 text-red-400 shrink-0">
                    <FiShield size={18} />
                  </span>
                  <p className="text-gray-300">Role-based access and modern security practices to protect sensitive data.</p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-3 divide-x divide-neutral-700 rounded-xl bg-neutral-800/60">
                {[{
                  label: 'Incidents Tracked', value: '1,200+'
                }, { label: 'Responders Onboarded', value: '350+' }, { label: 'Uptime', value: '99.9%' }].map(({ label, value }) => (
                  <div key={label} className="px-5 py-4 text-center">
                    <div className="text-2xl font-extrabold text-white">{value}</div>
                    <div className="text-sm text-gray-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section id="services">
        <div className="bg-neutral-900">
          <div className="max-w-6xl mx-auto px-6 py-24 md:py-28">
            <h2 className="reveal opacity-0 translate-y-6 text-3xl md:text-4xl font-bold text-white text-center">Core Services</h2>
            <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[{
                title: 'Real-time Alerts',
                desc: 'Push notifications and status updates across roles.',
                Icon: FiBell,
              }, {
                title: 'Live Mapping',
                desc: 'Incident locations, routes, and coverage areas.',
                Icon: FiMap,
              }, {
                title: 'Team Coordination',
                desc: 'Chat, roles, and assignment tracking.',
                Icon: FiUsers,
              }, {
                title: 'Secure Data',
                desc: 'Role-based access, best-practice security, and privacy.',
                Icon: FiShield,
              }, {
                title: 'Data & Logs',
                desc: 'Incident history, exports, and audit trails.',
                Icon: FiDatabase,
              }, {
                title: '24/7 Reliability',
                desc: 'Always-on infra for critical operations.',
                Icon: FiClock,
              }].map(({ title, desc, Icon }) => (
                <div key={title} className="reveal card-tilt opacity-0 translate-y-6 p-6 rounded-xl bg-neutral-800 shadow-sm hover:shadow-md duration-200 border border-transparent hover:border-red-600/30">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg bg-red-600/15 text-red-400">
                      <Icon size={22} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-red-400">{title}</h3>
                      <p className="mt-1 text-gray-300">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="team">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-28">
          <div className="reveal opacity-0 translate-y-6 text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Our Team</h2>
            <p className="mt-4 text-gray-300 max-w-2xl mx-auto">A multidisciplinary group focused on reliability, usability, and safety.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[{
              role: 'Hustler', name: 'Eijay Pepito', img: '/eijay.jpg'
            },{
              role: 'Hipster', name: 'Joan Joy Diocampo', img: '/joanjoy.JPG'
            },{
              role: 'Hacker', name: 'Kenji Parilla', img: '/kenji.jpg'
            },{
              role: 'Writer', name: 'Jashmine Verdida', img: '/jash.JPG'
            }].map(({ role, name, img }) => (
              <div key={name} className="group overflow-hidden rounded-xl bg-neutral-800 border border-neutral-700 hover:border-red-600/40 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="relative h-56 md:h-64 w-full overflow-hidden">
                  <img src={img} alt={name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" onError={(e) => { e.currentTarget.src = '/fire2.png' }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 to-transparent" />
                </div>
                <div className="p-4">
                  <div className="text-sm uppercase tracking-wide text-red-400 font-semibold">{role}</div>
                  <div className="mt-1 text-lg text-gray-100 font-medium">{name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="contact">
        <div className="bg-neutral-900 mt-12 md:mt-16">
          <div className="max-w-3xl mx-auto px-6 py-24 md:py-28 text-center">
            <h2 className="reveal opacity-0 translate-y-6 text-3xl md:text-4xl font-bold text-white">Get in Touch</h2>
            <p className="reveal opacity-0 translate-y-6 mt-3 text-gray-300">Email us to learn more or request a demo.</p>
            <a href="mailto:projectfira2025@gmail.com" className="reveal opacity-0 translate-y-6 inline-flex rounded-full bg-red-600 text-white px-6 py-3 font-semibold mt-6 hover:bg-red-700 duration-200">projectfira2025@gmail.com</a>
            <div className="reveal opacity-0 translate-y-6 mt-12">
              <h3 className="text-xl font-semibold text-gray-200">Sponsors & Partners</h3>
              <p className="mt-2 text-gray-400">In collaboration with Cebu BFP and partners</p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                <span className="px-4 py-2 rounded-full bg-neutral-800 text-gray-200 border border-neutral-700">Cebu BFP</span>
                <span className="px-4 py-2 rounded-full bg-neutral-800 text-gray-200 border border-neutral-700">Local LGU</span>
                <span className="px-4 py-2 rounded-full bg-neutral-800 text-gray-200 border border-neutral-700">Community Volunteers</span>
              </div>
            </div>
          </div>
    </div>
      </Section>
    </main>
  )
}

export default hero