export interface PolicyContent {
  id: number;
  title: string;
  category: number;
  content: string;
  summary: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyEnum {
  enumName: string;
  values: {
    value: number;
    name: string;
  }[];
}

export interface GetPolicyEnumsResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: PolicyEnum[];
}

export interface GetActivePoliciesResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: PolicyContent[];
}

export interface GetPolicyDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  payload: PolicyContent;
}
