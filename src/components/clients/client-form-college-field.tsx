import { ChevronDown, Mail, Plus } from "lucide-react";
import type { StoredCollegeEntry } from "@/actions/client.actions";
import { Input } from "@/components/ui/input";

interface ClientFormCollegeFieldProps {
  canCreateCollege: boolean;
  collegeName: string;
  disabled: boolean;
  hasMoreColleges: boolean;
  filteredColleges: StoredCollegeEntry[];
  onBlur: () => void;
  onChange: (value: string) => void;
  onCreateCollege: () => void;
  onFocus: () => void;
  onSeeMoreColleges: () => void;
  onSelectCollege: (name: string) => void;
  showCollegeDropdown: boolean;
  storedColleges: StoredCollegeEntry[];
}

export function ClientFormCollegeField({
  canCreateCollege,
  collegeName,
  disabled,
  hasMoreColleges,
  filteredColleges,
  onBlur,
  onChange,
  onCreateCollege,
  onFocus,
  onSeeMoreColleges,
  onSelectCollege,
  showCollegeDropdown,
  storedColleges,
}: ClientFormCollegeFieldProps) {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <Mail className="h-5 w-5 text-[#7c4a69]" />
      <div className="relative w-full max-w-[24rem]">
        <Input
          id="collegeName"
          name="collegeName"
          value={collegeName}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onClick={onFocus}
          onBlur={onBlur}
          placeholder="College Name"
          disabled={disabled}
          autoComplete="off"
          className="h-8 border-0 px-0 pr-8 text-2xl shadow-none focus-visible:ring-0"
        />
        {storedColleges.length > 0 ? (
          <button
            type="button"
            aria-label="Open college suggestions"
            className="absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onMouseDown={(event) => {
              event.preventDefault();
              onFocus();
            }}
            onClick={onFocus}
            disabled={disabled}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        ) : null}
        {showCollegeDropdown ? (
          <div className="absolute left-0 top-full z-20 mt-2 min-w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
            {filteredColleges.map((storedCollege) => (
              <button
                key={storedCollege.id}
                type="button"
                className="block w-full px-4 py-2 text-left text-sm font-normal text-slate-900 hover:bg-slate-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelectCollege(storedCollege.name);
                }}
              >
                <span className="block font-normal text-slate-900">{storedCollege.name}</span>
              </button>
            ))}
            {hasMoreColleges ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSeeMoreColleges();
                }}
              >
                See more colleges
              </button>
            ) : null}
            {canCreateCollege ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 text-left text-xs font-medium text-[#7c4a69] hover:bg-slate-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onCreateCollege();
                }}
              >
                <Plus className="h-4 w-4" />
                Other College
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

