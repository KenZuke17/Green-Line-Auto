import { useEffect, useState } from 'react'
import logoSrc from './assets/logo.png'
import Dashboard from './components/Dashboard'
import Sidebar from './components/Sidebar'
import VehicleLookup from './components/VehicleLookup'
import VehicleDetails from './components/VehicleDetails'
import Inventory from './components/Inventory'
import AddVehicle from './components/AddVehicle'

const api = window.api

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [vehicle, setVehicle] = useState(null)
  const [serviceHistory, setServiceHistory] = useState([])
  const [inventory, setInventory] = useState([])
  const [status, setStatus] = useState('Ready')
  const isAddPage = typeof window !== 'undefined' && window.location.hash === '#/add'

  useEffect(() => {
    loadInventory()
  }, [])

  // Listen for messages from add-window to open a vehicle in this window
  useEffect(() => {
    const handler = (event) => {
      try {
        const msg = event.data || {}
        if (msg && msg.type === 'open-vehicle' && msg.vehicle) {
          handleVehicleFound(msg.vehicle)
          setActiveTab('vehicles')
          window.focus && window.focus()
        }
        if (msg && msg.type === 'focus-main-window') {
          setActiveTab('vehicles')
          window.focus && window.focus()
        }
      } catch (e) {}
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const loadInventory = async () => {
    if (!api) return
    setStatus('Loading inventory...')
    const items = await api.getInventory()
    setInventory(items || [])
    setStatus('Ready')
  }

  const loadServiceHistory = async (vehicleId) => {
    if (!api || !vehicleId) return
    const history = await api.getServiceHistory(vehicleId)
    setServiceHistory(history || [])
  }

  const handleVehicleFound = async (found) => {
    setVehicle(found)
    if (found?.id) {
      await loadServiceHistory(found.id)
    } else {
      setServiceHistory([])
    }
  }

  // Called by VehicleLookup with search params { vin, licensePlate }
  const handleFindRequest = async (params) => {
    if (!api) return
    setStatus('Searching...')
    const found = await api.findVehicle(params)
    if (found) {
      await handleVehicleFound(found)
      setStatus('Ready')
    } else {
      setVehicle(null)
      setServiceHistory([])
      setStatus('Vehicle not found.')
    }
  }

  const handleVehicleCreate = async (data) => {
    if (!api) return
    // Client-side validation for required fields
    const missing = []
    if (!data?.vin) missing.push('VIN')
    if (!data?.license_plate) missing.push('License plate')
    if (!data?.make) missing.push('Brand')
    if (!data?.model) missing.push('Model')
    if (!data?.year) missing.push('Year')
    if (!data?.fuel_type) missing.push('Fuel type')
    if (missing.length) {
      setStatus(`Missing required: ${missing.join(', ')}`)
      return
    }
    setStatus('Creating vehicle...')
    const created = await api.createVehicle(data)
    if (created?.id) {
      setStatus('Vehicle created successfully.')
      const found = await api.findVehicle({ vin: data.vin, licensePlate: data.license_plate })
      await handleVehicleFound(found)
    } else {
      // Handle duplicate cases: open the existing vehicle and show helpful status
      if (created?.error === 'duplicate_license_plate') {
        setStatus('Vehicle with that license plate already exists. Opening existing record...')
        const found = await api.findVehicle({ vin: data.vin, licensePlate: data.license_plate })
        if (found) await handleVehicleFound(found)
        return
      }

      if (created?.error === 'duplicate_vin') {
        setStatus('Vehicle with that VIN already exists. Opening existing record...')
        const found = await api.findVehicle({ vin: data.vin, licensePlate: data.license_plate })
        if (found) await handleVehicleFound(found)
        return
      }

      setStatus(created?.message || created?.error || 'Vehicle creation failed.')
    }
  }

  const handleAddService = async (service) => {
    if (!api || !vehicle?.id) return
    setStatus('Adding service...')
    await api.addService({ ...service, vehicleId: vehicle.id })
    await loadServiceHistory(vehicle.id)
    setStatus('Service added.')
  }

  const handleInventoryUpdate = async (itemId, delta) => {
    if (!api) return
    setStatus('Updating inventory...')
    await api.updateInventoryQuantity({ itemId, delta })
    await loadInventory()
    setStatus('Inventory updated.')
  }

  const handleCreateInventoryItem = async (item) => {
    if (!api) return
    setStatus('Saving inventory item...')
    await api.createInventoryItem(item)
    await loadInventory()
    setStatus('Inventory item added.')
  }

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="app-main">
        <header className="app-header">
          <div className="app-branding">
            <div>
              <h1>Green Line Auto Service</h1>
              <p className="subtitle">Vehicle service and inventory manager</p>
            </div>
          </div>
          <div className="header-right">
            <div className="status-badge">{status}</div>
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <div className="app-content">
            <Dashboard />
          </div>
        ) : activeTab === 'vehicles' ? (
          <>
            <section className="hero-card">
              <div>
                <p className="hero-eyebrow">Workshop dashboard</p>
                <h2>Keep every vehicle moving with confidence.</h2>
                <p>Track service history, manage inventory, and keep your shop running smoothly with a modern desktop experience.</p>
              </div>
            </section>
            <div className={`page-transition ${showAddVehicle ? 'show-add' : 'show-lookup'}`}>
              <div className="lookup-page">
                <div className="content-grid">
                  <VehicleLookup onFind={handleFindRequest} onAddClick={() => setShowAddVehicle(true)} />
                  <VehicleDetails
                    vehicle={vehicle}
                    serviceHistory={serviceHistory}
                    onAddService={handleAddService}
                    onBack={() => {
                      setVehicle(null)
                      setServiceHistory([])
                      setStatus('Ready')
                    }}
                  />
                </div>
              </div>
              <div className="add-vehicle-page">
                <button className="back-button" onClick={() => setShowAddVehicle(false)}>← Back</button>
                <AddVehicle 
                  onVehicleCreated={(vehicle) => {
                    handleVehicleFound(vehicle)
                    setShowAddVehicle(false)
                  }}
                />
              </div>
            </div>
          </>
        ) : activeTab === 'inventory' ? (
          <Inventory inventory={inventory} onRefresh={loadInventory} onUpdateQuantity={handleInventoryUpdate} onCreateItem={handleCreateInventoryItem} />
        ) : null}
      </div>
    </div>
  )
}

        <header className="app-header">
          <div className="app-branding">
            <div>
              <h1>Green Line Auto Service</h1>
              <p className="subtitle">Vehicle service and inventory manager</p>
            </div>
          </div>
          <div className="header-right">
            <div className="status-badge">{status}</div>
            <img src={logoSrc} alt="Green Line Auto Service logo" className="app-logo" />
          </div>
        </header>
