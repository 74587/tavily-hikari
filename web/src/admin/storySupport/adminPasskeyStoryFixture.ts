export function buildStoryAdminPasskeyScope(scopeMismatch = false) {
  return {
    nodeId: 'node-shanghai-01',
    rpId: 'admin-sh.example.com',
    rpOrigin: 'https://admin-sh.example.com',
    inactiveCredentialCount: scopeMismatch ? 2 : 0,
    legacyCredentialCount: scopeMismatch ? 1 : 0,
  }
}
