/**
 * CRM Hierarchy — Fleet Director → Corporate Entity → Drivers
 * Strict relational invariants enforced before and after persistence.
 */

export interface HierarchyNode {
  id: string;
  type: 'fleet_director' | 'corporate_entity' | 'driver' | 'vehicle';
  parentId: string | null;
  companyId: string | null;
  label: string;
  meta?: Record<string, unknown>;
}

export interface HierarchySnapshot {
  companyId: string;
  companyName: string;
  directors: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    scopedCompanyIds: string[];
  }>;
  drivers: Array<{
    id: string;
    name: string;
    email: string | null;
    companyId: string;
  }>;
  vehicles: Array<{
    id: string;
    truckNumber: string;
    assignedDriverId: string | null;
    companyId: string;
  }>;
  violations: string[];
}

/**
 * Validate that hierarchy invariants hold:
 * 1. Every driver belongs to exactly one company
 * 2. Every vehicle belongs to a company; assigned drivers must share company
 * 3. Fleet directors must reference the company in scoped_company_ids (or be global)
 * 4. No orphan drivers/vehicles
 */
export function validateHierarchy(snapshot: HierarchySnapshot): string[] {
  const violations: string[] = [];
  const driverIds = new Set(snapshot.drivers.map((d) => d.id));

  for (const d of snapshot.drivers) {
    if (d.companyId !== snapshot.companyId) {
      violations.push(`Driver ${d.name} (${d.id}) is not linked to company ${snapshot.companyId}`);
    }
  }

  for (const v of snapshot.vehicles) {
    if (v.companyId !== snapshot.companyId) {
      violations.push(`Vehicle ${v.truckNumber} (${v.id}) is not linked to company ${snapshot.companyId}`);
    }
    if (v.assignedDriverId && !driverIds.has(v.assignedDriverId)) {
      violations.push(
        `Vehicle ${v.truckNumber} assigned to unknown driver ${v.assignedDriverId}`,
      );
    }
    if (v.assignedDriverId) {
      const driver = snapshot.drivers.find((d) => d.id === v.assignedDriverId);
      if (driver && driver.companyId !== v.companyId) {
        violations.push(
          `Vehicle ${v.truckNumber} / driver ${driver.name} company mismatch`,
        );
      }
    }
  }

  for (const dir of snapshot.directors) {
    const scoped = dir.scopedCompanyIds || [];
    if (
      dir.role !== 'global_admin' &&
      scoped.length > 0 &&
      !scoped.includes(snapshot.companyId)
    ) {
      violations.push(
        `Director ${dir.email} scoped_company_ids does not include ${snapshot.companyId}`,
      );
    }
  }

  if (snapshot.directors.length === 0) {
    violations.push('Company has no fleet director / primary contact');
  }

  return violations;
}

/**
 * Build a tree representation for UI state.
 */
export function buildHierarchyTree(snapshot: HierarchySnapshot): HierarchyNode[] {
  const nodes: HierarchyNode[] = [
    {
      id: snapshot.companyId,
      type: 'corporate_entity',
      parentId: null,
      companyId: snapshot.companyId,
      label: snapshot.companyName,
    },
  ];

  for (const dir of snapshot.directors) {
    nodes.push({
      id: dir.id,
      type: 'fleet_director',
      parentId: snapshot.companyId,
      companyId: snapshot.companyId,
      label: `${dir.name} <${dir.email}>`,
      meta: { role: dir.role },
    });
  }

  for (const d of snapshot.drivers) {
    nodes.push({
      id: d.id,
      type: 'driver',
      parentId: snapshot.companyId,
      companyId: d.companyId,
      label: d.name,
      meta: { email: d.email },
    });
  }

  for (const v of snapshot.vehicles) {
    nodes.push({
      id: v.id,
      type: 'vehicle',
      parentId: v.assignedDriverId || snapshot.companyId,
      companyId: v.companyId,
      label: v.truckNumber,
      meta: { assignedDriverId: v.assignedDriverId },
    });
  }

  return nodes;
}
