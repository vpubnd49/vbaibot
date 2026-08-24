import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeVietnamese } from '../../domain/normalize-vietnamese.js';

export type Commune = {
  code: string;
  name: string;
  type: string;
  oldDistrict?: string;
  old_district?: string;
  oldNames?: string[];
  old_names?: string[];
};

export type Province = {
  code: string;
  name: string;
  type: string;
  oldNames?: string[];
  old_names?: string[];
  communes: Commune[];
};

export type AdminData = {
  metadata: {
    source?: string;
    updated?: string;
    total_provinces?: number;
    total_communes?: number;
    totalProvinces?: number;
    totalCommunes?: number;
    legal_basis?: string[];
    legalBasis?: string[];
  };
  provinces: Province[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, '../data/administrative-divisions-2025.json');

function loadData(): AdminData {
  try {
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(fileContent) as AdminData;
  } catch (error) {
    console.error('Failed to load administrative divisions data:', error);
    return { metadata: {} as any, provinces: [] };
  }
}

const data = loadData();

export function listProvinces(): Province[] {
  return data.provinces || [];
}

export function searchAdministrativeUnit(query: string): { provinces: Province[]; communes: (Commune & { provinceName: string })[] } {
  if (!query || !data.provinces) {
    return { provinces: [], communes: [] };
  }

  const normalizedQuery = normalizeVietnamese(query);
  const matchedProvinces: Province[] = [];
  const matchedCommunes: (Commune & { provinceName: string })[] = [];

  for (const province of data.provinces) {
    // Check province
    const matchProvinceName = normalizeVietnamese(province.name).includes(normalizedQuery);
    const oldProv = province.oldNames || province.old_names || [];
    const matchOldProvinceNames = oldProv.some(old => normalizeVietnamese(old).includes(normalizedQuery));
    
    if (matchProvinceName || matchOldProvinceNames) {
      matchedProvinces.push(province);
    }

    // Check communes
    if (province.communes && Array.isArray(province.communes)) {
      for (const commune of province.communes) {
        const matchCommuneName = normalizeVietnamese(commune.name).includes(normalizedQuery);
        const oldComm = commune.oldNames || commune.old_names || [];
        const matchOldCommuneNames = oldComm.some(old => normalizeVietnamese(old).includes(normalizedQuery));
        const dist = commune.oldDistrict || commune.old_district || '';
        const matchOldDistrict = dist && normalizeVietnamese(dist).includes(normalizedQuery);

        if (matchCommuneName || matchOldCommuneNames || matchOldDistrict) {
          matchedCommunes.push({ ...commune, provinceName: province.name });
        }
      }
    }
  }

  return { provinces: matchedProvinces, communes: matchedCommunes };
}

export function resolveOldAddress(oldDistrictOrCommune: string): { commune: Commune; provinceName: string }[] {
  if (!oldDistrictOrCommune || !data.provinces) {
    return [];
  }

  const normalizedQuery = normalizeVietnamese(oldDistrictOrCommune);
  const results: { commune: Commune; provinceName: string }[] = [];

  for (const province of data.provinces) {
    if (province.communes && Array.isArray(province.communes)) {
      for (const commune of province.communes) {
        const dist = commune.oldDistrict || commune.old_district || '';
        const matchOldDistrict = dist && normalizeVietnamese(dist) === normalizedQuery;
        const oldComm = commune.oldNames || commune.old_names || [];
        const matchOldCommune = oldComm.some(old => normalizeVietnamese(old) === normalizedQuery);
        
        if (matchOldDistrict || matchOldCommune) {
          results.push({ commune, provinceName: province.name });
        }
      }
    }
  }

  return results;
}

export function getCommunesByProvince(provinceCode: string): Commune[] {
  if (!data.provinces) return [];
  const province = data.provinces.find(p => p.code === provinceCode);
  return province ? (province.communes || []) : [];
}

export function getStats(): { totalProvinces: number; totalCommunes: number } {
  return {
    totalProvinces: data.metadata?.totalProvinces || data.metadata?.total_provinces || data.provinces?.length || 34,
    totalCommunes: data.metadata?.totalCommunes || data.metadata?.total_communes || 3321,
  };
}
