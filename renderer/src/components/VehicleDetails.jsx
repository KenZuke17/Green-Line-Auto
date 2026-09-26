import { useMemo, useState } from 'react'

const reminders = [
  { label: 'Oil filter', interval: 10000 },
  { label: 'Air filter', interval: 20000 },
  { label: 'Brake pads', interval: 40000 }
]

export default function VehicleDetails({ vehicle, serviceHistory, onAddService, onBack }) {
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [cost, setCost] = useState('')
  const [mileage, setMileage] = useState('')
  const [nextDueMileage, setNextDueMileage] = useState('')

  const latestMileage = useMemo(() => {
    const values = (serviceHistory || []).map((item) => Number(item.mileage) || 0)
    return values.length ? Math.max(...values) : 0
  }, [serviceHistory])

  const reminderRows = useMemo(() => {
    return reminders.map((item) => {
      const dueAt = latestMileage + item.interval
      const isDue = latestMileage >= dueAt - item.interval
      return {
        ...item,
        dueAt,
        isDue
      }
    })
  }, [latestMileage])

  const hasWarning = reminderRows.some((row) => row.isDue)

  const handleAdd = () => {
    if (!onAddService || !vehicle?.id) return
    onAddService({ description, date, cost: Number(cost) || 0, mileage: Number(mileage) || latestMileage || 0, nextDueMileage: Number(nextDueMileage) || null })
    setDescription('')
    setCost('')
    setMileage('')
    setNextDueMileage('')
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Vehicle Details</h2>
        {onBack && (
          <button type="button" className="secondary" onClick={onBack}>Go Back</button>
        )}
      </div>
      {vehicle ? (
        <>
          <p><strong>VIN:</strong> {vehicle.vin || 'Not recorded'}</p>
          <p><strong>License:</strong> {vehicle.license_plate || 'Not recorded'}</p>
          <p><strong>Make / Model:</strong> {vehicle.make || 'Unknown'} {vehicle.model || ''} {vehicle.year ? `(${vehicle.year})` : ''}</p>
          <p><strong>Fuel Type:</strong> {vehicle.fuel_type || 'Unknown'}</p>
          <p><strong>Owner Name:</strong> {vehicle.owner_name || 'Not recorded'}</p>
          <p><strong>Owner Mobile:</strong> {vehicle.owner_mobile || 'Not recorded'}</p>
          <p><strong>Special Note:</strong> {vehicle.special_note || vehicle.notes || 'None'}</p>
          <p><strong>Current Mileage:</strong> {latestMileage ? `${latestMileage.toLocaleString()} km` : 'Not recorded'}</p>

          {hasWarning && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: '#fff4e5', border: '1px solid #f59e0b', color: '#8a4b00', marginBottom: 14 }}>
              Warning: service intervals are due or approaching. Check oil, air filter, and brake pad service timing.
            </div>
          )}

          <div style={{ marginBottom: 18, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <strong>Service reminders</strong>
            <ul style={{ margin: '10px 0 0 18px', padding: 0 }}>
              {reminderRows.map((row) => (
                <li key={row.label} style={{ marginBottom: 6, color: row.isDue ? '#b45309' : '#334155' }}>
                  {row.label}: next due around {row.dueAt.toLocaleString()} km {row.isDue ? '(due now)' : '(scheduled)'}
                </li>
              ))}
            </ul>
          </div>

          <div className="form-row">
            <label>New Service Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="form-row">
            <label>Current Mileage (km)</label>
            <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder={latestMileage || 0} />
          </div>

          <div className="form-row">
            <label>Next Service Mileage (km)</label>
            <input type="number" value={nextDueMileage} onChange={(e) => setNextDueMileage(e.target.value)} placeholder="Optional" />
          </div>

          <div className="form-row">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>Cost (LKR)</label>
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
          </div>

          <button className="primary" onClick={handleAdd}>Add Service</button>

          <h3>Service History</h3>
          {serviceHistory?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Mileage</th>
                  <th>Next Due</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {serviceHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.description}</td>
                    <td>{Number(item.mileage || 0).toLocaleString()} km</td>
                    <td>{item.next_due_mileage ? `${Number(item.next_due_mileage).toLocaleString()} km` : '—'}</td>
                    <td>Rs. {Number(item.cost || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No service history found.</p>
          )}
        </>
      ) : (
        <p>No vehicle selected. Use lookup or create to begin.</p>
      )}
    </div>
  )
}
