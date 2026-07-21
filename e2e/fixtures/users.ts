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

export const THIRD = {
	username: 'e2e_third_seed',
	email: 'e2e_third_seed@seed.test',
	password: SEED_PASSWORD,
};

/** A stably-untrusted bystander: no test mutates it, so parallel tests can rely on it. */
export const STRANGER = {
	username: 'e2e_stranger_seed',
	email: 'e2e_stranger_seed@seed.test',
	password: SEED_PASSWORD,
};

/** A fresh, un-onboarded user (hasOnboarded:false) for the onboarding wizard. */
export const NEWBIE = {
	username: 'e2e_newbie_seed',
	email: 'e2e_newbie_seed@seed.test',
	password: SEED_PASSWORD,
};

/** A locked account (declined legal terms) — gated to /legal/locked. */
export const LOCKED = {
	username: 'e2e_locked_seed',
	email: 'e2e_locked_seed@seed.test',
	password: SEED_PASSWORD,
};

/** An institutional account — unlocks the CSV bulk-import UI at /user/import. */
export const INSTITUTION = {
	username: 'e2e_institution_seed',
	email: 'e2e_institution_seed@seed.test',
	password: SEED_PASSWORD,
};

/** Where the authenticated storageStates produced by auth.setup.ts are written. */
export const STORAGE_STATE = 'e2e/.auth/owner.json';
export const VIEWER_STORAGE_STATE = 'e2e/.auth/viewer.json';
export const THIRD_STORAGE_STATE = 'e2e/.auth/third.json';
export const STRANGER_STORAGE_STATE = 'e2e/.auth/stranger.json';
export const NEWBIE_STORAGE_STATE = 'e2e/.auth/newbie.json';
export const LOCKED_STORAGE_STATE = 'e2e/.auth/locked.json';
export const INSTITUTION_STORAGE_STATE = 'e2e/.auth/institution.json';
