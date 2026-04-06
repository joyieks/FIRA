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
    <main className="bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900">
      <Section id="home">
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-red-900 to-slate-900">
          <img src="/fire1.jpg" alt="Fire response" className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay will-change-transform" id="hero-bg" />
          <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-red-500/30 blur-3xl animate-pulse-slow" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-orange-500/20 blur-3xl animate-pulse-slower" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="relative max-w-5xl mx-auto px-6 md:px-8 py-32 text-center">
            <h1 className="reveal opacity-0 translate-y-6 text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
              Rapid Incident<br className="hidden md:block" /> Response for Safer<br className="hidden md:block" /> Communities
            </h1>
            <p className="reveal opacity-0 translate-y-6 mt-6 text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto leading-relaxed font-light">
              Project FIRA connects citizens, responders, and stations with real-time alerts, mapping, and coordination.
            </p>
            <div className="reveal opacity-0 translate-y-6 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6">
              <a href="#contact" onClick={(e) => { e.preventDefault(); document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }) }}
                 className="inline-flex rounded-full bg-red-600 text-white px-8 py-3.5 font-semibold hover:bg-transparent hover:border-2 hover:border-red-500 border-2 border-red-600 duration-300 transition-all">Contact Us</a>
              <a href="#about" onClick={(e) => { e.preventDefault(); document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }) }}
                 className="inline-flex rounded-full border-2 border-white text-white px-8 py-3.5 font-semibold hover:bg-transparent duration-300 transition-all backdrop-blur-sm">Learn More</a>
            </div>
          </div>
        </div>
      </Section>

      <Section id="about">
        <div className="bg-gradient-to-b from-gray-900 to-slate-800 py-24 md:py-32">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
              <img src="/fire2.jpg" alt="About FIRA" className="reveal opacity-0 translate-y-6 rounded-2xl shadow-2xl shadow-red-500/20 object-cover w-full h-auto" />
              <div className="reveal opacity-0 translate-y-6">
                <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">About Project FIRA</h2>
                <p className="mt-6 text-lg text-gray-300 leading-relaxed font-light">
                  We streamline emergency workflows: citizen reporting, dispatcher coordination, and responder tracking with secure data and modern UX.
                </p>
                <div className="mt-10 space-y-5">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white shrink-0 shadow-lg">
                      <FiBell size={24} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-white text-lg">Real-time Alerts</h3>
                      <p className="mt-1 text-gray-400">Unified alerts keep citizens, responders, and stations in sync instantly.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white shrink-0 shadow-lg">
                      <FiMap size={24} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-white text-lg">Live Mapping</h3>
                      <p className="mt-1 text-gray-400">Incident locations, routes, and coverage areas at a glance.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-rose-600 text-white shrink-0 shadow-lg">
                      <FiShield size={24} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-white text-lg">Secure Data</h3>
                      <p className="mt-1 text-gray-400">Role-based access and modern security practices protecting sensitive data.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 grid grid-cols-3 divide-x divide-gray-700 rounded-2xl bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 shadow-sm">
                  {[{
                    label: 'Incidents Tracked', value: '1,200+'
                  }, { label: 'Responders Onboarded', value: '350+' }, { label: 'Uptime', value: '99.9%' }].map(({ label, value }) => (
                    <div key={label} className="px-6 py-5 text-center">
                      <div className="text-3xl font-extrabold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">{value}</div>
                      <div className="text-sm text-gray-400 font-medium mt-2">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section id="services">
        <div className="bg-gradient-to-b from-gray-900 to-gray-800 py-24 md:py-32">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="text-center mb-16">
              <h2 className="reveal opacity-0 translate-y-6 text-4xl md:text-5xl font-bold text-white leading-tight">Core Services</h2>
              <p className="reveal opacity-0 translate-y-6 mt-4 text-lg text-gray-300 max-w-2xl mx-auto">Everything you need for effective emergency response and coordination.</p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8">
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
                <div key={title} className="reveal card-tilt opacity-0 translate-y-6 group p-8 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-red-500/50 shadow-lg hover:shadow-2xl hover:shadow-red-500/20 duration-300 transition-all hover:-translate-y-1">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 text-red-400 group-hover:from-red-500/40 group-hover:to-orange-500/40 transition-all duration-300">
                      <Icon size={26} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white group-hover:text-red-400 transition-colors">{title}</h3>
                      <p className="mt-2 text-gray-400 group-hover:text-gray-300 transition-colors text-sm leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="team">
        <div className="bg-gradient-to-b from-slate-800 to-gray-900 py-24 md:py-32">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="reveal opacity-0 translate-y-6 text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">Meet Our Team</h2>
              <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto font-light">A multidisciplinary group focused on reliability, usability, and safety.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
              {[{
                role: 'Hustler', name: 'Eijay Pepito', img: '/eijay.jpg'
              },{
                role: 'Hipster', name: 'Joan Joy Diocampo', img: '/joanjoy.JPG'
              },{
                role: 'Hacker', name: 'Kenji Parilla', img: '/kenji.jpg'
              },{
                role: 'Writer', name: 'Jashmine Verdida', img: '/jash.JPG'
              }].map(({ role, name, img }) => (
                <div key={name} className="group overflow-hidden rounded-2xl bg-gray-800 border-2 border-gray-700 hover:border-red-500/50 shadow-md hover:shadow-2xl hover:shadow-red-500/15 transition-all duration-300 hover:-translate-y-1">
                  <div className="relative h-64 md:h-72 w-full overflow-hidden">
                    <img src={img} alt={name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" onError={(e) => { e.currentTarget.src = '/fire2.png' }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-gray-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="p-5 text-center bg-gradient-to-b from-gray-800 to-gray-700">
                    <div className="text-sm uppercase tracking-widest font-bold bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">{role}</div>
                    <div className="mt-2 text-lg font-bold text-white">{name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="contact">
        <div className="bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 py-24 md:py-32 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none absolute -top-40 -right-40 w-80 h-80 rounded-full bg-red-500/20 blur-3xl animate-pulse-slow" />
            <div className="pointer-events-none absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-orange-500/10 blur-3xl animate-pulse-slower" />
          </div>
          <div className="relative max-w-3xl mx-auto px-6 md:px-8 text-center">
            <h2 className="reveal opacity-0 translate-y-6 text-4xl md:text-5xl font-bold text-white leading-tight">Get in Touch</h2>
            <p className="reveal opacity-0 translate-y-6 mt-6 text-lg text-gray-200">Email us to learn more or request a demo.</p>
            <a href="mailto:projectfira2025@gmail.com" className="reveal opacity-0 translate-y-6 inline-flex rounded-full bg-red-600 text-white px-8 py-3.5 font-semibold mt-8 hover:bg-transparent hover:border-2 hover:border-red-500 border-2 border-red-600 duration-300 transition-all">projectfira2025@gmail.com</a>
            <div className="reveal opacity-0 translate-y-6 mt-16 pt-12 border-t border-white/20">
              <h3 className="text-2xl font-bold text-white">Sponsors & Partners</h3>
              <p className="mt-3 text-gray-300 font-light">In collaboration with Cebu BFP and partners</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                <span className="px-6 py-2.5 rounded-full bg-white/10 text-white border border-white/20 backdrop-blur-sm font-medium hover:bg-white/20 transition-all duration-300">Cebu BFP</span>
                <span className="px-6 py-2.5 rounded-full bg-white/10 text-white border border-white/20 backdrop-blur-sm font-medium hover:bg-white/20 transition-all duration-300">Local LGU</span>
                <span className="px-6 py-2.5 rounded-full bg-white/10 text-white border border-white/20 backdrop-blur-sm font-medium hover:bg-white/20 transition-all duration-300">Community Volunteers</span>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </main>
  )
}

export default hero