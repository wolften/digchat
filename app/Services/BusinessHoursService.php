<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\BusinessHour;
use App\Models\Sector;
use Illuminate\Support\Carbon;

class BusinessHoursService
{
    /**
     * Returns true if the given sector (or global if null) is currently open.
     * If no hours are configured for the day, assumes open (no restriction).
     */
    public function isOpen(?int $sectorId, ?Carbon $at = null): bool
    {
        $at      ??= now();
        $weekday   = (int) $at->format('w'); // 0=Sun … 6=Sat

        $row = $this->resolveHours($sectorId, $weekday);

        if (! $row) {
            return true; // No config → always open
        }

        if (! $row->is_active) {
            return false;
        }

        $time = $at->format('H:i:s');

        return $time >= $row->opens_at && $time < $row->closes_at;
    }

    /**
     * Returns the out-of-hours auto-reply message for a sector, or null if
     * the feature is disabled / not configured.
     * Falls back to the global AppSetting if the sector has no message set.
     */
    public function outOfHoursMessage(?int $sectorId): ?string
    {
        if ($sectorId) {
            $sector = Sector::find($sectorId);

            if ($sector && $sector->out_of_hours_enabled && filled($sector->out_of_hours_message)) {
                return $sector->out_of_hours_message;
            }
        }

        // Global fallback
        if (AppSetting::bool('out_of_hours_enabled') && filled(AppSetting::get('out_of_hours_message'))) {
            return AppSetting::get('out_of_hours_message');
        }

        return null;
    }

    // -------------------------------------------------------------------------

    private function resolveHours(?int $sectorId, int $weekday): ?BusinessHour
    {
        if ($sectorId !== null) {
            $row = BusinessHour::where('sector_id', $sectorId)
                ->where('weekday', $weekday)
                ->first();

            if ($row) {
                return $row;
            }
        }

        // Fall back to global schedule (sector_id IS NULL)
        return BusinessHour::whereNull('sector_id')
            ->where('weekday', $weekday)
            ->first();
    }
}
