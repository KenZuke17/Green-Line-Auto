const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  findVehicle: (params) => ipcRenderer.invoke('db:findVehicle', params),
  createVehicle: (vehicle) => ipcRenderer.invoke('db:createVehicle', vehicle),
  getServiceHistory: (vehicleId) => ipcRenderer.invoke('db:getServiceHistory', vehicleId),
  addService: (service) => ipcRenderer.invoke('db:addService', service),
  getInventory: () => ipcRenderer.invoke('db:getInventory'),
  updateInventoryQuantity: (payload) => ipcRenderer.invoke('db:updateInventoryQuantity', payload),
  createInventoryItem: (item) => ipcRenderer.invoke('db:createInventoryItem', item),
  getDashboardStats: () => ipcRenderer.invoke('db:getDashboardStats'),
  getServiceTypeBreakdown: () => ipcRenderer.invoke('db:getServiceTypeBreakdown'),
  getTodayServices: () => ipcRenderer.invoke('db:getTodayServices'),
  getAllVehicles: () => ipcRenderer.invoke('db:getAllVehicles'),
  getAllServices: () => ipcRenderer.invoke('db:getAllServices')
})

contextBridge.exposeInMainWorld('windowApi', {
  openAddWindow: () => ipcRenderer.invoke('open-add-window')
})
