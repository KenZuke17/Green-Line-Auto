import { useState } from 'react'

export default function Inventory({ inventory, onRefresh, onUpdateQuantity, onCreateItem }) {
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')

  const handleCreate = () => {
    if (!onCreateItem) return
    onCreateItem({ name, sku, quantity: Number(quantity) || 0, price: Number(price) || 0 })
    setName('')
    setSku('')
    setQuantity('')
    setPrice('')
  }

  return (
    <div className="card">
      <h2>Inventory</h2>
      <div className="button-row" style={{ marginBottom: 16 }}>
        <button className="secondary" onClick={onRefresh}>Refresh</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory?.length ? (
            inventory.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.sku}</td>
                <td>{item.quantity}</td>
                <td>${item.price?.toFixed(2)}</td>
                <td className="inventory-actions">
                  <button className="secondary" onClick={() => onUpdateQuantity(item.id, 1)}>+1</button>
                  <button className="secondary" onClick={() => onUpdateQuantity(item.id, -1)}>-1</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5">No inventory items yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Add Inventory Item</h3>
        <div className="form-row">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
        </div>
        <div className="form-row">
          <label>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
        </div>
        <div className="form-row">
          <label>Quantity</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
        </div>
        <div className="form-row">
          <label>Price</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
        </div>
        <button className="primary" onClick={handleCreate}>Add Item</button>
      </div>
    </div>
  )
}
