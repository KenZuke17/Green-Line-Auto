import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import BrandShowcase from './BrandShowcase'

export default function Dashboard() {
  const [dailyStats, setDailyStats] = useState({
    servicesThisWeek: [
      { day: 'Mon', services: 0, parts: 0 },
      { day: 'Tue', services: 0, parts: 0 },
      { day: 'Wed', services: 0, parts: 0 },
      { day: 'Thu', services: 0, parts: 0 },
      { day: 'Fri', services: 0, parts: 0 },
      { day: 'Sat', services: 0, parts: 0 },
      { day: 'Sun', services: 0, parts: 0 }
    ],
    todayServices: 0,
    todayPartsSold: 0,
    totalVehicles: 0,
    totalServices: 0
  })

  const [serviceTypeData, setServiceTypeData] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState(null)
  const [modalTitle, setModalTitle] = useState('')

  useEffect(() => {
    // Fetch dashboard stats from the database
    const fetchStats = async () => {
      try {
        const stats = await window.api.getDashboardStats()
        setDailyStats(prev => ({
          ...prev,
          totalVehicles: stats.totalVehicles || 0,
          totalServices: stats.totalServices || 0,
          todayServices: stats.todayServices || 0,
          todayPartsSold: stats.todayPartsSold || 0
        }))
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      }
    }

    // Fetch service type breakdown
    const fetchServiceTypes = async () => {
      try {
        const data = await window.api.getServiceTypeBreakdown()
        setServiceTypeData(data.length > 0 ? data : [{ name: 'No services logged', value: 1 }])
      } catch (error) {
        console.error('Error fetching service type breakdown:', error)
      }
    }

    fetchStats()
    fetchServiceTypes()
    // Refresh stats every 5 minutes
    const interval = setInterval(() => {
      fetchStats()
      fetchServiceTypes()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleTodayServicesClick = async () => {
    try {
      const data = await window.api.getTodayServices()
      setModalData(data)
      setModalTitle("Today's Services")
      setModalOpen(true)
    } catch (error) {
      console.error('Error fetching today services:', error)
    }
  }

  const handleTotalVehiclesClick = async () => {
    try {
      const data = await window.api.getAllVehicles()
      setModalData(data)
      setModalTitle('All Vehicles')
      setModalOpen(true)
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    }
  }

  const handleTotalServicesClick = async () => {
    try {
      const data = await window.api.getAllServices()
      setModalData(data)
      setModalTitle('All Services')
      setModalOpen(true)
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }

  const COLORS = ['#fbbf24', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6']

  return (
    <div className="dashboard-container">
      {/* Header Stats */}
      <div className="stats-grid">
        <div className="stat-card today-services" onClick={handleTodayServicesClick} style={{ cursor: 'pointer' }}>
          <div className="stat-icon">🔧</div>
          <div className="stat-content">
            <div className="stat-label">Today's Services</div>
            <div className="stat-value">{dailyStats.todayServices}</div>
            <div className="stat-unit">vehicles serviced</div>
          </div>
        </div>

        <div className="stat-card today-parts" style={{ cursor: 'pointer' }}>
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-label">Parts Sold Today</div>
            <div className="stat-value">{dailyStats.todayPartsSold}</div>
            <div className="stat-unit">items sold</div>
          </div>
        </div>

        <div className="stat-card total-vehicles" onClick={handleTotalVehiclesClick} style={{ cursor: 'pointer' }}>
          <div className="stat-icon">🚗</div>
          <div className="stat-content">
            <div className="stat-label">Total Vehicles</div>
            <div className="stat-value">{dailyStats.totalVehicles}</div>
            <div className="stat-unit">in system</div>
          </div>
        </div>

        <div className="stat-card total-services" onClick={handleTotalServicesClick} style={{ cursor: 'pointer' }}>
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">Total Services</div>
            <div className="stat-value">{dailyStats.totalServices}</div>
            <div className="stat-unit">all time</div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalTitle}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              {modalTitle === "Today's Services" && modalData && (
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>Make</th>
                      <th>Model</th>
                      <th>Year</th>
                      <th>Plate</th>
                      <th>Services</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.make || '—'}</td>
                        <td>{item.model || '—'}</td>
                        <td>{item.year || '—'}</td>
                        <td>{item.license_plate || '—'}</td>
                        <td>{item.serviceCount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {modalTitle === 'All Vehicles' && modalData && (
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>Make</th>
                      <th>Model</th>
                      <th>Year</th>
                      <th>Plate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.make || '—'}</td>
                        <td>{item.model || '—'}</td>
                        <td>{item.year || '—'}</td>
                        <td>{item.license_plate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {modalTitle === 'All Services' && modalData && (
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vehicle</th>
                      <th>Description</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((item, idx) => (
                      <tr key={idx}>
                        <td>{new Date(item.date).toLocaleDateString()}</td>
                        <td>{(item.make || '—') + ' ' + (item.model || '—')}</td>
                        <td>{item.description || '—'}</td>
                        <td>${(item.cost || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Weekly Services & Parts Bar Chart */}
        <div className="chart-card">
          <h3>Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyStats.servicesThisWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
              />
              <Legend />
              <Bar dataKey="services" fill="#fbbf24" radius={[8, 8, 0, 0]} name="Services" />
              <Bar dataKey="parts" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Parts Sold" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Service Types Pie Chart */}
        <div className="chart-card">
          <h3>Service Breakdown</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={serviceTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {serviceTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="chart-card full-width">
        <h3>30-Day Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={[
              { date: 'Day 1', services: 4, parts: 6 },
              { date: 'Day 5', services: 8, parts: 12 },
              { date: 'Day 10', services: 6, parts: 9 },
              { date: 'Day 15', services: 10, parts: 15 },
              { date: 'Day 20', services: 7, parts: 11 },
              { date: 'Day 25', services: 9, parts: 14 },
              { date: 'Day 30', services: 11, parts: 18 }
            ]}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
            <Legend />
            <Line type="monotone" dataKey="services" stroke="#fbbf24" strokeWidth={2} name="Services" dot={{ fill: '#fbbf24', r: 4 }} />
            <Line type="monotone" dataKey="parts" stroke="#10b981" strokeWidth={2} name="Parts Sold" dot={{ fill: '#10b981', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Brand Showcase */}
      <BrandShowcase />
    </div>
  )
}
