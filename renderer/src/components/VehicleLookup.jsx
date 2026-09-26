import { useState } from 'react'

export default function VehicleLookup({ onFind, onAddClick }) {
  const [ownerName, setOwnerName] = useState('')
  const [licensePlate, setLicensePlate] = useState('')

  const handleFind = () => {
    if (!onFind) return
    onFind({ ownerName: ownerName.trim(), licensePlate: licensePlate.trim() })
  }

  const handleOpenAdd = () => {
    if (onAddClick) {
      onAddClick()
    }
  }

  return (
    <div className="card">
      <h2>Vehicle Lookup</h2>
      <div className="form-row">
        <label>Customer Name</label>
        <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Vehicle owner name" />
      </div>
      <div className="form-row">
        <label>License Plate</label>
        <input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} placeholder="License plate" />
      </div>
      <div className="button-row">
        <button className="primary" onClick={handleFind}>Find Vehicle</button>
        <button className="secondary" onClick={handleOpenAdd}>Add Vehicle</button>
      </div>
    </div>
  )
}
