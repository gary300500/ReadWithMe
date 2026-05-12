const assert = require('node:assert/strict');

function getDefaultProfileId(profiles = [], preferredId = '') {
  const normalizedProfiles = Array.isArray(profiles) ? profiles : [];
  if (!normalizedProfiles.length) return '';
  const preferred = String(preferredId || '').trim();
  if (preferred && normalizedProfiles.some(profile => profile.id === preferred)) return preferred;
  return normalizedProfiles[0].id || '';
}

function getProfileById(profiles = [], profileId = '') {
  const id = String(profileId || '').trim();
  return (Array.isArray(profiles) ? profiles : []).find(profile => profile.id === id) || null;
}

function getPersonaProfileId(persona = {}, profiles = [], defaultProfileId = '') {
  const overrideId = String(persona.modelProfileId || '').trim();
  if (overrideId && getProfileById(profiles, overrideId)) return overrideId;
  return getDefaultProfileId(profiles, defaultProfileId);
}

function groupPersonasByProfile(personas = [], profiles = [], defaultProfileId = '') {
  const groupsById = new Map();
  personas.filter(persona => persona.enabled).forEach(persona => {
    const profileId = getPersonaProfileId(persona, profiles, defaultProfileId);
    const profile = getProfileById(profiles, profileId);
    if (!profile) return;
    if (!groupsById.has(profile.id)) groupsById.set(profile.id, { profile, personas: [] });
    groupsById.get(profile.id).personas.push(persona);
  });
  return Array.from(groupsById.values());
}

const profiles = [
  { id: 'default', name: 'Default' },
  { id: 'ollama', name: 'Ollama' },
];

assert.equal(getDefaultProfileId(profiles, 'ollama'), 'ollama');
assert.equal(getDefaultProfileId(profiles, 'missing'), 'default');
assert.equal(getDefaultProfileId(profiles, ''), 'default');
assert.equal(getDefaultProfileId([], 'ollama'), '');

assert.equal(getPersonaProfileId({ id: 'a', modelProfileId: 'ollama' }, profiles, 'default'), 'ollama');
assert.equal(getPersonaProfileId({ id: 'b', modelProfileId: 'missing' }, profiles, 'default'), 'default');
assert.equal(getPersonaProfileId({ id: 'c' }, profiles, 'default'), 'default');

const grouped = groupPersonasByProfile([
  { id: 'a', enabled: true, modelProfileId: 'ollama' },
  { id: 'b', enabled: true },
  { id: 'c', enabled: false, modelProfileId: 'ollama' },
  { id: 'd', enabled: true, modelProfileId: 'missing' },
], profiles, 'default');

assert.deepEqual(grouped.map(group => [group.profile.id, group.personas.map(persona => persona.id)]), [
  ['ollama', ['a']],
  ['default', ['b', 'd']],
]);

console.log('ai-profile helper tests passed');
