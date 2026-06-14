"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClientFormCreateCollegeDialogProps {
  country: string;
  districtCity: string;
  name: string;
  open: boolean;
  pending: boolean;
  placeArea: string;
  selectedState: string;
  onCountryChange: (value: string) => void;
  onDistrictCityChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onPlaceAreaChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onSubmit: () => void;
}

export function ClientFormCreateCollegeDialog({
  country,
  districtCity,
  name,
  open,
  pending,
  placeArea,
  selectedState,
  onCountryChange,
  onDistrictCityChange,
  onNameChange,
  onOpenChange,
  onPlaceAreaChange,
  onStateChange,
  onSubmit,
}: ClientFormCreateCollegeDialogProps) {
  const canSubmit =
    !!country.trim() &&
    !!selectedState.trim() &&
    !!districtCity.trim() &&
    !!placeArea.trim() &&
    !!name.trim();

  const handleCreate = () => {
    if (!canSubmit || pending) {
      return;
    }

    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create College</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="newCollegeName">College Name</Label>
            <Input
              id="newCollegeName"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Type college name"
              disabled={pending}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newCollegeCountry">Country</Label>
              <Input
                id="newCollegeCountry"
                value={country}
                onChange={(event) => onCountryChange(event.target.value)}
                placeholder="Type country"
                disabled={pending}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newCollegeState">State</Label>
              <Input
                id="newCollegeState"
                value={selectedState}
                onChange={(event) => onStateChange(event.target.value)}
                placeholder="Type state"
                disabled={pending}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newCollegeDistrictCity">District / City</Label>
              <Input
                id="newCollegeDistrictCity"
                value={districtCity}
                onChange={(event) => onDistrictCityChange(event.target.value)}
                placeholder="Type district or city"
                disabled={pending}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newCollegePlaceArea">Place / Area</Label>
              <Input
                id="newCollegePlaceArea"
                value={placeArea}
                onChange={(event) => onPlaceAreaChange(event.target.value)}
                placeholder="Type place or area"
                disabled={pending}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={pending || !canSubmit}
              className={!canSubmit ? "cursor-not-allowed opacity-50" : undefined}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
