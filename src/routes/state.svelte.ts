// TODO: Is it good practice to have global states here?
export const selectedNames = $state({ selectedValues: [] });
export const selectedPlaces = $state({ selectedValues: [] });
export let searchTextState = $state({ value: '' });
