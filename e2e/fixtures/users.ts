/**
 * Credentials for the users created by the `e2e` seed scenario
 * (scripts/seed/scenarios/e2e.js). Keep these in sync with that file.
 */
export const SEED_PASSWORD = 'password123';

export const OWNER = {
	username: 'e2e_owner_seed',
	email: 'e2e_owner_seed@seed.test',
	password: SEED_PASSWORD,
};

export const VIEWER = {
	username: 'e2e_viewer_seed',
	email: 'e2e_viewer_seed@seed.test',
	password: SEED_PASSWORD,
};

/** Where the authenticated storageState produced by auth.setup.ts is written. */
export const STORAGE_STATE = 'e2e/.auth/owner.json';
