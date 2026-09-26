import { useState, useEffect } from 'react'

// Import logos using alias
import toyotaLogo from '@assets/toyota.png'
import hondaLogo from '@assets/honda.png'
import nissanLogo from '@assets/nissan.png'
import bmwLogo from '@assets/bmw.png'
import audiLogo from '@assets/audi.png'
import mercedesLogo from '@assets/mercedez.png'
import mitsubishiLogo from '@assets/mitsubishi.png'
import hyundaiLogo from '@assets/hyhundai.png'
import roverLogo from '@assets/range rover.png'

export default function BrandShowcase() {
  const brands = [
    { name: 'Toyota', logo: toyotaLogo },
    { name: 'Honda', logo: hondaLogo },
    { name: 'Nissan', logo: nissanLogo },
    { name: 'BMW', logo: bmwLogo },
    { name: 'Audi', logo: audiLogo },
    { name: 'Mercedes', logo: mercedesLogo },
    { name: 'Mitsubishi', logo: mitsubishiLogo },
    { name: 'Hyundai', logo: hyundaiLogo },
    { name: 'Range Rover', logo: roverLogo }
  ]

  return (
    <div className="brand-showcase">
      <div className="brand-container">
        {brands.map((brand, idx) => (
          <div key={idx} className="brand-item" title={brand.name}>
            <img src={brand.logo} alt={brand.name} loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  )
}
