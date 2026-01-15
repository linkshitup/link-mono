"use client"
import React from 'react'

const Topbar = () => {
  return (
    <div className='w-full sticky top-0 px-4 h-14 flex items-stretch ' >
        <div className='flex h-full py-3'>
            <img src="/branding/logotype.svg" className='size-full' alt="" />
        </div>
        <div className='ml-auto flex items-stretch gap-2 py-2' >
            <button className='px-4 py-2 flex items-center hover:bg-stone-100 cursor-pointer justify-center font-primary border-2 border-stone-200 font-medium rounded-2xl' >Documentation</button>
            <div className='aspect-square bg-white hover:bg-stone-200 cursor-pointer rounded-full flex items-center justify-center' >
                <img src="/icons/avatar.svg" className='size-[calc(100%-4px)]' alt="" />
            </div>
        </div>
    </div>
  )
}

export default Topbar