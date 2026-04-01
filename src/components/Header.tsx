import React from "react";

export function Header() {
  return (
    <header className="text-center py-6 bg-white border-b border-sand shadow-sm">
      <div className="flex justify-center items-center flex-wrap gap-6 px-4">
        <a 
          href="https://cbcc.edu.bd/" 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Visit Cox's Bazar City College website"
          className="transition-transform hover:scale-105"
        >
          <img 
            src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
            alt="Cox's Bazar City College Logo" 
            className="h-20 md:h-24 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </a>
        <a 
          href="https://bncc.info/" 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Visit BNCC official website"
          className="transition-transform hover:scale-105"
        >
          <img 
            src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
            alt="BNCC Logo" 
            className="h-20 md:h-24 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </a>
      </div>
      <div className="mt-4 px-4 overflow-hidden">
        <h1 className="text-xl md:text-2xl font-bold text-primary uppercase tracking-wider">
          Cox's Bazar City College BNCC Platoon
        </h1>
      </div>
    </header>
  );
}
