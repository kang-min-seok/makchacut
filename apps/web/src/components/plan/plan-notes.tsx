import { Info } from 'lucide-react';

export function PlanNotes({ notes }: { notes: readonly string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 px-5">
      {notes.map((note) => (
        <li key={note} className="flex items-start gap-1.5 text-[13px] text-subtle-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {note}
        </li>
      ))}
    </ul>
  );
}
