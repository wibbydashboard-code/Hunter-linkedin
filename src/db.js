const DB_NAME = 'prospect-hunter-b2b';
const DB_VERSION = 2;
let openPromise;

export function openDb() {
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('prospects')) {
        const store = db.createObjectStore('prospects', { keyPath: 'id' });
        store.createIndex('canonicalProfileUrl', 'canonicalProfileUrl', { unique: false });
        store.createIndex('normalizedName', 'normalizedName', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('companyDomain', 'companyDomain', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      for (const name of ['searchRuns', 'categories', 'tasks', 'lists']) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('La base de datos está bloqueada por otra ventana.'));
  });
  return openPromise;
}

function run(storeName, mode, operation) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try { result = operation(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(result?.result ?? result);
    tx.onerror = () => reject(tx.error || result?.error);
    tx.onabort = () => reject(tx.error || new Error('Transacción abortada.'));
    if (result?.onsuccess !== undefined) result.onsuccess = () => { result._value = result.result; };
  }));
}

export const getAll = (store) => run(store, 'readonly', s => s.getAll());
export const getOne = (store, id) => run(store, 'readonly', s => s.get(id));
export const putOne = (store, value) => run(store, 'readwrite', s => s.put(value));
export const deleteOne = (store, id) => run(store, 'readwrite', s => s.delete(id));

export async function saveProspect(prospect) {
  const now = new Date().toISOString();
  const saved = { ...prospect, id: prospect.id || crypto.randomUUID(), createdAt: prospect.createdAt || now, updatedAt: now };
  if (!Array.isArray(saved.history)) saved.history = [];
  saved.history.push({ at: now, action: prospect.id ? 'actualizado' : 'creado', summary: prospect.id ? 'Ficha editada' : 'Prospecto añadido manualmente' });
  await putOne('prospects', saved);
  return saved;
}

export async function addManyProspects(items) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('prospects', 'readwrite');
    const store = tx.objectStore('prospects');
    const now = new Date().toISOString();
    let count = 0;
    for (const item of items) {
      store.put({ ...item, id: item.id || crypto.randomUUID(), createdAt: item.createdAt || now, updatedAt: now, history: item.history || [{ at: now, action: 'importado', summary: 'Importación local' }] });
      count++;
    }
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Importación cancelada.'));
  });
}

export async function clearStore(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
