const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
    setTitleBarColors: (color, symbolColor) =>
        ipcRenderer.send('titlebar-colors', color, symbolColor)
});
