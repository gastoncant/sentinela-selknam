import type { Analysis } from './crop-types';

export type StoredCrop = Omit<Analysis, 'beforeUrl' | 'afterUrl'> & { before: Blob; after: Blob; opened: number };
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('sentinela-recortes-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('crops', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Almacenamiento ocupado'));
  });
}
export async function loadCrops(): Promise<StoredCrop[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('crops').objectStore('crops').getAll();
      request.onsuccess = () => resolve((request.result as StoredCrop[]).sort((a, b) => b.opened - a.opened).slice(0, 6));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function storeCrop(crop: StoredCrop) {
  const previous = await loadCrops();
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('crops', 'readwrite');
      const store = transaction.objectStore('crops');
      store.put(crop);
      previous.filter(item => item.id !== crop.id).slice(5).forEach(item => store.delete(item.id));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
