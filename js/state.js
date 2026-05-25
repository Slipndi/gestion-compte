import { startOfMonth } from './utils.js';

// État global de l'application, muté in-place par les modules
export const state = {
  session:    null,
  tab:        "mois",
  cur:        startOfMonth(new Date()),
  categories: [],
  recurrents: [],
  depenses:   [],
  revDefault: null,
  revMonth:   null,
};
