export interface ICreateZonePayload {
  name: string;
  description?: string;
}

export interface IUpdateZonePayload {
  name?: string;
  description?: string;
}

export interface ICreateSubstationPayload {
  name: string;
  zoneId: string;
}

export interface IUpdateSubstationPayload {
  name?: string;
  zoneId?: string;
}

export interface ICreateFeederPayload {
  name: string;
  substationId: string;
}

export interface IUpdateFeederPayload {
  name?: string;
  substationId?: string;
}

export interface ICreateAreaPayload {
  name: string;
  feederId: string;
}

export interface IUpdateAreaPayload {
  name?: string;
  feederId?: string;
}
