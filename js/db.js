import { localDateKey } from './nutrition.js';

const DB_NAME = 'diet-ai-app';
const DB_VERSION = 1;
let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meals')) {
        const store = db.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
        store.createIndex('datetime', 'datetime');
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('weights')) {
        db.createObjectStore('weights', { keyPath: 'date' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

// テスト/再初期化用：キャッシュした接続を閉じて破棄する
export function closeDB() {
  if (_db) { _db.close(); _db = null; }
}

function tx(store, mode) {
  return _db.transaction(store, mode).objectStore(store);
}
function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addMeal(meal) {
  await openDB();
  return asPromise(tx('meals', 'readwrite').add(meal));
}
export async function updateMeal(meal) {
  await openDB();
  return asPromise(tx('meals', 'readwrite').put(meal));
}
export async function deleteMeal(id) {
  await openDB();
  return asPromise(tx('meals', 'readwrite').delete(id));
}
export async function getAllMeals() {
  await openDB();
  return asPromise(tx('meals', 'readonly').getAll());
}
export async function getMealsByDate(dateKey) {
  const all = await getAllMeals();
  return all.filter((m) => localDateKey(m.datetime) === dateKey);
}
export async function getMealsInRange(startKey, endKey) {
  const all = await getAllMeals();
  return all.filter((m) => {
    const k = localDateKey(m.datetime);
    return k >= startKey && k <= endKey;
  });
}

async function kvGet(key) {
  await openDB();
  const r = await asPromise(tx('kv', 'readonly').get(key));
  return r ? r.value : null;
}
async function kvSet(key, value) {
  await openDB();
  return asPromise(tx('kv', 'readwrite').put({ key, value }));
}
export const getGoals = () => kvGet('goals');
export const saveGoals = (g) => kvSet('goals', g);
export const getSettings = () => kvGet('settings');
export const saveSettings = (s) => kvSet('settings', s);

export async function addWeight(date, kg) {
  await openDB();
  return asPromise(tx('weights', 'readwrite').put({ date, kg }));
}
export async function getAllWeights() {
  await openDB();
  return asPromise(tx('weights', 'readonly').getAll());
}
