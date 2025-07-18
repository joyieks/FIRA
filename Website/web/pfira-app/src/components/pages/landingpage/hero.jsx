import React from 'react'

const hero = () => {
  return (
    <div>
        <button className="flex items-center gap-0 font-bold bg-red-700 text-amber-50 hover:bg-amber-600 rounded-5xl px-6 py-2 duration-200"
            onClick={() => window.location.href = '/register'}>
            Register
        </button>
    </div>
  )
}

export default hero