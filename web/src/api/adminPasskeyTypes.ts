export interface AdminPasskeyCredential {
  credentialId: string
  label: string | null
  createdAt: number
  updatedAt: number
  lastUsedAt: number | null
}

export interface AdminPasskeyScope {
  nodeId: string
  rpId: string
  rpOrigin: string
  inactiveCredentialCount: number
  legacyCredentialCount: number
}
