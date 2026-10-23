import type { CanonTome, Principal } from "../../schemas/domain";

export interface AcademyReadAdapter {
  getSession(): Promise<Principal | null>;
  listMajorTomes(): Promise<CanonTome[]>;
}

/** No live session, no Firebase initialization, no registrar writes. */
export class DisconnectedAcademyAdapter implements AcademyReadAdapter {
  async getSession(): Promise<null> { return null; }
  async listMajorTomes(): Promise<never> { throw new Error("Owl Academy live integration is not enabled. Use the build-time canon projection."); }
}
