const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')

let SQL = null
let db = null
let dbPath = null

function rowsToObjects(result) {
  if (!result || !result.length) return []
  const { columns, values } = result[0]
  return values.map((row) => {
    const obj = {}
    columns.forEach((key, index) => {
      obj[key] = row[index]
    })
    return obj
  })
}

function saveDatabase() {
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function initializeSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vin TEXT UNIQUE,
      license_plate TEXT UNIQUE,
      make TEXT,
      model TEXT,
      year INTEGER,
      fuel_type TEXT,
      notes TEXT,
      special_note TEXT
    );

    CREATE TABLE IF NOT EXISTS service_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      description TEXT,
      date TEXT,
      cost REAL,
      mileage INTEGER DEFAULT 0,
      next_due_mileage INTEGER,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      sku TEXT UNIQUE,
      quantity INTEGER DEFAULT 0,
      price REAL,
      notes TEXT
    );
  `)
}

function loadDatabase() {
  const legacyDbPath = path.join(process.env.APPDATA || '', 'Green Line Auto', 'green-line-auto.sqlite')

  if (!fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    fs.copyFileSync(legacyDbPath, dbPath)
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(new Uint8Array(fileBuffer))
  } else {
    db = new SQL.Database()
    initializeSchema()
    saveDatabase()
  }
}

function ensureVehiclesColumns() {
  try {
    const result = db.exec("PRAGMA table_info('vehicles')")
    const rows = rowsToObjects(result)
    const cols = rows.map((r) => r.name)
    if (!cols.includes('fuel_type')) {
      db.run("ALTER TABLE vehicles ADD COLUMN fuel_type TEXT")
      saveDatabase()
    }
    if (!cols.includes('special_note')) {
      db.run("ALTER TABLE vehicles ADD COLUMN special_note TEXT")
      saveDatabase()
    }
    if (cols.includes('notes') && !cols.includes('special_note')) {
      db.run("UPDATE vehicles SET special_note = notes WHERE notes IS NOT NULL AND special_note IS NULL")
      saveDatabase()
    }
    if (cols.includes('special_note') && cols.includes('notes')) {
      db.run("UPDATE vehicles SET notes = special_note WHERE notes IS NULL AND special_note IS NOT NULL")
      saveDatabase()
    }
    if (!cols.includes('owner_name')) {
      db.run("ALTER TABLE vehicles ADD COLUMN owner_name TEXT")
      saveDatabase()
    }
    if (!cols.includes('owner_mobile')) {
      db.run("ALTER TABLE vehicles ADD COLUMN owner_mobile TEXT")
      saveDatabase()
    }
  } catch (err) {
    return
  }
}

function ensureServiceHistoryColumns() {
  try {
    const result = db.exec("PRAGMA table_info('service_history')")
    const rows = rowsToObjects(result)
    const cols = rows.map((r) => r.name)
    if (!cols.includes('mileage')) {
      db.run("ALTER TABLE service_history ADD COLUMN mileage INTEGER DEFAULT 0")
      saveDatabase()
    }
    if (!cols.includes('next_due_mileage')) {
      db.run("ALTER TABLE service_history ADD COLUMN next_due_mileage INTEGER")
      saveDatabase()
    }
  } catch (err) {
    return
  }
}

async function init(app) {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file) => path.join(__dirname, 'sql-wasm.wasm')
    })
  }

  if (!dbPath) {
    const preferred = path.join(app.getPath('userData'), 'green-line-auto.sqlite')
    const legacy = path.join(app.getPath('appData'), 'Green Line Auto', 'green-line-auto.sqlite')

    if (!fs.existsSync(preferred) && fs.existsSync(legacy)) {
      fs.mkdirSync(path.dirname(preferred), { recursive: true })
      fs.copyFileSync(legacy, preferred)
    }

    dbPath = preferred
  }

  loadDatabase()
  // Ensure schema contains newer columns (migration)
  try {
    ensureVehiclesColumns()
    ensureServiceHistoryColumns()
  } catch (e) {
    // ignore migration errors
  }
}

function findVehicle({ ownerName, licensePlate, vin } = {}) {
  if (!ownerName && !licensePlate && !vin) return null

  let query = 'SELECT * FROM vehicles WHERE 1=1'
  const params = []

  // normalize searches to uppercase trimmed values to match stored records
  if (vin) vin = String(vin).trim().toUpperCase()
  if (licensePlate) licensePlate = String(licensePlate).trim().toUpperCase()
  if (ownerName) ownerName = String(ownerName).trim()

  if (vin) {
    query += ' AND vin = ?'
    params.push(vin)
  }
  if (licensePlate) {
    query += ' AND license_plate = ?'
    params.push(licensePlate)
  }
  if (ownerName) {
    query += ' AND owner_name LIKE ?'
    params.push(`%${ownerName}%`)
  }

  const result = db.exec(query, params)
  const rows = rowsToObjects(result)
  return rows.length ? rows[0] : null
}

function createVehicle(vehicle) {
  const { vin, license_plate, make, model, year, notes, special_note, fuel_type, owner_name, owner_mobile } = vehicle || {}
  const specialNoteValue = special_note ?? notes ?? ''
  if (!vin || !license_plate || !make || !model || !year || !fuel_type || !owner_name || !owner_mobile) {
    return { id: null, error: 'All fields (VIN, license plate, brand, model, year, fuel type, owner name, owner mobile) are required.' }
  }

  try {
    // Normalize stored identifiers to consistent uppercase trimmed form
    const storeVin = String(vin).trim().toUpperCase()
    const storeLicense = String(license_plate).trim().toUpperCase()

    db.run(
      'INSERT INTO vehicles (vin, license_plate, make, model, year, notes, special_note, fuel_type, owner_name, owner_mobile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [storeVin, storeLicense, make || null, model || null, year || null, specialNoteValue || null, specialNoteValue || null, fuel_type || null, owner_name || null, owner_mobile || null]
    )
    saveDatabase()

    // Try to return the inserted row. If last_insert_rowid is not set, fall back to selecting by VIN/license.
    const result = db.exec('SELECT last_insert_rowid() AS id')
    const rows = rowsToObjects(result)
    let insertedId = rows.length ? rows[0].id : null
    if (!insertedId) {
      // fallback: find any row matching vin or license_plate
      const found = db.exec('SELECT * FROM vehicles WHERE vin = ? OR license_plate = ? LIMIT 1', [vin, license_plate])
      const foundRows = rowsToObjects(found)
      if (foundRows.length) {
        insertedId = foundRows[0].id
        return { id: insertedId, vehicle: foundRows[0] }
      }
      return { id: null, error: 'Failed to create vehicle and no matching record found.' }
    }

    const sel = db.exec('SELECT * FROM vehicles WHERE id = ? LIMIT 1', [insertedId])
    const selRows = rowsToObjects(sel)
    return selRows.length ? { id: insertedId, vehicle: selRows[0] } : { id: insertedId }
  } catch (error) {
    const message = error?.message || 'Database insert failed.'
    // Normalize SQLITE UNIQUE constraint messages into structured error codes
    if (message.includes('UNIQUE constraint failed: vehicles.vin')) {
      // return existing matching vehicle if present
      const found = db.exec('SELECT * FROM vehicles WHERE vin = ? LIMIT 1', [vin])
      const foundRows = rowsToObjects(found)
      return foundRows.length ? { id: foundRows[0].id, vehicle: foundRows[0], error: 'duplicate_vin', message } : { id: null, error: 'duplicate_vin', message }
    }
    if (message.includes('UNIQUE constraint failed: vehicles.license_plate')) {
      const found = db.exec('SELECT * FROM vehicles WHERE license_plate = ? LIMIT 1', [license_plate])
      const foundRows = rowsToObjects(found)
      return foundRows.length ? { id: foundRows[0].id, vehicle: foundRows[0], error: 'duplicate_license_plate', message } : { id: null, error: 'duplicate_license_plate', message }
    }
    return { id: null, error: 'db_error', message }
  }
}

function getServiceHistory(vehicleId) {
  if (!vehicleId) return []
  const result = db.exec('SELECT * FROM service_history WHERE vehicle_id = ? ORDER BY date DESC', [vehicleId])
  return rowsToObjects(result)
}

function addService(service) {
  const { vehicleId, description, date, cost, mileage, nextDueMileage } = service || {}
  db.run(
    'INSERT INTO service_history (vehicle_id, description, date, cost, mileage, next_due_mileage) VALUES (?, ?, ?, ?, ?, ?)',
    [vehicleId, description || '', date || new Date().toISOString(), cost || 0, Number(mileage) || 0, Number(nextDueMileage) || null]
  )
  saveDatabase()
  const result = db.exec('SELECT last_insert_rowid() AS id')
  const rows = rowsToObjects(result)
  return rows.length ? { serviceId: rows[0].id } : { serviceId: null }
}

function getInventory() {
  const result = db.exec('SELECT * FROM inventory ORDER BY name ASC')
  return rowsToObjects(result)
}

function updateInventoryQuantity(itemId, delta) {
  if (!itemId || typeof delta !== 'number') return { success: false }
  db.run('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [delta, itemId])
  saveDatabase()
  return { success: true }
}

function createInventoryItem(item) {
  const { name, sku, quantity, price, notes } = item || {}
  db.run(
    'INSERT OR IGNORE INTO inventory (name, sku, quantity, price, notes) VALUES (?, ?, ?, ?, ?)',
    [name || '', sku || '', quantity || 0, price || 0, notes || null]
  )
  saveDatabase()
  const result = db.exec('SELECT last_insert_rowid() AS id')
  const rows = rowsToObjects(result)
  return rows.length ? { id: rows[0].id } : { id: null }
}

function getDashboardStats() {
  try {
    // Get total vehicles count
    const vehiclesResult = db.exec('SELECT COUNT(*) as count FROM vehicles')
    const vehiclesRows = rowsToObjects(vehiclesResult)
    const totalVehicles = vehiclesRows.length ? vehiclesRows[0].count : 0

    // Get total services count
    const servicesResult = db.exec('SELECT COUNT(*) as count FROM service_history')
    const servicesRows = rowsToObjects(servicesResult)
    const totalServices = servicesRows.length ? servicesRows[0].count : 0

    // Get today's services (services added today)
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const todayServicesResult = db.exec(
      'SELECT COUNT(DISTINCT vehicle_id) as count FROM service_history WHERE DATE(date) = ?',
      [today]
    )
    const todayServicesRows = rowsToObjects(todayServicesResult)
    const todayServices = todayServicesRows.length ? todayServicesRows[0].count : 0

    // Get today's parts sold (inventory items updated today)
    // For now, we'll return 0 since we need to track inventory changes
    // This would require an inventory_changes or audit table
    const todayPartsSold = 0

    return {
      totalVehicles,
      totalServices,
      todayServices,
      todayPartsSold
    }
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    return {
      totalVehicles: 0,
      totalServices: 0,
      todayServices: 0,
      todayPartsSold: 0
    }
  }
}

function getServiceTypeBreakdown() {
  try {
    const result = db.exec('SELECT description FROM service_history WHERE description IS NOT NULL AND description != ""')
    const rows = rowsToObjects(result)
    
    const serviceTypes = {
      'Oil Change': 0,
      'Air Filter': 0,
      'Oil Filter': 0,
      'Tire Service': 0,
      'Brake Work': 0,
      'Engine Tune': 0,
      'Other': 0
    }

    // Parse descriptions and count service types
    rows.forEach(row => {
      const desc = (row.description || '').toLowerCase()
      
      // Split by common delimiters to handle multiple services per entry
      const parts = desc.split(/[,\n]+/)
      
      parts.forEach(part => {
        const trimmed = part.trim()
        if (trimmed.includes('oil change') || trimmed.includes('oil')) {
          serviceTypes['Oil Change']++
        } else if (trimmed.includes('air filter')) {
          serviceTypes['Air Filter']++
        } else if (trimmed.includes('oil filter')) {
          serviceTypes['Oil Filter']++
        } else if (trimmed.includes('tire')) {
          serviceTypes['Tire Service']++
        } else if (trimmed.includes('brake')) {
          serviceTypes['Brake Work']++
        } else if (trimmed.includes('engine') || trimmed.includes('tune')) {
          serviceTypes['Engine Tune']++
        } else if (trimmed) {
          serviceTypes['Other']++
        }
      })
    })

    // Convert to array format for pie chart
    return Object.entries(serviceTypes)
      .filter(([_, value]) => value > 0) // Only include non-zero values
      .map(([name, value]) => ({ name, value }))
  } catch (error) {
    console.error('Error getting service breakdown:', error)
    return []
  }
}

function getTodayServices() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const result = db.exec(
      `SELECT DISTINCT v.id, v.make, v.model, v.year, v.license_plate, COUNT(sh.id) as serviceCount
       FROM vehicles v
       LEFT JOIN service_history sh ON v.id = sh.vehicle_id AND DATE(sh.date) = ?
       WHERE sh.id IS NOT NULL
       GROUP BY v.id
       ORDER BY v.make, v.model`,
      [today]
    )
    return rowsToObjects(result)
  } catch (error) {
    console.error('Error getting today services:', error)
    return []
  }
}

function getAllVehicles() {
  try {
    const result = db.exec('SELECT id, make, model, year, license_plate FROM vehicles ORDER BY make, model')
    return rowsToObjects(result)
  } catch (error) {
    console.error('Error getting all vehicles:', error)
    return []
  }
}

function getAllServices() {
  try {
    const result = db.exec(
      `SELECT sh.id, sh.date, sh.description, sh.cost, v.make, v.model, v.license_plate
       FROM service_history sh
       LEFT JOIN vehicles v ON sh.vehicle_id = v.id
       ORDER BY sh.date DESC`
    )
    return rowsToObjects(result)
  } catch (error) {
    console.error('Error getting all services:', error)
    return []
  }
}

module.exports = {
  init,
  findVehicle,
  createVehicle,
  getServiceHistory,
  addService,
  getInventory,
  updateInventoryQuantity,
  createInventoryItem,
  getDashboardStats,
  getServiceTypeBreakdown,
  getTodayServices,
  getAllVehicles,
  getAllServices
}
