"use client";

import { Select } from "@/components/ui/Field";
import { SORTS, SORT_LABELS, type Sort } from "@/lib/data/catalogue-constants";

/** Sélecteur de tri : soumet son formulaire parent dès qu'on change de valeur. */
export function SortSelect({ defaultValue }: { defaultValue: Sort }) {
  return (
    <Select
      id="tri"
      name="tri"
      defaultValue={defaultValue}
      className="w-auto"
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {SORTS.map((value) => (
        <option key={value} value={value}>
          {SORT_LABELS[value]}
        </option>
      ))}
    </Select>
  );
}

export default SortSelect;
