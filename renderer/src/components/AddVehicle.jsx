import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const fuelOptions = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'Other']

const carBrands = [
  'Toyota', 'Nissan', 'Honda', 'Mazda', 'Mitsubishi', 'Suzuki', 'Subaru', 'Isuzu', 'Daihatsu', 'Lexus',
  'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Opel',
  'Ford', 'Chevrolet', 'Jeep', 'Tesla', 'Dodge', 'Cadillac', 'GMC', 'Chrysler',
  'Hyundai', 'Kia', 'SsangYong',
  'Volvo', 'Land Rover', 'Jaguar', 'Mini', 'Fiat', 'Peugeot', 'Renault', 'Citroen', 'Alfa Romeo',
  'Perodua', 'Proton', 'Tata', 'Mahindra', 'MG'
]

const modelsByBrand = {
  Toyota: ['Corolla', 'Camry', 'Prius', 'Hilux', 'Land Cruiser', 'Yaris', 'RAV4', 'Aqua', 'Vitz', 'Axio', 'Premio', 'Allion'],
  Nissan: ['Sunny', 'Sylphy', 'X-Trail', 'Navara', 'Note', 'Leaf', 'Juke', 'Patrol', 'Caravan', 'Bluebird'],
  Honda: ['Civic', 'Accord', 'CR-V', 'Fit', 'Vezel', 'City', 'Insight', 'Grace', 'Freed'],
  Mazda: ['Mazda3', 'Mazda6', 'CX-5', 'CX-3', 'Demio', 'Axela', 'Premacy'],
  Mitsubishi: ['Lancer', 'Outlander', 'Pajero', 'Montero', 'Mirage', 'Triton', 'ASX'],
  Suzuki: ['Swift', 'Alto', 'Wagon R', 'Vitara', 'Jimny', 'Baleno', 'Every'],
  Subaru: ['Impreza', 'Outback', 'Forester', 'Legacy', 'XV', 'WRX'],
  Isuzu: ['D-Max', 'MU-X', 'Trooper'],
  Daihatsu: ['Mira', 'Terios', 'Move'],
  Lexus: ['IS', 'ES', 'RX', 'NX', 'LX', 'GX'],
  BMW: ['3 Series', '5 Series', 'X1', 'X3', 'X5', '7 Series'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class', 'GLA', 'GLC', 'GLE'],
  Audi: ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7'],
  Volkswagen: ['Golf', 'Polo', 'Passat', 'Tiguan', 'Jetta'],
  Ford: ['Ranger', 'Focus', 'Fiesta', 'Escape', 'Everest', 'Explorer'],
  Hyundai: ['Elantra', 'Tucson', 'Santa Fe', 'i10', 'i20', 'Accent'],
  Kia: ['Sportage', 'Sorento', 'Rio', 'Picanto', 'Cerato'],
  Perodua: ['Axia', 'Myvi', 'Bezza', 'Alza'],
  Proton: ['Saga', 'Persona', 'X70']
}

const schema = z.object({
  vin: z.preprocess((s) => typeof s === 'string' ? s.toUpperCase().replace(/\s+/g, '').trim() : s, z.string().min(9, { message: 'VIN must be at least 9 characters (supports both standard 17-char VINs and JDM chassis numbers).' }).max(17, { message: 'VIN must not exceed 17 characters.' }).regex(/^[A-HJ-NPR-Z0-9\-]{9,17}$/, { message: 'VIN must contain only letters, digits, and hyphens.' })),
  license_plate: z.preprocess((s) => typeof s === 'string' ? s.toUpperCase().trim() : s, z.string().min(1, { message: 'License plate is required.' }).max(12, { message: 'License plate too long.' }).regex(/^[A-Z0-9 \-_]+$/, { message: 'License plate contains invalid characters.' })),
  make: z.string().min(1, { message: 'Brand (Make) is required.' }).max(60, { message: 'Brand too long.' }),
  model: z.string().min(1, { message: 'Model is required.' }).max(60, { message: 'Model too long.' }),
  year: z.preprocess((s) => String(s).trim(), z.string().regex(/^\d{4}$/, { message: 'Year must be four digits.' }).refine((value) => {
    const n = Number(value)
    const now = new Date().getFullYear()
    return n >= 1886 && n <= now + 1
  }, { message: `Year must be between 1886 and ${new Date().getFullYear() + 1}.` })),
  fuel_type: z.enum(['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'Other'], { errorMap: () => ({ message: 'Fuel type is required.' }) }),
  owner_name: z.string().min(1, { message: 'Owner name is required.' }).max(100, { message: 'Owner name too long.' }),
  owner_mobile: z.string().min(1, { message: 'Mobile number is required.' }).regex(/^[\d\s\-\+\(\)]+$/, { message: 'Invalid mobile number format.' }).refine((val) => val.replace(/\D/g, '').length >= 7, { message: 'Mobile number must have at least 7 digits.' }),
  notes: z.string().max(2000).optional(),
  special_note: z.string().max(2000).optional()
})

export default function AddVehicle({ onVehicleCreated }) {
  const [status, setStatus] = useState('')
  const [duplicateError, setDuplicateError] = useState('')

  const { register, handleSubmit: rhfSubmit, formState: { errors: rhfErrors, isSubmitting }, reset, watch } = useForm({ resolver: zodResolver(schema) })

  const selectedMake = watch('make')
  const matchedBrand = carBrands.find((b) => b.toLowerCase() === (selectedMake || '').trim().toLowerCase())
  const modelSuggestions = modelsByBrand[matchedBrand] || []

  const handleSubmit = async (formData) => {
    if (!window.api) return
    setDuplicateError('')
    setStatus('Creating...')
    try {
      const res = await window.api.createVehicle({
        vin: formData.vin,
        license_plate: formData.license_plate,
        make: formData.make,
        model: formData.model,
        year: Number(formData.year) || null,
        fuel_type: formData.fuel_type,
        owner_name: formData.owner_name,
        owner_mobile: formData.owner_mobile,
        notes: formData.notes || formData.special_note || '',
        special_note: formData.special_note || formData.notes || ''
      })

      if (res?.id) {
        setStatus('✅ Vehicle created successfully!')
        reset()
        setTimeout(() => {
          if (onVehicleCreated) {
            onVehicleCreated(res.vehicle || res)
          }
        }, 500)
        return
      }

      // Handle duplicate VIN error
      if (res?.error === 'duplicate_vin') {
        setDuplicateError('❌ A vehicle with this VIN already exists. Only one vehicle can have the same VIN.')
        setStatus('')
        return
      }

      // Handle duplicate license plate error
      if (res?.error === 'duplicate_license_plate') {
        setDuplicateError('❌ A vehicle with this license plate already exists. Only one vehicle can have the same license plate.')
        setStatus('')
        return
      }

      // Handle other errors
      if (res?.error) {
        setStatus(`Error: ${res.message || res.error}`)
      } else if (res) {
        setStatus(typeof res === 'object' ? JSON.stringify(res) : String(res))
      } else {
        setStatus('No response from createVehicle')
      }
    } catch (err) {
      setStatus(err?.message || String(err))
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Add Vehicle</h2>
      <form onSubmit={rhfSubmit(handleSubmit)}>
        <div className="form-row">
          <label>VIN</label>
          <input {...register('vin')} />
          {rhfErrors.vin ? <div style={{ color: '#b91c1c', marginTop: 6 }}>{rhfErrors.vin.message}</div> : null}
        </div>

        <div className="form-row">
          <label>License plate</label>
          <input {...register('license_plate')} />
          {rhfErrors.license_plate ? <div style={{ color: '#b91c1c', marginTop: 6 }}>{rhfErrors.license_plate.message}</div> : null}
        </div>

        <div className="form-row">
          <label>Brand (Make)</label>
          <input {...register('make')} list="brand-suggestions" autoComplete="off" placeholder="Start typing e.g. T for Toyota" />
          <datalist id="brand-suggestions">
            {carBrands.map((brand) => <option key={brand} value={brand} />)}
          </datalist>
          {rhfErrors.make ? <div style={{ color: '#b91c1c', marginTop: 6 }}>{rhfErrors.make.message}</div> : null}
        </div>

        <div className="form-row">
          <label>Model</label>
          <input {...register('model')} list="model-suggestions" autoComplete="off" placeholder="Start typing a model" />
          <datalist id="model-suggestions">
            {modelSuggestions.map((model) => <option key={model} value={model} />)}
          </datalist>
          {rhfErrors.model ? <div style={{ color: '#b91c1c', marginTop: 6 }}>{rhfErrors.model.message}</div> : null}
        </div>

        <div className="form-row">
          <label>Year</label>
          <input {...register('year')} />
          {rhfErrors.year ? <div style={{ color: '#b91c1c', marginTop: 6 }}>{rhfErrors.year.message}</div> : null}
        </div>

        <div className="form-row">
          <label>Fuel type</label>
          <select {...register('fuel_type')}>
            <option value="">Select fuel type</option>
            {fuelOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          {rhfErrors.fuel_type ? <div style={{ color: '#b91c1c', marginTop: 6 }}>{rhfErrors.fuel_type.message}</div> : null}
        </div>

        <div className="form-row">
          <label>Owner Name <span style={{ color: '#b91c1c' }}>*</span></label>
          <input {...register('owner_name')} placeholder="Vehicle owner full name" />
          {rhfErrors.owner_name ? <div style={{ color: '#b91c1c', marginTop: 6 }}>{rhfErrors.owner_name.message}</div> : null}
        </div>

        <div className="form-row">
          <label>Owner Mobile Number <span style={{ color: '#b91c1c' }}>*</span></label>
          <input {...register('owner_mobile')} placeholder="e.g., +94 701234567 or 0701234567" />
          {rhfErrors.owner_mobile ? <div style={{ color: '#b91c1c', marginTop: 6 }}>{rhfErrors.owner_mobile.message}</div> : null}
        </div>

        <div className="form-row">
          <label>Special note</label>
          <textarea {...register('special_note')} rows={4} placeholder="Optional special note for the vehicle" />
          {rhfErrors.special_note ? <div style={{ color: '#b91c1c', marginTop: 6 }}>{rhfErrors.special_note.message}</div> : null}
        </div>

        <div className="button-row">
          <button type="submit" className="primary" disabled={isSubmitting}>Create Vehicle</button>
        </div>
        {duplicateError && <div style={{ marginTop: 12, padding: 12, background: '#fee2e2', border: '2px solid #dc2626', borderRadius: 8, color: '#991b1b', fontWeight: 600 }}>{duplicateError}</div>}
        {status && <div style={{ marginTop: 12, padding: 12, background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: 8, color: '#1e40af', fontWeight: 600 }}>{status}</div>}
      </form>
    </div>
  )
}
