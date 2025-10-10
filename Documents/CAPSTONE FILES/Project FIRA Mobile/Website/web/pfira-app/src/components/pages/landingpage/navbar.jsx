import React from 'react'
import { CiUser } from "react-icons/ci"
import { useNavigate} from 'react-router-dom'

const navbar = () => {
const navigate = useNavigate()
  return (
    <nav className="bg-white shadow-md w-full z-1 top-0 left-0">
        <div className="max-w-7xl mx-auto px-5 py-3 flex justify-between items-center">
            <div className="flex items-center gap-0">
                <img src="finalogo.png" alt="" className="w-12 h-12" />
                <a href="@" className="object-top-left font-bold text-red-700 hover:text-amber-600">Project FIRA</a>
            </div>
            <ul className="space-x-8 text-gray-700">
                <li className="space-x-10">
                    <a href="/home" className="hover:text-red-700">Home</a>
                    <a href="/about" className="hover:text-red-700">About</a>
                    <a href="/services" className="hover:text-red-700">Services</a>
                    <a href="/team" className="hover:text-red-700">Team</a>
                    <a href="/contact" className="hover:text-red-700">Contact</a>
                </li>
            </ul>
            <div>
                <button className="flex items-center gap-2 text-1xl font-bold text-gray-700 hover:bg-red-700 hover:text-amber-50 rounded-5xl px-6 py-2 duration-200"
                onClick={() => navigate('login')}>
                    <CiUser/> Login
                </button>
                
            </div>
        </div>
    </nav>
  )
} 

export default navbar