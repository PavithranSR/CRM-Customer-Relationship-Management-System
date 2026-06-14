export interface ProjectClientRecord {
  id: string;
  name: string;
  collegeName: string | null;
  email: string;
  phone: string | null;
  street: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  state: string | null;
  country: string | null;
  serviceName: string | null;
  projectName: string | null;
  tags: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface ProjectClientOption extends ProjectClientRecord {
  linkedClientId?: string | null;
  quotationNo?: string | null;
  sourceTitle?: string | null;
}
