import { get } from './api.js';

const BASE = '/api';

async function post(path, body, role = 'admin') {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Role': role, Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

async function put(path, body, role = 'admin') {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Role': role, Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

async function patch(path, body, role = 'admin') {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Role': role, Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

async function del(path, role = 'admin') {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: { 'X-Role': role, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

// --- Plans ---

export async function fetchPlans(query = {}) {
  const qs = new URLSearchParams(query).toString();
  const res = await get(`${BASE}/plans${qs ? '?' + qs : ''}`);
  return res.data;
}

export async function createPlan(data, role) {
  const res = await post(`${BASE}/plans`, data, role);
  return res.data;
}

export async function editPlan(id, data, role) {
  return put(`${BASE}/plans/${id}`, data, role);
}

export async function updatePlanStatus(id, body, role) {
  return patch(`${BASE}/plans/${id}/status`, body, role);
}

export async function deletePlan(id, role) {
  return del(`${BASE}/plans/${id}`, role);
}

// --- Variants ---

export async function createVariant(planId, data, role) {
  const res = await post(`${BASE}/plans/${planId}/variants`, data, role);
  return res.data;
}

export async function editVariant(id, data, role) {
  return put(`${BASE}/variants/${id}`, data, role);
}

export async function deleteVariant(id, role) {
  return del(`${BASE}/variants/${id}`, role);
}

// --- Scores ---

export async function submitScores(variantId, body, role) {
  return post(`${BASE}/variants/${variantId}/scores`, body, role);
}

// --- Dimensions ---

export async function fetchDimensions() {
  const res = await get(`${BASE}/dimensions`);
  return res.data;
}

export async function createDimension(data, role) {
  const res = await post(`${BASE}/dimensions`, data, role);
  return res.data;
}

export async function editDimension(id, data, role) {
  return put(`${BASE}/dimensions/${id}`, data, role);
}

export async function deleteDimension(id, role) {
  return del(`${BASE}/dimensions/${id}`, role);
}
