import React from 'react'
import { CiUser } from "react-icons/ci"
import { useNavigate, Link } from 'react-router-dom'

const Navbar = () => {
  const navigate = useNavigate()
  
  return (
    <nav className="bg-white shadow-md w-full z-10 top-0 left-0">
      <div className="max-w-7xl mx-auto px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src="/burnhouse.jpg" alt="Project FIRA Logo" className="w-12 h-12" />
          <Link to="/" className="font-bold text-red-700 hover:text-amber-600">
            Project FIRA
          </Link>
        </div>
        
        <ul className="flex space-x-8 text-gray-700">
          <li>
            <Link to="/home" className="hover:text-red-700">Home</Link>
          </li>
          <li>
            <Link to="/about" className="hover:text-red-700">About</Link>
          </li>
          <li>
            <Link to="/services" className="hover:text-red-700">Services</Link>
          </li>
          <li>
            <Link to="/team" className="hover:text-red-700">Team</Link>
          </li>
          <li>
            <Link to="/contact" className="hover:text-red-700">Contact</Link>
          </li>
        </ul>
        
        <div>
          <button 
            className="flex items-center gap-2 text-xl font-bold text-gray-700 hover:bg-red-700 hover:text-amber-50 rounded-full px-6 py-2 duration-200 transition-colors"
            onClick={() => navigate('/login')}
          >
            <CiUser /> Login
          </button>
        </div>
      </div>
    </nav>
  )
} 

export default Navbar